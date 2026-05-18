"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function ARPage() {
  const { data } = useDashboard();
  const ar = data?.ar ?? [];
  const aging = data?.aging;

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 16 }}>
            <div className="kpi-card">
              <div className="kpi-label">Current (0–30d)</div>
              <div className="kpi-value">{aging ? fmtMoney(aging.current) : "—"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">1–30 Days</div>
              <div className="kpi-value warn">{aging ? fmtMoney(aging.days_1_30) : "—"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">31–60 Days</div>
              <div className="kpi-value warn">{aging ? fmtMoney(aging.days_31_60) : "—"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">61–90 Days</div>
              <div className="kpi-value warn">{aging ? fmtMoney(aging.days_61_90) : "—"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">90+ Days</div>
              <div className="kpi-value down">{aging ? fmtMoney(aging.days_90_plus) : "—"}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Unpaid Invoices</span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>{ar.length} unpaid</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Customer</th><th>Amount</th><th>Due Date</th><th>Days Overdue</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.length === 0 ? (
                    <tr><td colSpan={6} className="empty">{data ? "No unpaid invoices" : "Loading..."}</td></tr>
                  ) : (
                    ar.map((inv) => (
                      <tr key={inv.id}>
                        <td className="mono">#{inv.number}</td>
                        <td>{inv.customer}</td>
                        <td className="mono">{fmtMoney(inv.total)}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(inv.due)}</td>
                        <td><OverdueBadge days={inv.daysOverdue} /></td>
                        <td><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <ChatPanel
          context="ar"
          quickPrompts={[
            "Which invoices are most overdue and what should I do?",
            "Draft a collection email for my most overdue invoice",
            "Summarize my total AR exposure by aging bucket",
          ]}
        />
      </div>
    </div>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days > 60) return <span className="badge badge-red">{days}d</span>;
  if (days > 30) return <span className="badge badge-amber">{days}d</span>;
  return <span className="badge badge-gray">{days}d</span>;
}
