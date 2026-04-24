import { GatewayClient } from "@circle-fin/x402-batching/client";

type Event = Record<string, unknown>;
type Emit = (event: Event) => void;

interface DemoRequest {
  endpoint?: "stream" | "chain";
  prompt?: string;
  model?: string;
  maxUsd?: number;
}

const DEMO_KEY = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
const SERVER_URL = process.env.SELF_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

export async function runDemoBuyer(body: DemoRequest, emit: Emit): Promise<void> {
  if (!DEMO_KEY) {
    emit({
      error:
        "DEMO_BUYER_PRIVATE_KEY not set. Fund a wallet at https://faucet.circle.com and paste its key into apps/server/.env.",
    });
    return;
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: DEMO_KEY,
  });

  emit({ status: "checking balance" });
  const balances = await client.getBalances();
  emit({ status: "balance", available: balances.gateway.formattedAvailable });

  if (balances.gateway.available < 100_000n) {
    emit({ status: "depositing 1 USDC to Gateway" });
    const deposit = await client.deposit("1");
    emit({ status: "deposited", tx: deposit.depositTxHash });
  }

  const endpoint = body.endpoint === "chain" ? "/chain" : "/stream";
  const url = `${SERVER_URL}${endpoint}`;
  emit({ status: "calling paid endpoint", url });

  const payload = {
    prompt: body.prompt ?? "Explain why per-token on-chain billing needs Arc.",
    model: body.model ?? "gemini-3-flash-preview",
    maxUsd: body.maxUsd ?? 0.05,
  };

  const result = await client.pay(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  emit({
    status: "x402 paid",
    httpStatus: result.status,
    amount: result.formattedAmount,
    transaction: result.transaction,
  });

  const data = result.data as {
    payment?: Record<string, unknown>;
    tokens?: string[];
    fullText?: string;
    tokenCount?: number;
    totalPaidUsd?: number;
    events?: Array<Record<string, unknown>>;
    reasonerText?: string;
    drafterText?: string;
  };

  if (data.payment) emit({ ...data.payment, verified: true });

  if (data.events) {
    for (const ev of data.events) {
      if (ev.token) {
        emit(ev);
        await new Promise((r) => setTimeout(r, 40));
      }
    }
  } else if (data.tokens) {
    for (const token of data.tokens) {
      emit({ token, totalPaid: data.totalPaidUsd });
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  emit({
    status: "done",
    tokenCount: data.tokenCount,
    totalPaidUsd: data.totalPaidUsd,
    transaction: result.transaction,
  });
}
