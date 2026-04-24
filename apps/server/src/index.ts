import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { streamChat, isMockMode } from "./gemini.js";
import { openStream, closeStream, billToken } from "./billing.js";
import { runAgentChain } from "./chain.js";
import { serviceAccount } from "./arc.js";
import { runDemoBuyer } from "./demo-buyer.js";
import { runStress } from "./stress.js";
import { runAgent } from "./agent.js";
import { registerAgentIfNeeded, getAgentIdForService } from "./erc8004.js";

type PaidRequest = Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};

const SELLER_ADDRESS = (process.env.SELLER_ADDRESS ?? serviceAccount?.address) as
  | `0x${string}`
  | undefined;

const FACILITATOR_URL =
  process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

const ARC_NETWORK_CAIP = "eip155:5042002";

const app = express();
app.use(cors());
app.use(express.json());

const gateway = SELLER_ADDRESS
  ? createGatewayMiddleware({
      sellerAddress: SELLER_ADDRESS,
      networks: ARC_NETWORK_CAIP,
      facilitatorUrl: FACILITATOR_URL,
      description: "NanoPay LLM per-stream access",
    })
  : undefined;

app.get("/health", async (_req, res) => {
  const agentId = await getAgentIdForService();
  res.json({
    ok: true,
    mock: isMockMode(),
    chainConnected: Boolean(serviceAccount),
    gatewayReady: Boolean(gateway),
    sellerAddress: SELLER_ADDRESS ?? null,
    facilitatorUrl: FACILITATOR_URL,
    network: ARC_NETWORK_CAIP,
    erc8004: {
      identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
      reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
      validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
      agentId: agentId?.toString() ?? null,
    },
  });
});

const handleStream: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as {
    userWallet?: `0x${string}`;
    model?: string;
    prompt?: string;
    maxUsd?: number;
  };
  const paymentReq = req as PaidRequest;
  const userWallet = (paymentReq.payment?.payer ??
    body.userWallet ??
    "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
  const model = body.model ?? "gemini-3-flash-preview";
  const prompt = body.prompt ?? "Explain why per-token on-chain billing needs Arc.";
  const maxUsd = body.maxUsd ?? 0.05;

  const streamId = await openStream({ userWallet, model, maxUsd });
  const tokens: string[] = [];
  let budgetExhausted = false;

  for await (const token of streamChat(model, prompt)) {
    try {
      await billToken(streamId, token);
      tokens.push(token);
    } catch {
      budgetExhausted = true;
      break;
    }
  }

  const summary = await closeStream(streamId);

  res.json({
    payment: paymentReq.payment ?? null,
    streamId,
    model,
    tokens,
    fullText: tokens.join(""),
    tokenCount: summary?.tokens ?? tokens.length,
    totalPaidUsd: summary?.totalPaid ?? 0,
    attestationTx: summary?.attestationTx ?? null,
    budgetExhausted,
  });
};

const handleChain: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as {
    userWallet?: `0x${string}`;
    prompt?: string;
    maxUsd?: number;
    reasoner?: string;
    drafter?: string;
  };
  const paymentReq = req as PaidRequest;
  const userWallet = (paymentReq.payment?.payer ??
    body.userWallet ??
    "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
  const prompt = body.prompt ?? "Explain why per-token on-chain billing needs Arc.";
  const maxUsd = body.maxUsd ?? 0.1;
  const reasoner = body.reasoner ?? "gemini-3-pro-preview";
  const drafter = body.drafter ?? "gemini-3-flash-preview";

  const events: unknown[] = [];
  const reasonerTokens: string[] = [];
  const drafterTokens: string[] = [];

  for await (const event of runAgentChain(prompt, [
    { role: "reasoner", model: reasoner, userWallet, maxUsd: maxUsd / 2 },
    { role: "drafter", model: drafter, userWallet, maxUsd: maxUsd / 2 },
  ])) {
    events.push(event);
    if (event.role === "reasoner" && event.token) reasonerTokens.push(event.token);
    if (event.role === "drafter" && event.token) drafterTokens.push(event.token);
  }

  res.json({
    payment: paymentReq.payment ?? null,
    events,
    reasonerText: reasonerTokens.join(""),
    drafterText: drafterTokens.join(""),
    reasonerTokens: reasonerTokens.length,
    drafterTokens: drafterTokens.length,
  });
};

if (gateway) {
  app.post("/stream", gateway.require("$0.05") as RequestHandler, handleStream);
  app.post("/chain", gateway.require("$0.10") as RequestHandler, handleChain);
} else {
  console.warn("[warn] SELLER_ADDRESS not set; x402 payments disabled. Routes open.");
  app.post("/stream", handleStream);
  app.post("/chain", handleChain);
}

app.post("/demo/agent", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  try {
    await runAgent(req.body ?? {}, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
  } finally {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
});

app.post("/demo/stress", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  try {
    await runStress(req.body ?? {}, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
  } finally {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
});

app.post("/demo/run-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  try {
    await runDemoBuyer(req.body, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
  } finally {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, async () => {
  console.log(`NanoPay server listening on :${port}`);
  console.log(`  Mock LLM: ${isMockMode()}`);
  console.log(`  Gateway ready: ${Boolean(gateway)}`);
  console.log(`  Seller address: ${SELLER_ADDRESS ?? "(none)"}`);

  if (process.env.ERC8004_REGISTER_ON_STARTUP === "1" && serviceAccount) {
    const r = await registerAgentIfNeeded();
    if (r.agentId !== undefined) {
      console.log(`  ERC-8004 agent id: ${r.agentId.toString()}`);
    } else if (r.registerTx) {
      console.log(`  ERC-8004 register submitted: ${r.registerTx}`);
    } else {
      console.log(`  ERC-8004 agent not registered (opt in via ERC8004_REGISTER_ON_STARTUP=1)`);
    }
  } else {
    const existing = await getAgentIdForService().catch(() => undefined);
    if (existing !== undefined) {
      console.log(`  ERC-8004 agent id: ${existing.toString()}`);
    }
  }
});
