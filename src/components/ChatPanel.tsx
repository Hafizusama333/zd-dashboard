"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboard } from "./DashboardProvider";

type Msg = { role: "ai" | "user"; text: string; time: string };

type ContextKey = "jobs" | "estimates" | "ar";

const labelMap: Record<ContextKey, { dept: string; sub: string; intro: string; placeholder: string }> = {
  jobs: {
    dept: "Jobs",
    sub: "Jobs & dispatch",
    intro: "I have access to your live job data. Ask about current jobs, dispatch, technician assignments, or job history.",
    placeholder: "Ask about jobs...",
  },
  estimates: {
    dept: "Estimates",
    sub: "Estimates & pricing",
    intro: "I can see your live estimate pipeline. Ask about win rates, follow-ups, or estimates that need attention.",
    placeholder: "Ask about estimates...",
  },
  ar: {
    dept: "AR",
    sub: "Accounts receivable",
    intro: "I can see your live AR data. I can draft collection emails, identify at-risk accounts, or analyze aging buckets.",
    placeholder: "Ask about receivables...",
  },
};

export default function ChatPanel({
  context,
  quickPrompts,
}: {
  context: ContextKey;
  quickPrompts: string[];
}) {
  const meta = labelMap[context];
  const { data } = useDashboard();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: meta.intro, time: "Live · AI" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [msgs]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMsgs((m) => [...m, { role: "user", text: trimmed, time: "Just now" }]);
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "ai", text: "Thinking...", time: "" }]);

    const ctxData = buildContext(context, data);
    const system = `You are a business intelligence assistant for ZD Maintenance, a property maintenance company. You have live HousecallPro data. Be concise, specific, and reference dollar amounts and numbers. Focus on: ${meta.sub}. Live data: ${ctxData}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, message: trimmed }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      const reply = json.reply || json.error || "No response.";
      setMsgs((m) => [...m.slice(0, -1), { role: "ai", text: reply, time: "Just now · AI" }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Chat error";
      setMsgs((m) => [...m.slice(0, -1), { role: "ai", text: `Error: ${err}`, time: "" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="ai-indicator" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>AI Consultant</div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>{meta.sub}</div>
        </div>
        <span className="chat-dept">{meta.dept}</span>
      </div>
      <div className="chat-messages" ref={scrollerRef}>
        {msgs.map((m, i) => (
          <div className={`msg ${m.role}`} key={i}>
            <div className={`bubble ${m.role}`}>
              {m.text.split("\n").map((line, j) => (
                <div key={j}>{line || " "}</div>
              ))}
            </div>
            {m.time && <div className="msg-time">{m.time}</div>}
          </div>
        ))}
      </div>
      <div className="quick-prompts">
        <div className="quick-label">Quick actions</div>
        {quickPrompts.map((q) => (
          <button key={q} className="qp-btn" onClick={() => void send(q)} disabled={busy}>
            {q} →
          </button>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder={meta.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(input);
          }}
          disabled={busy}
        />
        <button className="send-btn" onClick={() => void send(input)} disabled={busy}>
          <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function buildContext(ctx: ContextKey, data: ReturnType<typeof useDashboard>["data"]): string {
  if (!data) return "No live data loaded yet.";
  if (ctx === "jobs") {
    return `Jobs (${data.jobs.length} total): ${JSON.stringify(data.jobs.slice(0, 15))}`;
  }
  if (ctx === "estimates") {
    return `Estimates (${data.estimates.length}): ${JSON.stringify(data.estimates.slice(0, 15))}. KPIs: ${JSON.stringify(data.kpis)}`;
  }
  return `AR (${data.ar.length} unpaid): ${JSON.stringify(data.ar.slice(0, 15))}. Aging: ${JSON.stringify(data.aging)}. KPIs: ${JSON.stringify(data.kpis)}`;
}
