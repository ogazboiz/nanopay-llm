import "dotenv/config";
import Fastify from "fastify";
import { streamChat, isMockMode } from "./gemini.js";
import { openStream, closeStream, billToken } from "./billing.js";
import { runAgentChain } from "./chain.js";
import { serviceAccount } from "./arc.js";

const app = Fastify({ logger: true });

const DEMO_WALLET = "0x000000000000000000000000000000000000dEaD" as const;

app.addHook("onSend", async (req, reply, payload) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
  reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  return payload;
});

app.options("*", async (_req, reply) => reply.code(204).send());

app.get("/health", async () => ({
  ok: true,
  mock: isMockMode(),
  chainConnected: Boolean(serviceAccount),
}));

app.post<{
  Body: { userWallet?: `0x${string}`; model: string; prompt: string; maxUsd: number };
}>("/stream", async (req, reply) => {
  const userWallet = (req.body.userWallet ?? DEMO_WALLET) as `0x${string}`;
  const { model, prompt, maxUsd } = req.body;
  const streamId = await openStream({ userWallet, model, maxUsd });

  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  let aborted = false;
  req.raw.on("close", () => {
    aborted = true;
  });

  try {
    for await (const token of streamChat(model, prompt)) {
      if (aborted) break;
      try {
        const tx = await billToken(streamId, token);
        reply.raw.write(
          `data: ${JSON.stringify({ token, tx: tx.hash, totalPaid: tx.totalPaid })}\n\n`,
        );
      } catch (err) {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
        );
        break;
      }
    }
  } finally {
    const summary = await closeStream(streamId);
    reply.raw.write(`event: done\ndata: ${JSON.stringify({ streamId, ...summary })}\n\n`);
    reply.raw.end();
  }
});

app.post<{
  Body: {
    userWallet?: `0x${string}`;
    prompt: string;
    maxUsd: number;
    reasoner?: string;
    drafter?: string;
  };
}>("/chain", async (req, reply) => {
  const userWallet = (req.body.userWallet ?? DEMO_WALLET) as `0x${string}`;
  const { prompt, maxUsd } = req.body;
  const reasoner = req.body.reasoner ?? "gemini-3-pro";
  const drafter = req.body.drafter ?? "gemini-3-flash";

  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  try {
    for await (const event of runAgentChain(prompt, [
      { role: "reasoner", model: reasoner, userWallet, maxUsd: maxUsd / 2 },
      { role: "drafter", model: drafter, userWallet, maxUsd: maxUsd / 2 },
    ])) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } finally {
    reply.raw.write(`event: done\ndata: {}\n\n`);
    reply.raw.end();
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
