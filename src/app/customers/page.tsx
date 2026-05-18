"use client";

import { useDashboard } from "@/components/DashboardProvider";
import { fmtDate } from "@/lib/format";

export default function CustomersPage() {
  const { data } = useDashboard();
  const customers = data?.customers ?? [];

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Customers</span>
          <span style={{ fontSize: 11, color: "var(--text-2)" }}>{customers.length} customers</span>
        </div>
        <div className="table-scroll" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Tags</th><th>Since</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="empty">{data ? "No customers found" : "Loading..."}</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name || "—"}</b></td>
                    <td style={{ color: "var(--text-2)" }}>{c.company || "—"}</td>
                    <td style={{ color: "var(--blue)", fontSize: 11 }}>{c.email || "—"}</td>
                    <td className="mono">{c.phone || "—"}</td>
                    <td>
                      {c.tags?.length
                        ? c.tags.map((t) => (
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
