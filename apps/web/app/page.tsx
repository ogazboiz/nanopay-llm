"use client";
import { useRef, useState } from "react";

type Mode = "stream" | "chain";

interface Event {
  status?: string;
  httpStatus?: number;
  url?: string;
  available?: string;
  tx?: string;
  verified?: boolean;
  payer?: string;
  amount?: string;
  network?: string;
  transaction?: string;
  token?: string;
  role?: "reasoner" | "drafter";
  model?: string;
  totalPaid?: number;
  error?: string;
  [k: string]: unknown;
}

const EXPLORER = "https://testnet.arcscan.app";

export default function Home() {
  const [mode, setMode] = useState<Mode>("stream");
  const [prompt, setPrompt] = useState(
    "Explain why per-token on-chain billing needs Circle Nanopayments on Arc.",
  );
  const [events, setEvents] = useState<Event[]>([]);
  const [text, setText] = useState<{ single: string; reasoner: string; drafter: string }>({
    single: "",
    reasoner: "",
    drafter: "",
  });
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const txs = events.filter((e) => e.tx || e.transaction);
  const totalPaid = events.reduce(
    (s, e) => (e.totalPaid !== undefined ? e.totalPaid : s),
    0,
  );
  const tokensEmitted = events.filter((e) => e.token).length;
  const payment = events.find((e) => e.verified !== undefined);
  const settlementTx = payment?.transaction;

  async function run() {
    setEvents([]);
    setText({ single: "", reasoner: "", drafter: "" });
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: mode, prompt, maxUsd: mode === "chain" ? 0.1 : 0.05 }),
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
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const payload: Event = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, payload]);
            if (payload.token) {
              if (payload.role === "reasoner") {
                setText((p) => ({ ...p, reasoner: p.reasoner + payload.token }));
              } else if (payload.role === "drafter") {
                setText((p) => ({ ...p, drafter: p.drafter + payload.token }));
              } else {
                setText((p) => ({ ...p, single: p.single + payload.token }));
              }
            }
          } catch {
            // skip non-JSON
          }
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
    <main style={{ maxWidth: 960, margin: "32px auto", padding: "0 24px", color: "#111" }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>NanoPay LLM</h1>
        <p style={{ color: "#555", marginTop: 6 }}>
          Per-token USDC billing for AI inference. Payments settle via{" "}
          <b>Circle Nanopayments</b> on{" "}
          <a href={EXPLORER} target="_blank" rel="noreferrer" style={{ color: "#0070f3" }}>
            Arc Testnet
          </a>
          . Buyer signs one offchain x402 authorization. Circle Gateway batches and settles onchain.
        </p>
      </header>

      <Flow />

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button onClick={() => setMode("stream")} disabled={running} style={tab(mode === "stream")}>
          Single stream
        </button>
        <button onClick={() => setMode("chain")} disabled={running} style={tab(mode === "chain")}>
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
        <button onClick={run} disabled={running} style={primary}>
          {running ? "Running demo..." : "Run demo (buyer → x402 → seller)"}
        </button>
        <button onClick={stop} disabled={!running} style={secondary}>
          Stop
        </button>
      </div>

      {mode === "stream" ? (
        <OutputPane title="Output" text={text.single} />
      ) : (
        <>
          <OutputPane title="Reasoner (Gemini 3 Pro)" text={text.reasoner} />
          <OutputPane title="Drafter (Gemini 3 Flash)" text={text.drafter} />
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
        <Metric label="tokens" value={tokensEmitted.toString()} />
        <Metric label="paid" value={`$${totalPaid.toFixed(6)}`} />
        <Metric
          label="settlement"
          value={
            settlementTx ? `${settlementTx.slice(0, 10)}...` : payment?.verified ? "verified" : "-"
          }
        />
      </div>

      <EventsList events={events} />
    </main>
  );
}

function Flow() {
  return (
    <div
      style={{
        padding: "10px 14px",
        border: "1px dashed #ddd",
        borderRadius: 8,
        fontSize: 13,
        color: "#666",
        marginTop: 6,
      }}
    >
      Buyer signs <b>EIP-3009</b> (zero gas) → seller verifies → tokens stream → Circle Gateway{" "}
      <b>batches settlement</b> on Arc.
    </div>
  );
}

function EventsList({ events }: { events: Event[] }) {
  const rows = events
    .filter((e) => e.status || e.httpStatus || e.verified !== undefined || e.transaction || e.error)
    .slice(-8);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
        x402 flow events
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
        {rows.map((e, i) => {
          let label = "";
          if (e.error) label = `error: ${e.error}`;
          else if (e.verified !== undefined)
            label = `payment verified · payer ${String(e.payer).slice(0, 10)}… · ${e.amount} units · ${e.network}`;
          else if (e.transaction) label = `settlement tx ${String(e.transaction).slice(0, 20)}…`;
          else if (e.status) label = e.status + (e.available ? ` · ${e.available} USDC` : "");
          else if (e.httpStatus) label = `HTTP ${e.httpStatus}`;
          return (
            <li
              key={i}
              style={{
                padding: "4px 0",
                borderBottom: "1px solid #f0f0f0",
                color: e.error ? "#c00" : "#333",
              }}
            >
              {label}
            </li>
          );
        })}
      </ul>
    </div>
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
      <div
        style={{
          fontSize: 12,
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

const tab = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#333",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
});

const primary: React.CSSProperties = {
  padding: "10px 18px",
  background: "#0070f3",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const secondary: React.CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#333",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
