import { GoogleGenerativeAI, SchemaType, type Tool } from "@google/generative-ai";
import { GatewayClient } from "@circle-fin/x402-batching/client";

type Emit = (event: Record<string, unknown>) => void;

const apiKey = process.env.GEMINI_API_KEY;
const DEMO_KEY = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
const SERVER_URL = process.env.SELF_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_gateway_balance",
        description:
          "Returns the buyer's Circle Gateway USDC balance on Arc Testnet. Use this before paying for inference to confirm funds.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            _unused: {
              type: SchemaType.STRING,
              description: "Unused placeholder; required by the API schema.",
            },
          },
        },
      },
      {
        name: "deposit_usdc_to_gateway",
        description:
          "Deposits a given amount of USDC (decimal string, e.g. '1.00') from the buyer's EOA into the GatewayWallet on Arc Testnet. Use when Gateway balance is below what's needed for the task.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            amount: {
              type: SchemaType.STRING,
              description: "USDC amount as a decimal string, e.g. '1.00'",
            },
          },
          required: ["amount"],
        },
      },
      {
        name: "pay_for_inference",
        description:
          "Pays for a Gemini inference call via x402 + Circle Nanopayments. Authorizes up to maxUsd in USDC, returns the LLM response text and actual settlement.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            prompt: { type: SchemaType.STRING, description: "Prompt for the LLM" },
            maxUsd: {
              type: SchemaType.NUMBER,
              description: "Max spend in USD, e.g. 0.02",
            },
            model: {
              type: SchemaType.STRING,
              description: "Model id, default gemini-3-flash-preview",
            },
          },
          required: ["prompt", "maxUsd"],
        },
      },
    ],
  },
];

async function toolCall(
  name: string,
  args: Record<string, unknown>,
  emit: Emit,
): Promise<Record<string, unknown>> {
  if (!DEMO_KEY) return { error: "DEMO_BUYER_PRIVATE_KEY not set" };
  const client = new GatewayClient({ chain: "arcTestnet", privateKey: DEMO_KEY });

  emit({ type: "tool_call", name, args });

  if (name === "get_gateway_balance") {
    const b = await client.getBalances();
    const result = {
      available: b.gateway.formattedAvailable,
      withdrawing: b.gateway.withdrawing.toString(),
    };
    emit({ type: "tool_result", name, result });
    return result;
  }

  if (name === "deposit_usdc_to_gateway") {
    const r = await client.deposit(String(args.amount ?? "1"));
    const result = { depositTxHash: r.depositTxHash, amount: String(args.amount) };
    emit({ type: "tool_result", name, result });
    return result;
  }

  if (name === "pay_for_inference") {
    const payResult = await client.pay(`${SERVER_URL}/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: String(args.prompt ?? ""),
        maxUsd: Number(args.maxUsd ?? 0.02),
        model: String(args.model ?? "gemini-3-flash-preview"),
      }),
    });
    const data = payResult.data as { fullText?: string; tokenCount?: number; totalPaidUsd?: number };
    const result = {
      fullText: data.fullText?.slice(0, 800) ?? "",
      tokenCount: data.tokenCount ?? 0,
      totalPaidUsd: data.totalPaidUsd ?? 0,
      settlementTx: payResult.transaction,
      authorizedUsd: payResult.formattedAmount,
    };
    emit({ type: "tool_result", name, result });
    return result;
  }

  return { error: `Unknown tool: ${name}` };
}

export async function runAgent(
  { goal }: { goal: string },
  emit: Emit,
): Promise<void> {
  if (!apiKey) {
    emit({ error: "GEMINI_API_KEY not set" });
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    tools,
    systemInstruction:
      "You are a payments-aware AI agent running on Arc Testnet. Users give you a GOAL that may require Circle Gateway USDC. Your tools: get_gateway_balance, deposit_usdc_to_gateway, pay_for_inference. " +
      "Think step-by-step: check balance first, deposit if insufficient, then pay_for_inference to serve the user. Never over-authorize. Explain each decision briefly before calling a tool.",
  });

  emit({ type: "goal", goal });

  const chat = model.startChat();
  let next = await chat.sendMessage(goal);
  let hops = 0;
  const MAX_HOPS = 6;

  while (hops < MAX_HOPS) {
    hops++;
    const calls = next.response.functionCalls() ?? [];
    if (calls.length === 0) {
      const text = next.response.text();
      emit({ type: "final", text });
      return;
    }

    const responses = [];
    for (const call of calls) {
      const result = await toolCall(call.name, call.args as Record<string, unknown>, emit);
      responses.push({
        functionResponse: { name: call.name, response: result },
      });
    }
    next = await chat.sendMessage(responses);
  }

  emit({ type: "final", text: "Reached max hops. " + next.response.text() });
}
