import "dotenv/config";
import Fastify from "fastify";
import { streamChat } from "./gemini.js";
import { openStream, closeStream, billToken } from "./billing.js";

const app = Fastify({ logger: true });

app.post<{
  Body: { userWallet: `0x${string}`; model: string; prompt: string; maxUsd: number };
}>("/stream", async (req, reply) => {
  const { userWallet, model, prompt, maxUsd } = req.body;
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

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
