"use client";

import { useState } from "react";
import AgingRow from "@/components/AgingRow";
import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtDate, fmtMoney } from "@/lib/format";

type ARFilter = "all" | "overdue30";

export default function ARPage() {
  const { data } = useDashboard();
  const ar = data?.ar ?? [];
  const aging = data?.aging;
  const k = data?.kpis;
  const total = aging
    ? aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus
    : 0;

  const [filter, setFilter] = useState<ARFilter>("all");
  // HCP invoice-drafting range: fiscal-year start through today−30 (so only 30+ days due show).
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });

  const inRange = (due: string | null): boolean => {
    if (!due) return true; // no due date — don't exclude
    const t = new Date(due).getTime();
    const s = startDate ? new Date(startDate).getTime() : -Infinity;
    const e = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;
    return t >= s && t <= e;
  };

  const visible = ar.filter((inv) => {
    if (filter === "overdue30" && inv.daysOverdue < 30) return false;
    if (filter === "overdue30" && !inRange(inv.due)) return false;
    return true;
  });
  const overdue30Count = ar.filter((i) => i.daysOverdue >= 30).length;

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
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="filter-tabs" style={{ marginBottom: 0 }}>
                <button className={`ftab${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
                  All Open ({ar.length})
                </button>
                <button className={`ftab${filter === "overdue30" ? " on" : ""}`} onClick={() => setFilter("overdue30")}>
                  30+ Days Due ({overdue30Count})
                </button>
              </div>
              {filter === "overdue30" && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--text-2)" }}>
                  <span>Invoice due date:</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, background: "var(--bg)" }} />
                  <span>→</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, background: "var(--bg)" }} />
                </div>
              )}
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th><th>Invoice</th><th>Service</th><th>Amount</th><th>Days Out</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={7} className="empty">{data ? "No invoices match" : "Loading..."}</td></tr>
                  ) : (
                    [...visible].sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 50).map((inv) => {
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
                            {inv.daysOverdue > 60 ? <span className="badge badge-red">Critical 60+</span> :
                             inv.daysOverdue > 30 ? <span className="badge badge-red">Overdue 30+</span> :
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
