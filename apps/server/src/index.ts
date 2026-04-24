import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

type PaidRequest = Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};
import { streamChat, isMockMode } from "./gemini.js";
import { openStream, closeStream, billToken } from "./billing.js";
import { runAgentChain } from "./chain.js";
import { serviceAccount } from "./arc.js";
import { runDemoBuyer } from "./demo-buyer.js";

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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mock: isMockMode(),
    chainConnected: Boolean(serviceAccount),
    gatewayReady: Boolean(gateway),
    sellerAddress: SELLER_ADDRESS ?? null,
    facilitatorUrl: FACILITATOR_URL,
    network: ARC_NETWORK_CAIP,
  });
});

function writeSseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

const handleStream: RequestHandler = async (req, res) => {
  const body = req.body as {
    userWallet?: `0x${string}`;
    model?: string;
    prompt?: string;
    maxUsd?: number;
  };
  const paymentReq = req as PaidRequest;
  const userWallet = (paymentReq.payment?.payer ??
    body.userWallet ??
    "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
  const model = body.model ?? "gemini-3-flash";
  const prompt = body.prompt ?? "";
  const maxUsd = body.maxUsd ?? 0.05;

  const streamId = await openStream({ userWallet, model, maxUsd });
  writeSseHeaders(res);

  if (paymentReq.payment) {
    res.write(
      `event: payment\ndata: ${JSON.stringify({
        verified: paymentReq.payment.verified,
        payer: paymentReq.payment.payer,
        amount: paymentReq.payment.amount,
        network: paymentReq.payment.network,
        transaction: paymentReq.payment.transaction,
      })}\n\n`,
    );
  }

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  try {
    for await (const token of streamChat(model, prompt)) {
      if (aborted) break;
      try {
        const tx = await billToken(streamId, token);
        res.write(
          `data: ${JSON.stringify({ token, tx: tx.hash, totalPaid: tx.totalPaid })}\n\n`,
        );
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
        break;
      }
    }
  } finally {
    const summary = await closeStream(streamId);
    res.write(`event: done\ndata: ${JSON.stringify({ streamId, ...summary })}\n\n`);
    res.end();
  }
};

const handleChain: RequestHandler = async (req, res) => {
  const body = req.body as {
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
  const prompt = body.prompt ?? "";
  const maxUsd = body.maxUsd ?? 0.1;
  const reasoner = body.reasoner ?? "gemini-3-pro";
  const drafter = body.drafter ?? "gemini-3-flash";

  writeSseHeaders(res);

  if (paymentReq.payment) {
    res.write(
      `event: payment\ndata: ${JSON.stringify(paymentReq.payment)}\n\n`,
    );
  }

  try {
    for await (const event of runAgentChain(prompt, [
      { role: "reasoner", model: reasoner, userWallet, maxUsd: maxUsd / 2 },
      { role: "drafter", model: drafter, userWallet, maxUsd: maxUsd / 2 },
    ])) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } finally {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
};

if (gateway) {
  app.post("/stream", gateway.require("$0.05") as RequestHandler, handleStream);
  app.post("/chain", gateway.require("$0.10") as RequestHandler, handleChain);
} else {
  console.warn("[warn] SELLER_ADDRESS not set; x402 payments disabled. Routes open.");
  app.post("/stream", handleStream);
  app.post("/chain", handleChain);
}

app.post("/demo/run-stream", async (req, res) => {
  writeSseHeaders(res);
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
app.listen(port, () => {
  console.log(`NanoPay server listening on :${port}`);
  console.log(`  Mock LLM: ${isMockMode()}`);
  console.log(`  Gateway ready: ${Boolean(gateway)}`);
  console.log(`  Seller address: ${SELLER_ADDRESS ?? "(none)"}`);
});
