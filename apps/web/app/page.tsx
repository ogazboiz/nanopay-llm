"use client";
import { useRef, useState } from "react";

type Mode = "single" | "chain";

interface TxRow {
  role?: "reasoner" | "drafter";
  model?: string;
  tx: string;
  amount: number;
}

const EXPLORER = "https://testnet.arcscan.app";

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [prompt, setPrompt] = useState("Explain why per-token on-chain billing needs Arc.");
  const [output, setOutput] = useState("");
  const [chainOutput, setChainOutput] = useState({ reasoner: "", drafter: "" });
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const totalPaid = txs.reduce((sum, t) => sum + t.amount, 0);

  async function run() {
    setOutput("");
    setChainOutput({ reasoner: "", drafter: "" });
    setTxs([]);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const endpoint = mode === "single" ? "/api/stream" : "/api/chain";
      const body =
        mode === "single"
          ? { prompt, model: "gemini-3-flash", maxUsd: 0.05 }
          : { prompt, maxUsd: 0.1 };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));

          if (payload.done) continue;
          if (!payload.token) continue;

          if (mode === "single") {
            setOutput((prev) => prev + payload.token);
          } else {
            setChainOutput((prev) => ({
              ...prev,
              [payload.role]: (prev[payload.role as "reasoner" | "drafter"] ?? "") + payload.token,
            }));
          }

          const prevTotal = txs.reduce((s, t) => s + t.amount, 0);
          const amount = (payload.totalPaid ?? prevTotal) - prevTotal;
          setTxs((prev) => [
            ...prev,
            {
              role: payload.role,
              model: payload.model,
              tx: payload.tx,
              amount: amount > 0 ? amount : 0.00005,
            },
          ]);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "32px auto",
        padding: "0 24px",
        color: "#111",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>NanoPay LLM</h1>
        <span style={{ color: "#666", fontSize: 14 }}>per-token USDC billing on Arc</span>
      </header>
      <p style={{ color: "#555", marginTop: 0 }}>
        Every token settles as a sub-cent USDC nanopayment on{" "}
        <a href={EXPLORER} target="_blank" rel="noreferrer" style={{ color: "#0070f3" }}>
          Arc Testnet
        </a>
        . Stop reading, billing stops.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button
          onClick={() => setMode("single")}
          disabled={running}
          style={tabStyle(mode === "single")}
        >
          Single stream
        </button>
        <button
          onClick={() => setMode("chain")}
          disabled={running}
          style={tabStyle(mode === "chain")}
        >
          Agent chain (Pro → Flash)
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 14,
          borderRadius: 8,
          border: "1px solid #ddd",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={run} disabled={running} style={primaryButton}>
          {running ? "Streaming..." : "Stream"}
        </button>
        <button onClick={stop} disabled={!running} style={secondaryButton}>
          Stop
        </button>
      </div>

      {mode === "single" ? (
        <OutputPane title="Output" text={output} />
      ) : (
        <>
          <OutputPane title="Reasoner (Gemini 3 Pro)" text={chainOutput.reasoner} />
          <OutputPane title="Drafter (Gemini 3 Flash)" text={chainOutput.drafter} />
        </>
      )}

      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <Metric label="tokens" value={txs.length.toString()} />
        <Metric label="paid" value={`$${totalPaid.toFixed(6)}`} />
        <Metric label="on-chain txs" value={txs.length.toString()} />
      </div>

      {txs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Recent settlements (latest 10)
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          >
            {txs.slice(-10).reverse().map((t, i) => (
              <li
                key={i}
                style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}
              >
                {t.role && <span style={{ color: "#0070f3", width: 72 }}>{t.role}</span>}
                <a
                  href={`${EXPLORER}/tx/${t.tx}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#444", textDecoration: "none" }}
                >
                  {t.tx.slice(0, 10)}…{t.tx.slice(-6)}
                </a>
                <span style={{ marginLeft: "auto", color: "#666" }}>
                  ${t.amount.toFixed(6)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function OutputPane({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>{title}</div>
      <div
        style={{
          padding: 16,
          background: "#fafafa",
          border: "1px solid #eee",
          borderRadius: 8,
          minHeight: 80,
          whiteSpace: "pre-wrap",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {text || <span style={{ color: "#bbb" }}>Output streams here.</span>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: "#f7f7f7",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#333",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
});

const primaryButton: React.CSSProperties = {
  padding: "10px 18px",
  background: "#0070f3",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#333",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
