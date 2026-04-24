import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : undefined;

const MOCK_REPLY =
  "Arc lets you settle sub-cent USDC per token on chain. " +
  "Every word you see streaming right now is a real nanopayment. " +
  "Traditional gas would make this economically impossible. " +
  "Arc makes it viable.";

export async function* streamChat(model: string, prompt: string): AsyncGenerator<string> {
  if (!client) {
    for (const word of MOCK_REPLY.split(" ")) {
      await new Promise((r) => setTimeout(r, 60));
      yield word + " ";
    }
    return;
  }

  const generativeModel = client.getGenerativeModel({ model });
  const result = await generativeModel.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export function isMockMode(): boolean {
  return !client;
}
