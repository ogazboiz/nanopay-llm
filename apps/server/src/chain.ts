import { streamChat } from "./gemini.js";
import { openStream, closeStream, billToken } from "./billing.js";

export interface ChainStep {
  model: string;
  role: "reasoner" | "drafter";
  userWallet: `0x${string}`;
  maxUsd: number;
}

export interface ChainEvent {
  role: ChainStep["role"];
  model: string;
  token?: string;
  tx?: `0x${string}`;
  totalPaid?: number;
  streamId?: string;
  done?: boolean;
}

export async function* runAgentChain(
  prompt: string,
  steps: ChainStep[],
): AsyncGenerator<ChainEvent> {
  const reasoner = steps.find((s) => s.role === "reasoner");
  const drafter = steps.find((s) => s.role === "drafter");
  if (!reasoner || !drafter) throw new Error("Chain requires reasoner and drafter");

  const reasonerStream = await openStream({
    userWallet: reasoner.userWallet,
    model: reasoner.model,
    maxUsd: reasoner.maxUsd,
  });

  let reasonerOutput = "";
  try {
    const reasonerPrompt = `You are a planner. Given the user request, produce a concise outline the drafter agent will expand.\n\nRequest: ${prompt}`;
    for await (const token of streamChat(reasoner.model, reasonerPrompt)) {
      const tx = await billToken(reasonerStream, token);
      reasonerOutput += token;
      yield {
        role: "reasoner",
        model: reasoner.model,
        token,
        tx: tx.hash,
        totalPaid: tx.totalPaid,
        streamId: reasonerStream,
      };
    }
  } finally {
    await closeStream(reasonerStream);
    yield { role: "reasoner", model: reasoner.model, streamId: reasonerStream, done: true };
  }

  const drafterStream = await openStream({
    userWallet: drafter.userWallet,
    model: drafter.model,
    maxUsd: drafter.maxUsd,
  });

  try {
    const drafterPrompt = `You are a drafter. Expand the outline into a final answer.\n\nOutline:\n${reasonerOutput}\n\nOriginal request: ${prompt}`;
    for await (const token of streamChat(drafter.model, drafterPrompt)) {
      const tx = await billToken(drafterStream, token);
      yield {
        role: "drafter",
        model: drafter.model,
        token,
        tx: tx.hash,
        totalPaid: tx.totalPaid,
        streamId: drafterStream,
      };
    }
  } finally {
    await closeStream(drafterStream);
    yield { role: "drafter", model: drafter.model, streamId: drafterStream, done: true };
  }
}
