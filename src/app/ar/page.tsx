"use client";

import AgingRow from "@/components/AgingRow";
import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function ARPage() {
  const { data } = useDashboard();
  const ar = data?.ar ?? [];
  const aging = data?.aging;
  const k = data?.kpis;
  const total = aging
    ? aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus
    : 0;

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="kpi-grid section-gap">
            <KPI label="Total Outstanding" value={fmtMoney(k?.ar_balance ?? 0)} valueClass="down" meta={`${ar.length} open invoices`} />
            <KPI label="0–30 Days" value={fmtMoney(aging ? aging.current + aging.days_1_30 : 0)} valueClass="up" meta={`${ar.filter((i) => i.daysOverdue <= 30).length} invoices`} />
            <KPI label="31–60 Days" value={fmtMoney(aging?.days_31_60 ?? 0)} valueClass="warn" meta={`${ar.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60).length} invoices`} />
            <KPI label="60+ Days Critical" value={fmtMoney(k?.ar_critical ?? 0)} valueClass="down" meta="Escalate now" />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">AR Aging Breakdown</span>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Collection rate: {k ? `${Math.round(k.collection_rate)}%` : "—"} · Target 90%
              </span>
            </div>
            <div className="card-body">
              {aging ? (
                <>
                  <AgingRow label="0–30 days" val={aging.current + aging.days_1_30} total={total} color="var(--green)" amtClass="up" />
                  <AgingRow label="31–60 days" val={aging.days_31_60} total={total} color="var(--amber)" amtClass="warn" />
                  <AgingRow label="61–90 days" val={aging.days_61_90} total={total} color="#d85a30" />
                  <AgingRow label="90+ days" val={aging.days_90_plus} total={total} color="var(--red)" amtClass="down" />
                </>
              ) : (
                <div className="empty">Loading...</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Open Invoices</span>
              <button className="action-btn primary">Draft all collection emails →</button>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th><th>Invoice</th><th>Service</th><th>Amount</th><th>Days Out</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.length === 0 ? (
                    <tr><td colSpan={7} className="empty">{data ? "No unpaid invoices" : "Loading..."}</td></tr>
                  ) : (
                    [...ar].sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 50).map((inv) => {
                      const critical = inv.daysOverdue > 30;
                      return (
                        <tr key={inv.id} style={critical ? { background: "var(--red-light)" } : undefined}>
                          <td><b>{inv.customer}</b></td>
                          <td className="mono">#{inv.number}</td>
                          <td>{inv.service}</td>
                          <td className="mono">{fmtMoney(inv.total)}</td>
                          <td>
                            <span style={{
                              color: inv.daysOverdue > 60 ? "var(--red)" : inv.daysOverdue > 30 ? "var(--amber)" : "inherit",
                              fontWeight: critical ? 600 : 400,
                            }}>
                              {inv.daysOverdue}d
                            </span>
                          </td>
                          <td>
                            {inv.daysOverdue > 60 ? <span className="badge badge-red">Critical</span> :
                             inv.daysOverdue > 30 ? <span className="badge badge-red">Critical</span> :
                             inv.daysOverdue > 15 ? <span className="badge badge-amber">Late</span> :
                             inv.daysOverdue > 0 ? <span className="badge badge-blue">Current</span> :
                             <span className="badge badge-green">New</span>}
                          </td>
                          <td>
                            <button className={`action-btn ${critical ? "danger" : ""}`}>
                              {critical ? "Demand letter →" : "Remind →"}
                            </button>
                          </td>
                          <td style={{ display: "none" }}>{fmtDate(inv.due)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ChatPanel
          context="ar"
          quickPrompts={[
            "Draft demand letter for the most overdue invoice",
            "Draft all overdue collection emails at once",
            "Which customers should I pause future work for?",
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
