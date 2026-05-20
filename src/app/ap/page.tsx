"use client";

import ChatPanel from "@/components/ChatPanel";

type APRow = {
  contractor: string;
  initials: string;
  tone: string;
  wo: string;
  submitted: string;
  hcpCost: string;
  variance: string;
  varianceClass: string;
  receipt: string;
  receiptClass: string;
  status: string;
  statusClass: string;
  action: string;
  actionClass?: string;
  flagged?: boolean;
};

const ROWS: APRow[] = [
  { contractor: "Lucas", initials: "LC", tone: "av-green", wo: "WO-1829", submitted: "$1,400", hcpCost: "$1,400", variance: "$0", varianceClass: "up", receipt: "Yes", receiptClass: "badge-green", status: "Approved", statusClass: "badge-green", action: "Pay →" },
  { contractor: "Lucas", initials: "LC", tone: "av-green", wo: "WO-1834", submitted: "$980", hcpCost: "$980", variance: "$0", varianceClass: "up", receipt: "Yes", receiptClass: "badge-green", status: "Approved", statusClass: "badge-green", action: "Pay →" },
  { contractor: "Marcus", initials: "MK", tone: "av-blue", wo: "WO-1831", submitted: "$1,540", hcpCost: "$1,200", variance: "+$340", varianceClass: "down", receipt: "Yes", receiptClass: "badge-green", status: "Blocked", statusClass: "badge-red", action: "Investigate →", actionClass: "danger", flagged: true },
  { contractor: "Marcus", initials: "MK", tone: "av-blue", wo: "WO-1838", submitted: "$760", hcpCost: "$700", variance: "+$60", varianceClass: "warn", receipt: "Yes", receiptClass: "badge-green", status: "Hold", statusClass: "badge-amber", action: "Review →" },
  { contractor: "Dwayne", initials: "DW", tone: "av-amber", wo: "WO-1822", submitted: "$840", hcpCost: "$840", variance: "$0", varianceClass: "up", receipt: "Yes", receiptClass: "badge-green", status: "Approved", statusClass: "badge-green", action: "Pay →" },
  { contractor: "Dwayne", initials: "DW", tone: "av-amber", wo: "WO-1841", submitted: "$620", hcpCost: "—", variance: "No HCP match", varianceClass: "down", receipt: "Missing", receiptClass: "badge-red", status: "Hold", statusClass: "badge-amber", action: "Escalate →", actionClass: "danger" },
  { contractor: "Jerome", initials: "JR", tone: "av-red", wo: "WO-1836", submitted: "$660", hcpCost: "$660", variance: "$0", varianceClass: "up", receipt: "Missing", receiptClass: "badge-red", status: "Hold", statusClass: "badge-amber", action: "Request receipt →" },
];

const PAY_REPORT = [
  { contractor: "Lucas", approved: "$2,380", approvedClass: "up", hold: "—", blocked: "—", net: "$2,380" },
  { contractor: "Marcus", approved: "$0", approvedClass: "", hold: "$760", holdClass: "warn", blocked: "$1,540", blockedClass: "down", net: "$0 — Hold all" },
  { contractor: "Dwayne", approved: "$840", approvedClass: "up", hold: "$620", holdClass: "warn", blocked: "—", net: "$840" },
  { contractor: "Jerome", approved: "$400", approvedClass: "up", hold: "$660", holdClass: "warn", blocked: "—", net: "$400 (get receipt)" },
];

export default function APPage() {
  return (
    <div className="page">
      <div className="demo-banner">
        ⚠ Demo data — AP submissions normally come from a Google Form. Once wired, each submission is cross-referenced against HCP jobs by{" "}
        <b>address + contractor tag + status=completed</b>. Wire Google Sheets API to connect real data.
      </div>
      <div className="grid-chat">
        <div>
          <div className="kpi-grid section-gap">
            <KPI label="Total Submitted" value="$7,200" meta="4 contractors" />
            <KPI label="Approved to Pay" value="$4,860" valueClass="up" meta="8 submissions" />
            <KPI label="On Hold" value="$1,940" valueClass="warn" meta="3 submissions" />
            <KPI label="Blocked" value="$400" valueClass="down" meta="Major variance" />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">AP Validation — Google Form vs HCP</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="action-btn">Generate Pay Report →</button>
                <button className="action-btn primary">Pay All Approved ($4,860) →</button>
              </div>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contractor</th><th>WO #</th><th>Submitted</th><th>HCP Cost</th><th>Variance</th><th>Receipt</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r, i) => (
                    <tr key={i} style={r.flagged ? { background: "var(--red-light)" } : undefined}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className={`avatar ${r.tone}`}>{r.initials}</div>
                          {r.contractor}
                        </div>
                      </td>
                      <td className="mono">{r.wo}</td>
                      <td className="mono">{r.submitted}</td>
                      <td className="mono">{r.hcpCost}</td>
                      <td className={`mono ${r.varianceClass}`} style={r.flagged ? { fontWeight: 600 } : undefined}>{r.variance}</td>
                      <td><span className={`badge ${r.receiptClass}`}>{r.receipt}</span></td>
                      <td><span className={`badge ${r.statusClass}`}>{r.status}</span></td>
                      <td><button className={`action-btn ${r.actionClass || ""}`}>{r.action}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Weekly Payment Report — Ready to Send</span>
              <button className="action-btn primary">Download PDF Report →</button>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr><th>Contractor</th><th>Approved</th><th>On Hold</th><th>Blocked</th><th>Net to Pay</th></tr>
                </thead>
                <tbody>
                  {PAY_REPORT.map((r, i) => (
                    <tr key={i}>
                      <td>{r.contractor}</td>
                      <td className={`mono ${r.approvedClass}`}>{r.approved}</td>
                      <td className={`mono ${r.holdClass || ""}`}>{r.hold}</td>
                      <td className={`mono ${r.blockedClass || ""}`}>{r.blocked}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{r.net}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td style={{ fontWeight: 600 }}>Total</td>
                    <td className="mono up" style={{ fontWeight: 600 }}>$3,620</td>
                    <td className="mono warn" style={{ fontWeight: 600 }}>$2,040</td>
                    <td className="mono down" style={{ fontWeight: 600 }}>$1,540</td>
                    <td className="mono" style={{ fontWeight: 600 }}>$3,620</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ChatPanel
          context="ap"
          quickPrompts={[
            "Why is Marcus WO-1831 blocked and what should I ask him?",
            "Generate weekly AP payment report for all contractors",
            "Draft message to Jerome requesting receipt for WO-1836",
          ]}
        />
      </div>
    </div>
  );
}

function KPI({ label, value, meta, valueClass = "" }: { label: string; value: string; meta: string; valueClass?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      <div className="kpi-meta" style={{ color: "var(--text-2)" }}>{meta}</div>
    </div>
  );
}
