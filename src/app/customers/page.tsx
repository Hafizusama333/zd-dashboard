"use client";

import { useState } from "react";
import DataSourceTooltip from "@/components/DataSourceTooltip";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";

type Filter = "active" | "all";

export default function CustomersPage() {
  const { data } = useDashboard();
  // customerStats are the business customers rolled up from jobs/estimates.
  const stats = data?.customerStats ?? [];
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");

  const filtered = stats.filter((c) => {
    if (filter === "active" && c.jobs === 0 && c.estimates === 0) return false;
    if (!query) return true;
    return c.name.toLowerCase().includes(query.toLowerCase());
  });

  const activeCount = stats.filter((c) => c.jobs > 0 || c.estimates > 0).length;

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Customer Performance
            <DataSourceTooltip
              source="HousecallPro /jobs + /estimates via /api/dashboard"
              filters={[
                "Business customers rolled up from jobs & estimates in range",
                filter === "active" ? "Active only (≥1 job or estimate)" : "All customers",
                query.trim() ? `Search: "${query.trim()}"` : "No search filter",
                "First 200",
              ]}
              time="range"
            />
          </span>
          <span style={{ fontSize: 11, color: "var(--text-2)" }}>
            {filtered.length} shown · {activeCount} active · {stats.length} total
          </span>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
          <div className="filter-tabs" style={{ marginBottom: 0 }}>
            <button className={`ftab${filter === "active" ? " on" : ""}`} onClick={() => setFilter("active")}>
              Active ({activeCount})
            </button>
            <button className={`ftab${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
              All ({stats.length})
            </button>
          </div>
          <input
            placeholder="Search customer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              maxWidth: 320,
              padding: "6px 10px",
              fontSize: 12,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--bg)",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
        <div className="table-scroll" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Jobs (wk)</th>
                <th>Completed</th>
                <th>Avg Job Size</th>
                <th>Revenue</th>
                <th>Est → Job</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty">{data ? "No customers match" : "Loading..."}</td></tr>
              ) : (
                filtered.slice(0, 200).map((c) => (
                  <tr key={c.name}>
                    <td><b>{c.name}</b></td>
                    <td>
                      {c.jobs}
                      {c.jobsThisWeek > 0 && (
                        <span className="badge badge-blue" style={{ marginLeft: 6 }}>+{c.jobsThisWeek} wk</span>
                      )}
                    </td>
                    <td>{c.completedJobs}</td>
                    <td className="mono">{fmtMoney(c.avgJobValue)}</td>
                    <td className="mono">{fmtMoney(c.revenue)}</td>
                    <td>
                      {c.estimates > 0 ? (
                        <span className={`badge ${c.conversionRate >= 50 ? "badge-green" : c.conversionRate >= 25 ? "badge-amber" : "badge-gray"}`}>
                          {Math.round(c.conversionRate)}% ({c.wonEstimates}/{c.estimates})
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
