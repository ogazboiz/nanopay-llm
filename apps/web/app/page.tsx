"use client";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  CircleDashed,
  Coins,
  Gauge,
  Hash,
  Loader2,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Square,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Markdown } from "../components/Markdown";

type Mode = "stream" | "chain" | "stress" | "agent";

interface Event {
  status?: string;
  type?: string;
  httpStatus?: number;
  http?: number;
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
  tokenCount?: number;
  totalPaidUsd?: number;
  error?: string;
  index?: number;
  of?: number;
  count?: number;
  successCount?: number;
  failCount?: number;
  elapsedMs?: number;
  totalUsd?: number;
  uniqueSettlements?: number;
  per_sec?: number;
  finalGatewayBalance?: string;
  settlements?: string[];
  name?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  goal?: string;
  text?: string;
  [k: string]: unknown;
}

const EXPLORER = "https://testnet.arcscan.app";
const SELLER = "0x8c13B1D1f6D2f93537E9E108b0A4Ec2a50C6621C";

const FLOW_STEPS = [
  { key: "balance", label: "Check balance" },
  { key: "call", label: "Call endpoint" },
  { key: "sign", label: "Sign EIP-3009" },
  { key: "verify", label: "Verify" },
  { key: "stream", label: "Stream tokens" },
  { key: "settle", label: "Settle" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("stream");
  const [prompt, setPrompt] = useState(
    "In 3 sentences, explain why per-token AI billing needs Circle Nanopayments on Arc.",
  );
  const [goal, setGoal] = useState(
    "Check my Gateway balance, top up if it's below $0.50, then pay for an inference call that explains Arc's stable fee design in 2 sentences.",
  );
  const [stressCount, setStressCount] = useState(50);
  const [events, setEvents] = useState<Event[]>([]);
  const [text, setText] = useState<{ single: string; reasoner: string; drafter: string; agent: string }>({
    single: "",
    reasoner: "",
    drafter: "",
    agent: "",
  });
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const tokensEmitted = events.filter((e) => e.token).length;
  const payment = events.find((e) => e.verified !== undefined);
  const paidEvent = events.find((e) => e.status === "x402 paid");
  const doneEvent =
    events.find((e) => e.status === "done") || events.find((e) => e.status === "stress_done");
  const totalPaidUsd =
    (doneEvent?.totalPaidUsd as number | undefined) ??
    (doneEvent?.totalUsd as number | undefined) ??
    events.reduce((s, e) => (e.totalPaid !== undefined ? (e.totalPaid as number) : s), 0);
  const balance = [...events].reverse().find((e) => e.available)?.available;
  const stressDone = events.find((e) => e.status === "stress_done");
  const stressAuths = events.filter((e) => e.status === "auth").length;
  const stressFails = events.filter((e) => e.status === "auth_failed").length;
  const stressSettlements = [
    ...new Set(events.filter((e) => e.status === "auth" && e.transaction).map((e) => e.transaction)),
  ];
  const maxSpend =
    mode === "chain" ? 0.1 :
    mode === "stress" ? stressCount * 0.01 :
    mode === "agent" ? 0.5 :
    0.05;
  const budgetUsed = Math.min(totalPaidUsd / maxSpend, 1);

  const activeStep = useMemo(() => {
    if (mode === "stress" || mode === "agent") return -1;
    const has = (m: string) => events.some((e) => e.status === m);
    if (doneEvent) return 5;
    if (tokensEmitted > 0) return 4;
    if (payment?.verified) return 3;
    if (has("x402 paid")) return 2;
    if (has("calling paid endpoint")) return 1;
    if (has("balance") || has("checking balance")) return 0;
    return -1;
  }, [events, tokensEmitted, payment, doneEvent, mode]);

  async function run() {
    setEvents([]);
    setText({ single: "", reasoner: "", drafter: "", agent: "" });
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const endpoint =
        mode === "stress" ? "/api/stress" :
        mode === "agent" ? "/api/agent" :
        "/api/run";

      const body =
        mode === "stress"
          ? { count: stressCount, prompt: "one word", maxUsdPerCall: 0.01 }
          : mode === "agent"
          ? { goal }
          : { endpoint: mode, prompt, maxUsd: maxSpend };

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
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const payload: Event = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, payload]);
            if (payload.token) {
              if (payload.role === "reasoner")
                setText((p) => ({ ...p, reasoner: p.reasoner + payload.token }));
              else if (payload.role === "drafter")
                setText((p) => ({ ...p, drafter: p.drafter + payload.token }));
              else setText((p) => ({ ...p, single: p.single + payload.token }));
            }
            if (payload.type === "final" && payload.text) {
              setText((p) => ({ ...p, agent: String(payload.text) }));
            }
          } catch {
            // skip
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
    <main className="relative min-h-screen">
      <TopBar running={running} />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-14 pb-24">
        <Hero />

        <div className="mt-12 grid lg:grid-cols-[1.35fr_1fr] gap-6">
          {/* LEFT */}
          <div className="space-y-5">
            <ModeTabs mode={mode} setMode={setMode} running={running} />

            {mode === "stress" ? (
              <StressControls
                running={running}
                count={stressCount}
                setCount={setStressCount}
                onRun={run}
                onStop={stop}
              />
            ) : mode === "agent" ? (
              <AgentControls
                goal={goal}
                setGoal={setGoal}
                running={running}
                onRun={run}
                onStop={stop}
              />
            ) : (
              <PromptCard
                prompt={prompt}
                setPrompt={setPrompt}
                running={running}
                maxSpend={maxSpend}
                onRun={run}
                onStop={stop}
              />
            )}

            {mode === "stream" && (
              <OutputCard
                title="Gemini 3 Flash"
                subtitle="single stream · one x402 authorization"
                model="gemini-3-flash-preview"
                text={text.single}
                running={running}
                accent="indigo"
                tokens={tokensEmitted}
              />
            )}

            {mode === "chain" && (
              <div className="space-y-0">
                <OutputCard
                  title="Gemini 3 Pro"
                  subtitle="reasoner · plans the outline"
                  model="gemini-3-pro-preview"
                  text={text.reasoner}
                  running={running && !text.drafter}
                  accent="cyan"
                  tokens={events.filter((e) => e.token && e.role === "reasoner").length}
                />
                <HandoffLine />
                <OutputCard
                  title="Gemini 3 Flash"
                  subtitle="drafter · expands the final answer"
                  model="gemini-3-flash-preview"
                  text={text.drafter}
                  running={running && text.reasoner.length > 0 && !doneEvent}
                  accent="pink"
                  tokens={events.filter((e) => e.token && e.role === "drafter").length}
                />
              </div>
            )}

            {mode === "stress" && (
              <StressOutput
                running={running}
                auths={stressAuths}
                fails={stressFails}
                target={stressCount}
                settlements={stressSettlements as string[]}
                summary={stressDone}
              />
            )}

            {mode === "agent" && (
              <AgentOutput text={text.agent} events={events} running={running} />
            )}
          </div>

          {/* RIGHT */}
          <aside className="space-y-5">
            <HeroMetric
              paid={totalPaidUsd}
              tokens={mode === "stress" ? stressAuths : tokensEmitted}
              running={running}
              budgetUsed={budgetUsed}
              maxSpend={maxSpend}
              mode={mode}
            />
            {(mode === "stream" || mode === "chain") && (
              <FlowTimeline activeStep={activeStep} running={running} />
            )}
            <PaymentCard payment={payment} paidEvent={paidEvent} balance={balance} />
            <ActivityFeed events={events} />
          </aside>
        </div>

        <Marquee />
        <Footer />
      </div>
    </main>
  );
}

function TopBar({ running }: { running: boolean }) {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-xl bg-black/40 border-b border-white/5">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-semibold tracking-tight">NanoPay LLM</span>
          <span className="hidden md:inline text-[10px] font-mono px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            Arc Testnet · 5042002
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <StatusPill label="Gateway" />
          <StatusPill label="Facilitator" />
          <StatusPill label={running ? "Streaming" : "Ready"} amber={running} />
          <a
            href="https://github.com/ogazboiz/nanopay-llm"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline text-neutral-500 hover:text-neutral-100 transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </nav>
  );
}

function Logo() {
  return (
    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-500 via-cyan-400 to-pink-500 flex items-center justify-center font-black text-xs text-white shadow-[0_0_24px_-6px] shadow-indigo-500/60">
      <span className="relative z-10">N</span>
      <div className="absolute inset-0 bg-black/30 mix-blend-multiply" />
    </div>
  );
}

function StatusPill({ label, amber }: { label: string; amber?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-neutral-300">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          amber ? "bg-amber-400" : "bg-emerald-400",
        )}
      >
        <span
          className={cn(
            "block w-full h-full rounded-full animate-ping opacity-60",
            amber ? "bg-amber-400" : "bg-emerald-400",
          )}
        />
      </span>
      {label}
    </span>
  );
}

function Hero() {
  return (
    <section>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300 mb-6 backdrop-blur-sm">
        <Sparkles size={12} className="text-indigo-400" />
        Agentic Economy on Arc · hackathon build
      </div>
      <h1 className="text-[64px] md:text-[96px] font-black tracking-[-0.04em] leading-[0.95]">
        Per-token USDC
        <br />
        <span className="inline-block bg-gradient-to-r from-indigo-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
          for AI inference.
        </span>
      </h1>
      <p className="mt-6 text-neutral-400 max-w-2xl text-base md:text-lg leading-relaxed">
        Every output token signs an offchain{" "}
        <span className="text-indigo-300 font-medium">EIP-3009</span> authorization.{" "}
        <span className="text-cyan-300 font-medium">Circle Gateway</span> batches them and settles
        on <span className="text-fuchsia-300 font-medium">Arc</span>. Stop reading, billing stops.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
        {["Circle Nanopayments", "x402", "Gateway", "EIP-3009", "ERC-8004", "Function Calling", "Gemini 3"].map((c) => (
          <span
            key={c}
            className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 hover:border-indigo-500/40 transition-colors"
          >
            {c}
          </span>
        ))}
      </div>
    </section>
  );
}

function ModeTabs({
  mode,
  setMode,
  running,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  running: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <TabButton
        active={mode === "stream"}
        onClick={() => setMode("stream")}
        disabled={running}
        icon={<Zap size={14} />}
        label="Single"
        sub="one x402"
      />
      <TabButton
        active={mode === "chain"}
        onClick={() => setMode("chain")}
        disabled={running}
        icon={<Bot size={14} />}
        label="Agent chain"
        sub="Pro → Flash"
      />
      <TabButton
        active={mode === "stress"}
        onClick={() => setMode("stress")}
        disabled={running}
        icon={<Gauge size={14} />}
        label="Stress"
        sub="50+ auths"
        highlight
      />
      <TabButton
        active={mode === "agent"}
        onClick={() => setMode("agent")}
        disabled={running}
        icon={<Brain size={14} />}
        label="Agent"
        sub="Function calling"
        highlight
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  icon,
  label,
  sub,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative overflow-hidden text-left p-3 rounded-xl border transition-all disabled:cursor-not-allowed group",
        active
          ? "bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/50 shadow-[0_0_32px_-12px] shadow-indigo-500/50"
          : highlight
          ? "bg-gradient-to-br from-white/[0.03] to-white/[0.02] border-white/10 hover:border-indigo-400/40 hover:bg-white/[0.05]"
          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]",
      )}
    >
      {active && (
        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
      )}
      {highlight && !active && (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 uppercase tracking-wider">
          new
        </span>
      )}
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span className={active ? "text-indigo-300" : "text-neutral-400"}>{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>
    </button>
  );
}

function PromptCard({
  prompt,
  setPrompt,
  running,
  maxSpend,
  onRun,
  onStop,
}: {
  prompt: string;
  setPrompt: (p: string) => void;
  running: boolean;
  maxSpend: number;
  onRun: () => void;
  onStop: () => void;
}) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.02] border border-white/10 p-5 backdrop-blur-sm noise overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-mono text-neutral-500 uppercase tracking-[0.15em]">
          Prompt
        </label>
        <span className="text-[11px] font-mono text-neutral-500">
          max · ${maxSpend.toFixed(2)}
        </span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        disabled={running}
        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none font-sans disabled:opacity-60"
        placeholder="Ask Gemini something..."
      />
      <RunBar running={running} onRun={onRun} onStop={onStop} label="Pay & Stream" />
    </div>
  );
}

function StressControls({
  running,
  count,
  setCount,
  onRun,
  onStop,
}: {
  running: boolean;
  count: number;
  setCount: (n: number) => void;
  onRun: () => void;
  onStop: () => void;
}) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-fuchsia-500/5 to-white/[0.02] border border-fuchsia-500/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Gauge size={14} className="text-fuchsia-300" />
        <span className="text-[11px] font-mono text-fuchsia-200 uppercase tracking-[0.15em]">
          Stress Mode
        </span>
      </div>
      <p className="text-sm text-neutral-400 mb-4">
        Fire <span className="text-fuchsia-200 font-medium">N sequential x402 authorizations</span>,
        each drawing from your Gateway balance. Proves the hackathon's 50+ transaction requirement
        and demonstrates batched settlement at scale.
      </p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[10, 50, 100, 200].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            disabled={running}
            className={cn(
              "px-3 py-2 rounded-lg text-[13px] font-mono transition-all",
              count === n
                ? "bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-100 shadow-[0_0_16px_-4px] shadow-fuchsia-500/50"
                : "bg-white/[0.03] border border-white/10 text-neutral-400 hover:border-white/20",
            )}
          >
            × {n}
          </button>
        ))}
      </div>
      <div className="text-[11px] font-mono text-neutral-500 mb-3">
        {count} × $0.01 max = up to ${(count * 0.01).toFixed(2)} total authorized · 100% refundable if
        unused
      </div>
      <RunBar
        running={running}
        onRun={onRun}
        onStop={onStop}
        label={`Fire ${count} x402 authorizations`}
      />
    </div>
  );
}

function AgentControls({
  goal,
  setGoal,
  running,
  onRun,
  onStop,
}: {
  goal: string;
  setGoal: (s: string) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-cyan-500/5 to-white/[0.02] border border-cyan-500/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={14} className="text-cyan-300" />
        <span className="text-[11px] font-mono text-cyan-200 uppercase tracking-[0.15em]">
          Gemini Function Calling
        </span>
      </div>
      <p className="text-sm text-neutral-400 mb-4">
        Give Gemini 3 Pro a <span className="text-cyan-200 font-medium">goal</span>. It decides
        autonomously when to <code className="text-cyan-200">get_gateway_balance</code>,{" "}
        <code className="text-cyan-200">deposit_usdc_to_gateway</code>, and{" "}
        <code className="text-cyan-200">pay_for_inference</code>. Multi-step Circle-aware agent.
      </p>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        disabled={running}
        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none font-sans disabled:opacity-60"
      />
      <RunBar running={running} onRun={onRun} onStop={onStop} label="Run agent" />
    </div>
  );
}

function RunBar({
  running,
  onRun,
  onStop,
  label,
}: {
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  label: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      <button
        onClick={onRun}
        disabled={running}
        className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 hover:from-indigo-300 hover:via-indigo-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-[0_8px_40px_-8px] shadow-indigo-500/60 transition-all"
      >
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative flex items-center gap-2">
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Running
            </>
          ) : (
            <>
              <Play size={14} />
              {label}
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </span>
      </button>
      <button
        onClick={onStop}
        disabled={!running}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-neutral-300 border border-white/10 transition-colors"
      >
        <Square size={12} />
        Stop
      </button>
      <div className="ml-auto hidden md:flex text-[11px] font-mono text-neutral-500 items-center gap-1.5">
        <ShieldCheck size={11} className="text-emerald-400" />
        gasless · batched · sub-cent
      </div>
    </div>
  );
}

function OutputCard({
  title,
  subtitle,
  model,
  text,
  running,
  accent,
  tokens,
}: {
  title: string;
  subtitle: string;
  model: string;
  text: string;
  running: boolean;
  accent: "indigo" | "cyan" | "pink";
  tokens: number;
}) {
  const accents = {
    indigo: {
      ring: "border-indigo-500/30",
      glow: "shadow-[0_0_60px_-20px] shadow-indigo-500/40",
      pill: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
      dot: "bg-indigo-400",
      live: "from-indigo-500/10 to-transparent",
    },
    cyan: {
      ring: "border-cyan-500/30",
      glow: "shadow-[0_0_60px_-20px] shadow-cyan-500/40",
      pill: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
      dot: "bg-cyan-400",
      live: "from-cyan-500/10 to-transparent",
    },
    pink: {
      ring: "border-pink-500/30",
      glow: "shadow-[0_0_60px_-20px] shadow-pink-500/40",
      pill: "bg-pink-500/15 text-pink-200 border-pink-500/30",
      dot: "bg-pink-400",
      live: "from-pink-500/10 to-transparent",
    },
  }[accent];

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm",
        accents.ring,
        running ? cn(accents.glow, "live-border") : "",
      )}
    >
      <div
        className={cn(
          "px-5 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r",
          accents.live,
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full", accents.dot, running && "animate-pulse")} />
          <div>
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            <div className="text-[11px] font-mono text-neutral-500 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn("hidden md:inline text-[10px] font-mono px-2 py-0.5 rounded-full border", accents.pill)}
          >
            {model}
          </span>
          {running && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300">
              <Radio size={10} className="animate-pulse" />
              LIVE
            </span>
          )}
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span className="text-neutral-500">tokens</span>
            <span className="tabular-nums font-semibold">{tokens}</span>
          </div>
        </div>
      </div>
      <div className="relative p-5 min-h-[140px] bg-black/30">
        {text ? (
          <div>
            <Markdown text={text} />
            {running && <Caret />}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", accents.dot)} />
            {running ? "Waiting on first token..." : "Output will stream here."}
          </div>
        )}
      </div>
    </div>
  );
}

function StressOutput({
  running,
  auths,
  fails,
  target,
  settlements,
  summary,
}: {
  running: boolean;
  auths: number;
  fails: number;
  target: number;
  settlements: string[];
  summary?: Event;
}) {
  const pct = Math.min((auths / target) * 100, 100);
  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-500/5 to-transparent overflow-hidden">
      <div className="px-5 py-3 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge size={14} className={cn("text-fuchsia-300", running && "animate-pulse")} />
          <div>
            <div className="text-sm font-semibold">x402 Stress Test</div>
            <div className="text-[11px] font-mono text-neutral-500">
              {auths} / {target} authorizations · {fails} failed
            </div>
          </div>
        </div>
        {running && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-fuchsia-300">
            <Radio size={10} className="animate-pulse" />
            firing
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <BigStat label="Success" value={auths.toString()} tone="indigo" />
          <BigStat label="Failed" value={fails.toString()} tone={fails > 0 ? "red" : "neutral"} />
          <BigStat
            label="Settlements"
            value={settlements.length.toString()}
            tone="emerald"
          />
          <BigStat
            label="Rate"
            value={summary?.per_sec ? `${Number(summary.per_sec).toFixed(1)}/s` : "—"}
            tone="amber"
          />
        </div>

        {summary && (
          <div className="rounded-xl bg-black/40 border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300 uppercase tracking-wider mb-2">
              <CheckCircle2 size={12} />
              Stress complete
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 text-[12px] font-mono">
              <span className="text-neutral-500">Total authorized</span>
              <span className="text-emerald-200 text-right">
                ${Number(summary.totalUsd ?? 0).toFixed(6)}
              </span>
              <span className="text-neutral-500">Unique settlement txs</span>
              <span className="text-emerald-200 text-right">{summary.uniqueSettlements as number}</span>
              <span className="text-neutral-500">Elapsed</span>
              <span className="text-emerald-200 text-right">
                {((summary.elapsedMs as number) / 1000).toFixed(1)}s
              </span>
              <span className="text-neutral-500">Gateway balance after</span>
              <span className="text-emerald-200 text-right">
                {summary.finalGatewayBalance as string} USDC
              </span>
            </div>
          </div>
        )}

        {settlements.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
              Settlement tx hashes (first 10 of {settlements.length})
            </div>
            <div className="thin-scroll max-h-[160px] overflow-y-auto space-y-1">
              {settlements.slice(0, 20).map((tx, i) => (
                <a
                  key={tx + i}
                  href={`${EXPLORER}/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition-colors px-2 py-1 rounded hover:bg-white/[0.03]"
                >
                  <Hash size={11} />
                  {String(tx).slice(0, 18)}…{String(tx).slice(-10)}
                  <ArrowUpRight size={10} className="ml-auto opacity-60" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentOutput({ text, events, running }: { text: string; events: Event[]; running: boolean }) {
  const toolCalls = events.filter((e) => e.type === "tool_call" || e.type === "tool_result");
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-transparent overflow-hidden">
      <div className="px-5 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={14} className={cn("text-cyan-300", running && "animate-pulse")} />
          <div>
            <div className="text-sm font-semibold">Function-calling Agent</div>
            <div className="text-[11px] font-mono text-neutral-500">
              Gemini 3 Pro Preview · {toolCalls.filter((e) => e.type === "tool_call").length}{" "}
              tool calls
            </div>
          </div>
        </div>
        {running && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300">
            <Radio size={10} className="animate-pulse" />
            thinking
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {toolCalls.length > 0 && (
          <ol className="space-y-2">
            {toolCalls.map((e, i) => (
              <ToolCallRow key={i} e={e} />
            ))}
          </ol>
        )}
        {text && (
          <div className="rounded-xl bg-black/40 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-300 uppercase tracking-wider mb-2">
              <CheckCircle2 size={12} />
              Final answer
            </div>
            <Markdown text={text} />
          </div>
        )}
        {!text && !running && toolCalls.length === 0 && (
          <div className="text-sm text-neutral-500 italic">
            Click &quot;Run agent&quot; to start. Gemini will decide which Circle APIs to call.
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallRow({ e }: { e: Event }) {
  const isCall = e.type === "tool_call";
  return (
    <li
      className={cn(
        "rounded-lg border p-3 text-[12px] font-mono",
        isCall
          ? "bg-cyan-500/5 border-cyan-500/20"
          : "bg-emerald-500/5 border-emerald-500/20",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {isCall ? (
          <Wrench size={11} className="text-cyan-300" />
        ) : (
          <CheckCircle2 size={11} className="text-emerald-300" />
        )}
        <span className={isCall ? "text-cyan-200" : "text-emerald-200"}>
          {isCall ? "call" : "result"}
        </span>
        <span className="text-neutral-300 font-semibold">{e.name as string}</span>
      </div>
      <pre className="text-[11px] text-neutral-400 whitespace-pre-wrap break-all">
        {JSON.stringify(isCall ? e.args : e.result, null, 2)}
      </pre>
    </li>
  );
}

function Caret() {
  return (
    <span className="inline-block w-[8px] h-[18px] bg-indigo-400 align-text-bottom ml-0.5 animate-pulse translate-y-0.5" />
  );
}

function HandoffLine() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 -my-px relative">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 px-3 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur">
        <ArrowRight size={10} className="text-pink-300" />
        new x402 payment
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent" />
    </div>
  );
}

function HeroMetric({
  paid,
  tokens,
  running,
  budgetUsed,
  maxSpend,
  mode,
}: {
  paid: number;
  tokens: number;
  running: boolean;
  budgetUsed: number;
  maxSpend: number;
  mode: Mode;
}) {
  const title =
    mode === "stress"
      ? "Authorized this run"
      : mode === "agent"
      ? "Paid by agent"
      : "Paid this run";
  const unit =
    mode === "stress" ? "x402 auths" : mode === "agent" ? "tool calls" : "tokens";
  return (
    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-transparent p-5 overflow-hidden noise">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-500">
          {title}
        </span>
        <span className="text-[10px] font-mono text-neutral-500">
          max ${maxSpend.toFixed(2)}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl md:text-5xl font-black tracking-tight tabular-nums text-white">
          ${paid.toFixed(6)}
        </span>
        <span className="text-sm font-mono text-neutral-500">USDC</span>
      </div>

      <div className="mt-4 relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${budgetUsed * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        {running && (
          <div className="absolute inset-y-0 h-full w-12 bg-white/30 blur-md ping-line" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
        <MiniStat label={unit} value={tokens.toString()} icon={<Hash size={11} />} />
        <MiniStat
          label="Budget used"
          value={`${(budgetUsed * 100).toFixed(1)}%`}
          icon={<Coins size={11} />}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums">{value}</div>
    </div>
  );
}

function BigStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "amber" | "red" | "neutral";
}) {
  const color = {
    indigo: "text-indigo-200",
    emerald: "text-emerald-200",
    amber: "text-amber-200",
    red: "text-red-300",
    neutral: "text-neutral-200",
  }[tone];
  return (
    <div className="rounded-lg bg-black/40 border border-white/5 p-3 text-center">
      <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={cn("mt-1 text-xl font-black tabular-nums", color)}>{value}</div>
    </div>
  );
}

function FlowTimeline({ activeStep, running }: { activeStep: number; running: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-500">
          x402 flow
        </span>
        <span className="text-[10px] font-mono text-neutral-500">
          step {Math.max(0, activeStep + 1)} / {FLOW_STEPS.length}
        </span>
      </div>
      <ol className="relative space-y-2.5 pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-white/10" />
        {FLOW_STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep && running;
          const pending = i > activeStep;
          return (
            <li key={step.key} className="relative flex items-center gap-3">
              <div
                className={cn(
                  "absolute -left-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-colors",
                  done && "bg-emerald-400 border-emerald-400",
                  active &&
                    "bg-indigo-400 border-indigo-300 shadow-[0_0_12px] shadow-indigo-400/80 animate-pulse",
                  pending && "bg-neutral-800 border-neutral-700",
                )}
              />
              <span
                className={cn(
                  "text-[12px] font-mono",
                  done && "text-emerald-200",
                  active && "text-indigo-200",
                  pending && "text-neutral-500",
                )}
              >
                {step.label}
              </span>
              {active && (
                <span className="ml-auto text-[10px] font-mono text-indigo-300 flex items-center gap-1">
                  <Radio size={9} className="animate-pulse" />
                  running
                </span>
              )}
              {done && <CheckCircle2 size={12} className="ml-auto text-emerald-400" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PaymentCard({
  payment,
  paidEvent,
  balance,
}: {
  payment?: Event;
  paidEvent?: Event;
  balance?: string;
}) {
  const verified = Boolean(payment?.verified);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className={verified ? "text-emerald-400" : "text-neutral-500"} />
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-400">
            x402 Payment
          </span>
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-500">
            idle
          </span>
        )}
      </div>
      <div className="space-y-2 text-[11px]">
        <Row label="Payer" value={payment?.payer ? short(String(payment.payer)) : "—"} mono />
        <Row label="Seller" value={short(SELLER)} mono />
        <Row
          label="Amount"
          value={paidEvent?.amount ? `${paidEvent.amount} USDC` : "—"}
          mono
          accent={paidEvent?.amount ? "indigo" : undefined}
        />
        <Row
          label="Network"
          value={payment?.network ? String(payment.network) : "eip155:5042002"}
          mono
        />
        <Row
          label="Gateway bal"
          value={balance ? `${balance} USDC` : "—"}
          mono
          accent={balance ? "emerald" : undefined}
        />
      </div>
      <a
        href={`${EXPLORER}/address/${SELLER}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono text-indigo-200 transition-colors group"
      >
        View seller on Arcscan
        <ArrowUpRight
          size={12}
          className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
        />
      </a>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "indigo" | "emerald";
}) {
  const color =
    accent === "indigo"
      ? "text-indigo-200"
      : accent === "emerald"
      ? "text-emerald-200"
      : "text-neutral-100";
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span className={cn(mono ? "font-mono" : "", color)}>{value}</span>
    </div>
  );
}

function ActivityFeed({ events }: { events: Event[] }) {
  const rows = useMemo(() => {
    return events
      .filter(
        (e) =>
          e.status ||
          e.type ||
          e.error ||
          e.verified !== undefined ||
          e.transaction ||
          e.httpStatus ||
          e.tx,
      )
      .slice(-15)
      .reverse();
  }, [events]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-indigo-400" />
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-400">
            Live feed
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-500">
          {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="thin-scroll max-h-[360px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-neutral-600">
            <Activity size={16} className="mx-auto mb-2 opacity-40" />
            Events will appear here once you run the demo.
          </div>
        ) : (
          <ul className="relative">
            <div className="absolute left-[22px] top-2 bottom-2 w-px bg-white/5" />
            <AnimatePresence initial={false}>
              {rows.map((e, i) => (
                <FeedRow key={`${i}-${String(e.transaction ?? e.payer ?? e.status ?? e.type ?? i)}`} e={e} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function FeedRow({ e }: { e: Event }) {
  let icon = <CircleDashed size={10} />;
  let iconColor = "text-neutral-500";
  let dotColor = "bg-neutral-600";
  let label = "";
  let tone = "text-neutral-400";

  if (e.error) {
    iconColor = "text-red-400";
    dotColor = "bg-red-500";
    label = `error · ${e.error}`;
    tone = "text-red-300";
  } else if (e.type === "tool_call") {
    icon = <Wrench size={10} />;
    iconColor = "text-cyan-300";
    dotColor = "bg-cyan-500";
    label = `call · ${e.name}`;
    tone = "text-cyan-200";
  } else if (e.type === "tool_result") {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-emerald-300";
    dotColor = "bg-emerald-500";
    label = `result · ${e.name}`;
    tone = "text-emerald-200";
  } else if (e.status === "auth") {
    icon = <Coins size={10} />;
    iconColor = "text-fuchsia-300";
    dotColor = "bg-fuchsia-500";
    label = `auth #${e.index}/${e.of} · ${e.amount} USDC · HTTP ${e.http}`;
    tone = "text-fuchsia-200";
  } else if (e.status === "auth_failed") {
    iconColor = "text-red-400";
    dotColor = "bg-red-500";
    label = `auth #${e.index} failed`;
    tone = "text-red-300";
  } else if (e.status === "stress_done") {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-emerald-300";
    dotColor = "bg-emerald-500";
    label = `stress done · ${e.successCount}/${e.count} · $${Number(e.totalUsd ?? 0).toFixed(6)}`;
    tone = "text-emerald-300";
  } else if (e.verified !== undefined) {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-emerald-400";
    dotColor = "bg-emerald-500";
    label = `verified · ${short(String(e.payer ?? ""))} · ${String(e.amount ?? "")}`;
    tone = "text-emerald-200";
  } else if (e.status === "x402 paid") {
    icon = <Coins size={10} />;
    iconColor = "text-indigo-300";
    dotColor = "bg-indigo-500";
    label = `x402 paid · ${e.amount} USDC · HTTP ${e.httpStatus}`;
    tone = "text-indigo-200";
  } else if (e.status === "calling paid endpoint") {
    icon = <ArrowRight size={10} />;
    iconColor = "text-indigo-300";
    dotColor = "bg-indigo-500";
    label = `calling ${String(e.url ?? "").replace("http://localhost:8787", "")}`;
  } else if (e.status === "deposited") {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-amber-300";
    dotColor = "bg-amber-500";
    label = `deposited · ${short(String(e.tx ?? ""))}`;
    tone = "text-amber-200";
  } else if (e.status === "depositing") {
    icon = <Wallet size={10} />;
    iconColor = "text-amber-300";
    dotColor = "bg-amber-500";
    label = `depositing ${e.amount} USDC to Gateway`;
    tone = "text-amber-200";
  } else if (e.status === "checking balance") {
    icon = <Wallet size={10} />;
    iconColor = "text-neutral-400";
    dotColor = "bg-neutral-500";
    label = "checking Gateway balance";
  } else if (e.status === "balance") {
    icon = <Wallet size={10} />;
    iconColor = "text-emerald-300";
    dotColor = "bg-emerald-500";
    label = `balance · ${e.available} USDC`;
    tone = "text-emerald-200";
  } else if (e.status === "done") {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-emerald-300";
    dotColor = "bg-emerald-500";
    label = `done · ${e.tokenCount} tokens · $${Number(e.totalPaidUsd ?? 0).toFixed(6)}`;
    tone = "text-emerald-300";
  } else if (e.status) {
    label = String(e.status);
  } else if (e.type === "goal") {
    icon = <Brain size={10} />;
    iconColor = "text-cyan-300";
    dotColor = "bg-cyan-500";
    label = `goal · ${String(e.goal).slice(0, 80)}`;
    tone = "text-cyan-200";
  } else if (e.type === "final") {
    icon = <CheckCircle2 size={10} />;
    iconColor = "text-emerald-300";
    dotColor = "bg-emerald-500";
    label = "agent final answer";
    tone = "text-emerald-300";
  } else {
    label = JSON.stringify(e).slice(0, 80);
  }

  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex items-center gap-3 px-5 py-2 text-[11px] font-mono group hover:bg-white/[0.02] transition-colors"
    >
      <div className="relative z-10 flex items-center justify-center w-4 h-4 rounded-full bg-black ring-2 ring-black">
        <span className={cn("w-2 h-2 rounded-full", dotColor)} />
      </div>
      <span className={cn("flex-1 truncate", tone)}>{label}</span>
      <span className={iconColor}>{icon}</span>
    </motion.li>
  );
}

function Marquee() {
  return (
    <section className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6 relative overflow-hidden">
      <div className="relative grid md:grid-cols-3 gap-5">
        <Fact
          label="Ethereum settlement"
          value="~$2.00"
          sub="per tx · gas cost"
          tone="red"
        />
        <Fact
          label="Per-token value"
          value="$0.00005"
          sub="Gemini 3 Flash output token"
          tone="neutral"
        />
        <Fact
          label="Ratio"
          value="40,000×"
          sub="settlement cost to value — dead model"
          tone="amber"
        />
      </div>
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-transparent border border-indigo-500/20">
        <div className="text-[11px] font-mono text-indigo-300 uppercase tracking-[0.15em] mb-1">
          What Arc + Nanopayments unlock
        </div>
        <div className="text-sm text-neutral-200 leading-relaxed">
          Batched settlement turns 500 signed authorizations into{" "}
          <span className="text-indigo-200 font-medium">one onchain tx</span>. Sub-cent USDC fees,
          sub-second finality. Per-token billing becomes economically real.
        </div>
      </div>
    </section>
  );
}

function Fact({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "red" | "neutral" | "amber";
}) {
  const colors = {
    red: "text-red-300",
    neutral: "text-white",
    amber: "text-amber-300",
  }[tone];
  return (
    <div className="rounded-xl bg-black/40 border border-white/5 p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </div>
      <div className={cn("mt-2 text-3xl font-black tracking-tight", colors)}>{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-14 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-neutral-500">
      <div className="flex items-center gap-2">
        <Logo />
        <span>Seller {short(SELLER)}</span>
      </div>
      <div className="flex items-center gap-4">
        <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
          Arcscan ↗
        </a>
        <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
          Faucet ↗
        </a>
        <a
          href="https://developers.circle.com/gateway/nanopayments"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors"
        >
          Nanopayments docs ↗
        </a>
      </div>
    </footer>
  );
}

function short(s: string) {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}
