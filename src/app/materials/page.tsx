"use client";

import ChatPanel from "@/components/ChatPanel";
import DataSourceTooltip from "@/components/DataSourceTooltip";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function MaterialsPage() {
  const { data } = useDashboard();
  const mj = data?.materialJobs ?? [];
  const summary = data?.lucasMaterialSummary;

  const sorted = [...mj].sort((a, b) => {
    const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="page">
      <div className="demo-banner">
        ⚠ HousecallPro REST API does not expose receipts or attachments. Material costs shown here are derived from labor line-item cost vs price (margin tracking). For itemized receipts, view Lucas&apos;s jobs in HCP web app or connect a Lowe&apos;s Pro account.
      </div>

      <div className="grid-chat">
        <div>
          <div className="section-head section-gap">
            <span className="section-head-label">Material / Margin Metrics</span>
            <DataSourceTooltip
              source="HousecallPro /jobs line items via /api/dashboard"
              filters={[
                "Lucas's jobs from the in-range job set, most recent first (limit 30)",
                "Margin = labor price − labor cost from HCP line items",
                "Receipts/attachments not exposed by HCP REST API",
              ]}
              time="range"
            />
          </div>
          <div className="kpi-grid section-gap">
            <KPI label="Lucas Jobs Tracked" value={summary ? String(summary.jobCount) : "—"} meta="Most recent first" />
            <KPI label="Total Labor Cost" value={fmtMoney(summary?.totalLaborCost ?? 0)} valueClass="down" meta="From HCP line items" />
            <KPI label="Total Revenue" value={fmtMoney(summary?.totalRevenue ?? 0)} valueClass="up" meta="Invoice line items" />
            <KPI
              label="Avg Margin"
              value={summary ? `${summary.avgMarginPct.toFixed(1)}%` : "—"}
              valueClass={summary && summary.avgMarginPct >= 40 ? "up" : "warn"}
              meta={summary ? fmtMoney(summary.totalMargin) : "—"}
            />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">
                Lucas&apos;s Recent Jobs — Line Items
                <DataSourceTooltip
                  source="HousecallPro /jobs line items via /api/dashboard"
                  filters={[
                    "Lucas's jobs (in-range set), sorted by completed date desc",
                    "Labor cost vs price per job; limit 30",
                  ]}
                  time="range"
                />
              </span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>{sorted.length} jobs</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job #</th><th>Customer</th><th>Address</th><th>Completed</th>
                    <th>Labor Cost</th><th>Labor Price</th><th>Margin</th><th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} className="empty">{data ? "No Lucas jobs found" : "Loading..."}</td></tr>
                  ) : (
                    sorted.map((j) => (
                      <tr key={j.jobId}>
                        <td className="mono">#{j.number}</td>
                        <td>{j.customer}</td>
                        <td style={{ fontSize: 11, color: "var(--text-2)", maxWidth: 180 }}>{j.address}</td>
                        <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(j.completedAt)}</td>
                        <td className="mono">{fmtMoney(j.laborCost)}</td>
                        <td className="mono">{fmtMoney(j.laborPrice)}</td>
                        <td className={`mono ${j.marginPct >= 40 ? "up" : "warn"}`}>
                          {fmtMoney(j.margin)} ({j.marginPct.toFixed(0)}%)
                        </td>
                        <td>{j.items.length}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {sorted.slice(0, 5).map((j) => (
            <div className="card section-gap" key={j.jobId}>
              <div className="card-header">
                <span className="card-title">
                  Job #{j.number} — {j.customer}
                  <DataSourceTooltip
                    source={`HousecallPro /jobs/${j.jobId}/line_items`}
                    filters={["All line items for this job (labor, material, tax)"]}
                    time={j.completedAt ? `Completed ${fmtDate(j.completedAt)}` : "—"}
                  />
                </span>
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>{fmtDate(j.completedAt)}</span>
              </div>
              <div className="table-scroll" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kind</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Unit Price</th><th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.items.map((it) => (
                      <tr key={it.id}>
                        <td><span className={`badge ${it.kind === "labor" ? "badge-blue" : it.kind === "tax" ? "badge-gray" : "badge-green"}`}>{it.kind}</span></td>
                        <td style={{ fontSize: 11 }}>{it.name}</td>
                        <td className="mono">{it.quantity}</td>
                        <td className="mono">{fmtMoney(it.unitCost)}</td>
                        <td className="mono">{fmtMoney(it.unitPrice)}</td>
                        <td className="mono">{fmtMoney(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <ChatPanel
          context="pb"
          quickPrompts={[
            "Which Lucas jobs have the worst margin and why?",
            "What's the average labor cost vs price per job?",
            "Spot any unusual line-item patterns",
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
