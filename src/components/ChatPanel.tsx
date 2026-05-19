"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import type { DashboardData } from "@/lib/types";

type Msg = { role: "ai" | "user"; text: string; time: string };

type ContextKey = "emails" | "jobs" | "estimates" | "ar" | "ap" | "cont" | "pb";

const labelMap: Record<ContextKey, { dept: string; sub: string; intro: string; placeholder: string }> = {
  emails: {
    dept: "Emails",
    sub: "Email & work order audit",
    intro: "Email audit data is demo only — HCP API does not expose inbox. Wire Gmail OAuth to enable real audit.",
    placeholder: "Ask about emails...",
  },
  jobs: {
    dept: "Dispatch",
    sub: "Jobs & dispatch",
    intro: "Live HCP job data loaded. Ask about overdue jobs, unassigned work orders, or dispatch routes.",
    placeholder: "Ask about jobs & dispatch...",
  },
  estimates: {
    dept: "Estimates",
    sub: "Estimates & pricing",
    intro: "Live estimate pipeline loaded. Ask about pricing fairness, stale estimates, or win rate.",
    placeholder: "Ask about estimates & pricing...",
  },
  ar: {
    dept: "AR",
    sub: "Accounts receivable",
    intro: "Live AR loaded. Draft collection emails, identify at-risk accounts, or analyze aging buckets.",
    placeholder: "Ask about receivables...",
  },
  ap: {
    dept: "AP",
    sub: "Contractor payables",
    intro: "AP data is demo (Google Form integration not wired). Ask about variance investigations or pay reports.",
    placeholder: "Ask about contractor payments...",
  },
  cont: {
    dept: "Contractors",
    sub: "Contractor performance",
    intro: "Contractor scorecard derived from HCP assigned_employees. Ask about top performers, margins, or pricing.",
    placeholder: "Ask about contractors...",
  },
  pb: {
    dept: "Price Book",
    sub: "Price book & margins",
    intro: "Service baselines derived from completed jobs in HCP. Ask about pricing recommendations or margin analysis.",
    placeholder: "Ask about pricing & margins...",
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
    setMsgs((m) => [...m, { role: "user", text: trimmed, time: "Just now · Phillip" }]);
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "ai", text: "Thinking...", time: "" }]);

    const ctxData = buildContext(context, data);
    const system = `You are a business intelligence assistant for ZD Maintenance, a property maintenance company in Charlotte NC (roofing, flooring, painting, handyman). You have live HousecallPro data. Be concise, specific, and reference dollar amounts and numbers. Focus on: ${meta.sub}. Live data: ${ctxData}`;

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
                <div key={j}>{line || " "}</div>
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

function buildContext(ctx: ContextKey, data: DashboardData | null): string {
  if (!data) return "No live data loaded yet.";
  if (ctx === "jobs") {
    return `Jobs (${data.jobs.length}): ${JSON.stringify(data.jobs.slice(0, 15))}. Route clusters: ${JSON.stringify(data.routeClusters)}`;
  }
  if (ctx === "estimates") {
    return `Estimates (${data.estimates.length}): ${JSON.stringify(data.estimates.slice(0, 15))}. Baselines: ${JSON.stringify(data.baselines)}. KPIs: ${JSON.stringify(data.kpis)}`;
  }
  if (ctx === "ar") {
    return `AR (${data.ar.length} unpaid): ${JSON.stringify(data.ar.slice(0, 15))}. Aging: ${JSON.stringify(data.aging)}`;
  }
  if (ctx === "cont") {
    return `Contractors: ${JSON.stringify(data.contractors)}. Baselines: ${JSON.stringify(data.baselines)}`;
  }
  if (ctx === "pb") {
    return `Service baselines: ${JSON.stringify(data.baselines)}. Total revenue: ${data.kpis.total_revenue}`;
  }
  if (ctx === "ap") {
    return `AP demo data only. Contractors loaded: ${JSON.stringify(data.contractors)}`;
  }
  return `Demo email audit data.`;
}
