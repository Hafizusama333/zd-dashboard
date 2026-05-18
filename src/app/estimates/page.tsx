"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function EstimatesPage() {
  const { data } = useDashboard();
  const estimates = data?.estimates ?? [];

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Estimates Pipeline</span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>{estimates.length} estimates</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Est #</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th><th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.length === 0 ? (
                    <tr><td colSpan={6} className="empty">{data ? "No estimates found" : "Loading..."}</td></tr>
                  ) : (
                    estimates.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">#{e.number}</td>
                        <td>{e.customer}</td>
                        <td><StatusBadge status={e.status} /></td>
                        <td className="mono">{fmtMoney(e.total)}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(e.created)}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(e.updated)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <ChatPanel
          context="estimates"
          quickPrompts={[
            "Which estimates have been pending for more than 7 days?",
            "What is my estimate win rate?",
            "What is the total value of my open pipeline?",
          ]}
        />
      </div>
    </div>
  );
}
