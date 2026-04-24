#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const program = new Command();

program
  .name("nanopay")
  .description("NanoPay LLM CLI — buyer-side demo and provider ops")
  .version("0.0.1");

function requireKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) {
    console.error("Set PRIVATE_KEY in env or .env (0x-prefixed).");
    process.exit(1);
  }
  return key;
}

function client(): GatewayClient {
  return new GatewayClient({ chain: "arcTestnet", privateKey: requireKey() });
}

program
  .command("balance")
  .description("Show Gateway and on-chain balances for PRIVATE_KEY")
  .action(async () => {
    const c = client();
    const b = await c.getBalances();
    console.log(`Gateway available: ${b.gateway.formattedAvailable} USDC`);
    console.log(`Gateway withdrawing: ${b.gateway.withdrawing}`);
    console.log(`Gateway withdrawable: ${b.gateway.withdrawable}`);
  });

program
  .command("deposit")
  .description("Deposit USDC into Gateway Wallet contract (one-time, onchain)")
  .argument("<amount>", "USDC amount as decimal string, e.g. 1.00")
  .action(async (amount: string) => {
    const c = client();
    const r = await c.deposit(amount);
    console.log(`Deposit tx: ${r.depositTxHash}`);
  });

program
  .command("buy")
  .description("Pay for an LLM stream via x402 + Gateway batched settlement")
  .option("--prompt <text>", "Prompt to send", "Explain why per-token on-chain billing needs Arc.")
  .option("--model <id>", "Model id", "gemini-3-flash-preview")
  .option("--max-usd <n>", "Max spend in USD", "0.05")
  .option("--server <url>", "Seller endpoint", "http://localhost:8787/stream")
  .action(async (opts) => {
    const c = client();
    const body = {
      prompt: opts.prompt,
      model: opts.model,
      maxUsd: Number(opts.maxUsd),
    };
    console.log(`Paying for ${opts.server}`);
    const result = await c.pay(opts.server, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`HTTP ${result.status} · paid ${result.formattedAmount} USDC · tx ${result.transaction || "(none)"}`);
    const data = result.data as { fullText?: string; tokenCount?: number; totalPaidUsd?: number };
    console.log(`\n${data.fullText ?? ""}\n`);
    console.log(
      `tokens: ${data.tokenCount ?? 0} · offchain paid: $${(data.totalPaidUsd ?? 0).toFixed(6)}`,
    );
  });

program
  .command("chain")
  .description("Run the agent-to-agent Pro→Flash demo via x402")
  .option("--prompt <text>", "Prompt", "Explain why per-token on-chain billing needs Arc.")
  .option("--max-usd <n>", "Max spend in USD", "0.10")
  .option("--server <url>", "Seller endpoint", "http://localhost:8787/chain")
  .action(async (opts) => {
    const c = client();
    const result = await c.pay(opts.server, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: opts.prompt, maxUsd: Number(opts.maxUsd) }),
    });
    console.log(`HTTP ${result.status} · paid ${result.formattedAmount} USDC · tx ${result.transaction || "(none)"}`);
    const data = result.data as {
      reasonerText?: string;
      drafterText?: string;
      reasonerTokens?: number;
      drafterTokens?: number;
    };
    console.log(`\n--- reasoner ---\n${data.reasonerText ?? ""}`);
    console.log(`\n--- drafter ---\n${data.drafterText ?? ""}`);
    console.log(`\nreasoner tokens: ${data.reasonerTokens ?? 0} · drafter tokens: ${data.drafterTokens ?? 0}`);
  });

program.parseAsync(process.argv);
