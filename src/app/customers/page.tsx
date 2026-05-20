"use client";

import { useState } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtDate } from "@/lib/format";

type Filter = "business" | "all";

export default function CustomersPage() {
  const { data } = useDashboard();
  const customers = data?.customers ?? [];
  const [filter, setFilter] = useState<Filter>("business");
  const [query, setQuery] = useState("");

  const filtered = customers.filter((c) => {
    if (filter === "business" && !c.isBusiness) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const businessCount = customers.filter((c) => c.isBusiness).length;

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Customers</span>
          <span style={{ fontSize: 11, color: "var(--text-2)" }}>
            {filtered.length} shown · {customers.length} total · {businessCount} businesses
          </span>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
          <div className="filter-tabs" style={{ marginBottom: 0 }}>
            <button className={`ftab${filter === "business" ? " on" : ""}`} onClick={() => setFilter("business")}>
              Business Only ({businessCount})
            </button>
            <button className={`ftab${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
              All ({customers.length})
            </button>
          </div>
          <input
            placeholder="Search name, company, email..."
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
              <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Tags</th><th>Since</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty">{data ? "No customers match" : "Loading..."}</td></tr>
              ) : (
                filtered.slice(0, 200).map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name || "—"}</b></td>
                    <td style={{ color: "var(--text-2)" }}>{c.company || "—"}</td>
                    <td style={{ color: "var(--blue)", fontSize: 11 }}>{c.email || "—"}</td>
                    <td className="mono">{c.phone || "—"}</td>
                    <td>
                      {c.tags?.length
                        ? c.tags.slice(0, 3).map((t) => (
                            <span key={t} className="badge badge-gray" style={{ marginRight: 4 }}>
                              {t}
                            </span>
                          ))
                        : "—"}
                    </td>
                    <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(c.created)}</td>
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
