"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function JobsPage() {
  const { data } = useDashboard();
  const jobs = data?.jobs ?? [];

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Jobs & Dispatch</span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>{jobs.length} jobs</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job #</th><th>Customer</th><th>Address</th><th>Status</th><th>Technician</th><th>Scheduled</th><th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr><td colSpan={7} className="empty">{data ? "No jobs found" : "Loading..."}</td></tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="mono">#{j.number}</td>
                        <td>{j.customer}</td>
                        <td style={{ maxWidth: 160, fontSize: 11, color: "var(--text-2)" }}>{j.address}</td>
                        <td><StatusBadge status={j.status} /></td>
                        <td>{j.tech}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(j.scheduled)}</td>
                        <td className="mono">{j.total != null ? fmtMoney(j.total) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <ChatPanel
          context="jobs"
          quickPrompts={[
            "Which jobs are overdue or past scheduled date?",
            "Who has the most open jobs assigned right now?",
            "Show me all unassigned jobs",
          ]}
        />
      </div>
    </div>
  );
}
