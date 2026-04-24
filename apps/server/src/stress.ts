import { GatewayClient } from "@circle-fin/x402-batching/client";

type Emit = (event: Record<string, unknown>) => void;

const DEMO_KEY = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
const SERVER_URL = process.env.SELF_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

export async function runStress(
  {
    count = 50,
    prompt = "Reply with exactly one short word.",
    model = "gemini-3-flash-preview",
    maxUsdPerCall = 0.01,
  }: { count?: number; prompt?: string; model?: string; maxUsdPerCall?: number },
  emit: Emit,
): Promise<void> {
  if (!DEMO_KEY) {
    emit({ error: "DEMO_BUYER_PRIVATE_KEY not set" });
    return;
  }

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: DEMO_KEY });

  emit({ status: "init", count });
  const balances = await client.getBalances();
  emit({
    status: "balance",
    available: balances.gateway.formattedAvailable,
  });

  const required = BigInt(Math.ceil(count * maxUsdPerCall * 1_000_000));
  if (balances.gateway.available < required) {
    const topUp = ((Number(required - balances.gateway.available) / 1_000_000) + 1).toFixed(2);
    emit({ status: "depositing", amount: topUp });
    const r = await client.deposit(topUp);
    emit({ status: "deposited", tx: r.depositTxHash });
  }

  const url = `${SERVER_URL}/stream`;
  const started = Date.now();
  let successCount = 0;
  let failCount = 0;
  const settlements: string[] = [];
  let totalPaidMicro = 0n;

  for (let i = 0; i < count; i++) {
    try {
      const result = await client.pay(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, model, maxUsd: maxUsdPerCall }),
      });
      successCount++;
      totalPaidMicro += result.amount;
      const tx = result.transaction;
      if (tx) settlements.push(tx);

      emit({
        status: "auth",
        index: i + 1,
        of: count,
        http: result.status,
        amount: result.formattedAmount,
        transaction: tx,
      });
    } catch (err) {
      failCount++;
      emit({
        status: "auth_failed",
        index: i + 1,
        of: count,
        error: (err as Error).message,
      });
    }
  }

  const elapsedMs = Date.now() - started;
  const totalUsd = Number(totalPaidMicro) / 1_000_000;

  const finalBalances = await client.getBalances().catch(() => undefined);

  emit({
    status: "stress_done",
    count,
    successCount,
    failCount,
    elapsedMs,
    totalUsd,
    settlements,
    uniqueSettlements: [...new Set(settlements)].length,
    finalGatewayBalance: finalBalances?.gateway.formattedAvailable,
    per_sec: count / (elapsedMs / 1000),
  });
}
