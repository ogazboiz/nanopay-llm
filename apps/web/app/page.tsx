"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [tokens, setTokens] = useState(0);
  const [paid, setPaid] = useState(0);

  async function run() {
    setOutput("");
    setTokens(0);
    setPaid(0);

    const res = await fetch("/api/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, model: "gemini-3-flash", maxUsd: 0.05 }),
    });

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.token) setOutput((p) => p + payload.token);
        if (payload.totalPaid !== undefined) {
          setPaid(payload.totalPaid);
          setTokens((t) => t + 1);
        }
      }
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>NanoPay LLM</h1>
      <p style={{ color: "#666" }}>Per-token USDC billing on Arc.</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask something..."
        rows={4}
        style={{ width: "100%", padding: 12, fontSize: 14 }}
      />
      <button
        onClick={run}
        style={{ marginTop: 12, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
      >
        Stream
      </button>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f5f5f5",
          borderRadius: 8,
          minHeight: 120,
          whiteSpace: "pre-wrap",
        }}
      >
        {output || <span style={{ color: "#aaa" }}>Output will stream here.</span>}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 24, fontFamily: "monospace" }}>
        <div>tokens: {tokens}</div>
        <div>paid: ${paid.toFixed(6)}</div>
        <div>txs: {tokens}</div>
      </div>
    </main>
  );
}
