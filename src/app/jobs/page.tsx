"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DataSourceTooltip from "@/components/DataSourceTooltip";
import { useDashboard } from "@/components/DashboardProvider";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Job } from "@/lib/types";

type Filter = "all" | "in_progress" | "needs_scheduling" | "scheduled" | "completed";

const fmtAge = (hours: number): string =>
  hours <= 0 ? "—" : hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.round(hours)}h`;

export default function JobsPage() {
  const { data } = useDashboard();
  const jobs = data?.jobs ?? [];
  const clusters = data?.routeClusters ?? [];
  const [filter, setFilter] = useState<Filter>("all");

  const filterFn = (j: Job): boolean => {
    if (filter === "all") return true;
    if (filter === "in_progress") return j.status === "in_progress";
    if (filter === "needs_scheduling") return j.status === "needs_scheduling";
    if (filter === "scheduled") return j.status === "scheduled";
    if (filter === "completed") return j.status.startsWith("complete");
    return true;
  };

  const counts = {
    all: jobs.length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    needs_scheduling: jobs.filter((j) => j.status === "needs_scheduling").length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    completed: jobs.filter((j) => j.status.startsWith("complete")).length,
  };

  const needsScheduling = jobs
    .filter((j) => j.status === "needs_scheduling")
    .sort((a, b) => b.hoursUnscheduled - a.hoursUnscheduled)
    .slice(0, 15);
  const inProgress = jobs.filter((j) => j.status === "in_progress").slice(0, 10);
  const filtered = jobs
    .filter(filterFn)
    .sort((a, b) =>
      filter === "completed"
        ? new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
        : 0,
    )
    .slice(0, 50);

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="filter-tabs">
            <FTab on={filter === "all"} onClick={() => setFilter("all")}>All Jobs ({counts.all})</FTab>
            <FTab on={filter === "in_progress"} onClick={() => setFilter("in_progress")}>In Progress ({counts.in_progress})</FTab>
            <FTab on={filter === "needs_scheduling"} onClick={() => setFilter("needs_scheduling")}>Needs Scheduling ({counts.needs_scheduling})</FTab>
            <FTab on={filter === "scheduled"} onClick={() => setFilter("scheduled")}>Scheduled ({counts.scheduled})</FTab>
            <FTab on={filter === "completed"} onClick={() => setFilter("completed")}>Completed ({counts.completed})</FTab>
          </div>

          {filter === "all" && (
            <>
              <div className="card section-gap">
                <div className="card-header">
                  <span className="card-title">
                    Jobs — Needs Scheduling
                    <DataSourceTooltip
                      source="HousecallPro /jobs via /api/dashboard"
                      filters={[
                        "status = needs_scheduling",
                        "Sorted by hours unscheduled (desc), top 15",
                      ]}
                      time="range"
                    />
                  </span>
                  <span className="badge badge-red">Urgent</span>
                </div>
                <div className="table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>WO #</th><th>Customer</th><th>Service</th><th>Address</th><th>ZIP</th><th>Unscheduled For</th><th>Value</th><th>Contractor</th></tr>
                    </thead>
                    <tbody>
                      {needsScheduling.length === 0 ? (
                        <tr><td colSpan={8} className="empty">{data ? "Nothing needs scheduling" : "Loading..."}</td></tr>
                      ) : (
                        needsScheduling.map((j) => {
                          const stale = j.hoursUnscheduled >= 72;
                          return (
                          <tr key={j.id} style={stale ? { background: "var(--red-light)" } : undefined}>
                            <td className="mono">#{j.number}</td>
                            <td>{j.customer}</td>
                            <td>{j.service}</td>
                            <td style={{ fontSize: 11, color: "var(--text-2)" }}>{j.address}</td>
                            <td className="mono">{j.zip || "—"}</td>
                            <td className="mono" style={{ color: stale ? "var(--red)" : "var(--amber)", fontWeight: stale ? 600 : 400 }}>
                              {fmtAge(j.hoursUnscheduled)}{stale ? " ⚠" : ""}
                            </td>
                            <td className="mono">{fmtMoney(j.total)}</td>
                            <td>
                              {j.tech === "—" ? (
                                <span className="badge badge-red">Unassigned</span>
                              ) : (
                                <span className="badge badge-amber">{j.tech}</span>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card section-gap">
                <div className="card-header">
                  <span className="card-title">
                    In Progress
                    <DataSourceTooltip
                      source="HousecallPro /jobs via /api/dashboard"
                      filters={["status = in_progress", "First 10"]}
                      time="range"
                    />
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{counts.in_progress} active</span>
                </div>
                <div className="table-scroll" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>WO #</th><th>Customer</th><th>Service</th><th>Scheduled</th><th>Contractor</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {inProgress.length === 0 ? (
                        <tr><td colSpan={6} className="empty">{data ? "Nothing in progress" : "Loading..."}</td></tr>
                      ) : (
                        inProgress.map((j) => (
                          <tr key={j.id}>
                            <td className="mono">#{j.number}</td>
                            <td>{j.customer}</td>
                            <td>{j.service}</td>
                            <td className="mono">{fmtDate(j.scheduled)}</td>
                            <td>{j.tech}</td>
                            <td><StatusBadge status={j.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    Dispatch Optimization — Route Clusters
                    <DataSourceTooltip
                      source="HousecallPro /jobs via /api/dashboard"
                      filters={[
                        "Open jobs grouped by ZIP",
                        "Sorted by total value (desc)",
                      ]}
                      time="range"
                    />
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>By ZIP corridor</span>
                </div>
                <div className="card-body table-scroll">
                  <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                    Open jobs grouped by ZIP. Highest-value corridors first.
                  </p>
                  <table className="data-table">
                    <thead>
                      <tr><th>ZIP</th><th>Jobs</th><th>Total Value</th><th>Priority</th></tr>
                    </thead>
                    <tbody>
                      {clusters.length === 0 ? (
                        <tr><td colSpan={4} className="empty">{data ? "No cluster data" : "Loading..."}</td></tr>
                      ) : (
                        clusters.map((c) => (
                          <tr key={c.zip}>
                            <td>{c.zip}</td>
                            <td>{c.jobCount} jobs</td>
                            <td className="mono">{fmtMoney(c.totalValue)}</td>
                            <td>
                              <span className={`badge ${c.totalValue > 5000 ? "badge-red" : "badge-amber"}`}>
                                {c.totalValue > 5000 ? "High" : "Medium"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {filter !== "all" && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  Filtered Jobs
                  <DataSourceTooltip
                    source="HousecallPro /jobs via /api/dashboard"
                    filters={[`status = ${filter}`, "First 50"]}
                    time="range"
                  />
                </span>
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>{filtered.length} shown</span>
              </div>
              <div className="table-scroll" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>WO #</th><th>Customer</th><th>Service</th><th>Address</th><th>ZIP</th><th>Status</th><th>Contractor</th><th>Scheduled</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} className="empty">No jobs match this filter</td></tr>
                    ) : (
                      filtered.map((j) => (
                        <tr key={j.id}>
                          <td className="mono">#{j.number}</td>
                          <td>{j.customer}</td>
                          <td>{j.service}</td>
                          <td style={{ fontSize: 11, color: "var(--text-2)", maxWidth: 160 }}>{j.address}</td>
                          <td className="mono">{j.zip || "—"}</td>
                          <td><StatusBadge status={j.status} /></td>
                          <td>{j.tech}</td>
                          <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(j.scheduled)}</td>
                          <td className="mono">{fmtMoney(j.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <ChatPanel
          context="jobs"
          quickPrompts={[
            "Suggest best contractor for the next unassigned job",
            "Optimize tomorrow dispatch route for Charlotte",
            "List all overdue jobs and who is responsible",
          ]}
        />
      </div>
    </div>
  );
}

function FTab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`ftab${on ? " on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
