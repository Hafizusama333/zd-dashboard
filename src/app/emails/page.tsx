"use client";

import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { fmtDate } from "@/lib/format";

type LiveEmail = {
  uid: number;
  from: string;
  fromEmail: string;
  subject: string;
  date: string | null;
  seen: boolean;
  ageHours: number;
};

type EmailRow = {
  from: string;
  subject: string;
  date: string;
  type: string;
  typeClass: string;
  match: string;
  matchClass: string;
  action: string;
  actionClass?: string;
  rowClass?: string;
};

const EMAILS: EmailRow[] = [
  { from: "T. Hargrove", subject: "Roof quote — 5512 Larkhaven", date: "26h ago", type: "Missed Lead", typeClass: "badge-red", match: "No Match", matchClass: "badge-red", action: "Create WO →", actionClass: "danger", rowClass: "missed" },
  { from: "M. Johnson", subject: "Re: Invoice #2284 — when can we...", date: "3h ago", type: "Needs Reply", typeClass: "badge-amber", match: "INV-2284", matchClass: "badge-green", action: "Draft reply →" },
  { from: "D. Rivera", subject: "Following up on estimate — 2nd time", date: "1d ago", type: "2nd Follow-up", typeClass: "badge-amber", match: "EST-0492", matchClass: "badge-green", action: "Reply now →" },
  { from: "C. Booker", subject: "Flooring job — very satisfied!", date: "5h ago", type: "Review Opp", typeClass: "badge-green", match: "WO-1829", matchClass: "badge-green", action: "Send review link →" },
  { from: "HCP Notify", subject: "Payment received — WO-1829 $1,400", date: "1d ago", type: "Payment", typeClass: "badge-green", match: "INV-2301 ✓", matchClass: "badge-green", action: "No action" },
];

const VALIDATION = [
  { email: "Booker · flooring job", worker: "Dwayne", tag: "Tag: DWAYNE", status: "Match", statusClass: "badge-green" },
  { email: "Rivera · roof repair", worker: "Lucas", tag: "Tag: LUCAS", status: "Match", statusClass: "badge-green" },
  { email: "Hargrove · roof quote", worker: "—", tag: "No WO created", status: "Missing", statusClass: "badge-red" },
];

// Demo dates are relative strings ("26h ago", "1d ago"); parse to hours for sorting.
const ageHours = (d: string): number => {
  const m = d.match(/(\d+)\s*([hd])/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2] === "d" ? n * 24 : n;
};

const fmtAge = (hours: number): string =>
  hours <= 0 ? "—" : hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.round(hours)}h`;

export default function EmailsPage() {
  // Oldest (longest unanswered) first so priority is at the top.
  const sortedEmails = [...EMAILS].sort((a, b) => ageHours(b.date) - ageHours(a.date));

  const [live, setLive] = useState<LiveEmail[] | null>(null);
  const [liveState, setLiveState] = useState<"loading" | "live" | "stub" | "error">("loading");
  const [liveMsg, setLiveMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/emails", { cache: "no-store" });
        const json = (await res.json()) as { stub?: boolean; reason?: string; error?: string; emails?: LiveEmail[] };
        if (cancelled) return;
        if (json.error) { setLiveState("error"); setLiveMsg(json.error); return; }
        if (json.stub) { setLiveState("stub"); setLiveMsg(json.reason || "Gmail not configured."); return; }
        setLive(json.emails || []);
        setLiveState("live");
      } catch (e) {
        if (!cancelled) { setLiveState("error"); setLiveMsg(e instanceof Error ? e.message : "fetch failed"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const useLive = liveState === "live" && live;

  return (
    <div className="page">
      {!useLive && (
        <div className="demo-banner">
          {liveState === "loading"
            ? "Connecting to Gmail inbox…"
            : liveState === "error"
            ? `⚠ Email fetch error: ${liveMsg}`
            : `⚠ Demo data — ${liveMsg}`}
        </div>
      )}
      {useLive && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">Live Inbox — Inbound (oldest first)</span>
            <span style={{ fontSize: 11, color: "var(--text-2)" }}>{live!.length} emails · Gmail IMAP</span>
          </div>
          <div className="table-scroll" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th></th><th>From</th><th>Subject</th><th>Received</th><th>Waiting</th><th>Status</th></tr>
              </thead>
              <tbody>
                {live!.length === 0 ? (
                  <tr><td colSpan={6} className="empty">Inbox empty</td></tr>
                ) : (
                  live!.map((e) => {
                    const stale = !e.seen && e.ageHours >= 24;
                    return (
                      <tr key={e.uid} style={stale ? { background: "var(--red-light)" } : undefined}>
                        <td><div className="dot" style={{ background: e.seen ? "var(--text-3)" : "var(--blue)" }} /></td>
                        <td><b>{e.from}</b><div style={{ fontSize: 11, color: "var(--text-2)" }}>{e.fromEmail}</div></td>
                        <td>{e.subject}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(e.date)}</td>
                        <td className="mono" style={{ color: stale ? "var(--red)" : "inherit", fontWeight: stale ? 600 : 400 }}>
                          {fmtAge(e.ageHours)}{stale ? " ⚠" : ""}
                        </td>
                        <td>
                          {e.seen
                            ? <span className="badge badge-gray">Read</span>
                            : <span className="badge badge-amber">Unread</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid-chat">
        <div>
          {!useLive && (
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Email Audit — All Inbound (demo)</span>
              <button className="action-btn primary">Run Full Audit</button>
            </div>
            <div style={{ padding: 0 }}>
              <div style={{ background: "var(--red-light)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #fca5a5" }}>
                <div className="dot" style={{ background: "var(--red)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--red)" }}>
                    CRITICAL — MISSED LEAD · 26 hours unanswered
                  </div>
                  <div style={{ fontSize: 11, color: "var(--red)", opacity: 0.8 }}>
                    T. Hargrove · Roof quote request — 5512 Larkhaven Dr · No HCP match found
                  </div>
                </div>
                <button className="action-btn primary" style={{ background: "var(--red)", borderColor: "var(--red)" }}>
                  Create Work Order →
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th><th>From</th><th>Subject</th><th>Date</th><th>Type</th><th>HCP Match</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmails.map((e, i) => (
                    <tr key={i} style={e.rowClass ? { background: "var(--red-light)" } : undefined}>
                      <td><div className="dot" style={{ background: "var(--blue)" }} /></td>
                      <td><b>{e.from}</b></td>
                      <td>{e.subject}</td>
                      <td className="mono">{e.date}</td>
                      <td><span className={`badge ${e.typeClass}`}>{e.type}</span></td>
                      <td><span className={`badge ${e.matchClass}`}>{e.match}</span></td>
                      <td>
                        {e.action === "No action" ? (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>No action</span>
                        ) : (
                          <button className={`action-btn ${e.actionClass || ""}`}>{e.action}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {!useLive && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Worker-to-Email Content Validation</span>
              <span className="card-action">View all →</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                Cross-referencing contractors mentioned in emails against HCP tags. Flags mismatches.
              </p>
              <table className="data-table">
                <thead>
                  <tr><th>Email</th><th>Worker Mentioned</th><th>HCP Tag Match</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {VALIDATION.map((v, i) => (
                    <tr key={i}>
                      <td>{v.email}</td>
                      <td>{v.worker}</td>
                      <td>{v.tag}</td>
                      <td><span className={`badge ${v.statusClass}`}>{v.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>

        <ChatPanel
          context="emails"
          quickPrompts={[
            "Create HCP work order for Hargrove at 5512 Larkhaven",
            "Draft follow-up reply to Rivera on EST-0492",
            "List all emails with no HCP match this week",
          ]}
        />
      </div>
    </div>
  );
}
