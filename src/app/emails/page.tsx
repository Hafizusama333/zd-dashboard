"use client";

import ChatPanel from "@/components/ChatPanel";

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

export default function EmailsPage() {
  return (
    <div className="page">
      <div className="demo-banner">
        ⚠ Demo data — HousecallPro API does not expose an inbox endpoint. Wire Gmail OAuth to enable real email audit.
      </div>
      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Email Audit — All Inbound</span>
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
                  {EMAILS.map((e, i) => (
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
