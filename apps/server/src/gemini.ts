import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function* streamChat(model: string, prompt: string): AsyncGenerator<string> {
  const generativeModel = client.getGenerativeModel({ model });
  const result = await generativeModel.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
