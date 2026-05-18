"use client";

import Link from "next/link";
import { useDashboard } from "@/components/DashboardProvider";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function CommandCenter() {
  const { data } = useDashboard();
  const k = data?.kpis;
  const jobs = data?.jobs ?? [];
  const estimates = data?.estimates ?? [];
  const aging = data?.aging;
  const totalAging = aging
    ? aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus
    : 0;

  const openEstimates = estimates.filter((e) =>
    ["pending", "sent", "needs_follow_up", "draft"].includes(e.status),
  );

  return (
    <div className="page">
      <div className="kpi-grid">
        <KPI label="Total Revenue" value={fmtMoney(k?.total_revenue ?? 0)} meta="from completed jobs" />
        <KPI
          label="Open Jobs"
          value={k ? String(k.open_jobs) : "—"}
          meta={k ? `${k.completed_jobs} completed · ${k.cancelled_jobs} cancelled` : "—"}
        />
        <KPI
          label="AR Balance"
          value={fmtMoney(k?.ar_balance ?? 0)}
          valueClass="down"
          metaClass="down"
          meta={`${data?.ar?.length ?? 0} unpaid invoices`}
        />
        <KPI
          label="Estimate Pipeline"
          value={fmtMoney(k?.pipeline_value ?? 0)}
          meta={`${openEstimates.length} open estimates`}
        />
      </div>

      <div className="grid-2 section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Jobs</span>
            <Link className="card-action" href="/jobs">
              All jobs →
            </Link>
          </div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job #</th><th>Customer</th><th>Status</th><th>Tech</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={5} className="empty">{data ? "No jobs found" : "Loading..."}</td></tr>
                ) : (
                  jobs.slice(0, 8).map((j) => (
                    <tr key={j.id}>
                      <td className="mono">#{j.number}</td>
                      <td>{j.customer}</td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>{j.tech}</td>
                      <td className="mono">{j.total != null ? fmtMoney(j.total) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">AR Aging Summary</span>
            <Link className="card-action" href="/ar">
              Full AR →
            </Link>
          </div>
          <div className="card-body">
            {aging ? (
              <>
                <AgingRow label="Current" val={aging.current} total={totalAging} color="var(--green)" />
                <AgingRow label="1–30 days" val={aging.days_1_30} total={totalAging} color="var(--amber)" />
                <AgingRow label="31–60 days" val={aging.days_31_60} total={totalAging} color="var(--amber)" />
                <AgingRow label="61–90 days" val={aging.days_61_90} total={totalAging} color="var(--amber)" />
                <AgingRow label="90+ days" val={aging.days_90_plus} total={totalAging} color="var(--red)" />
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-2)" }}>Total AR</span>
                  <span style={{ fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>{fmtMoney(totalAging)}</span>
                </div>
              </>
            ) : (
              <div className="empty">Loading...</div>
            )}
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title">Open Estimates</span>
          <Link className="card-action" href="/estimates">
            All estimates →
          </Link>
        </div>
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Est #</th><th>Customer</th><th>Status</th><th>Value</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {openEstimates.length === 0 ? (
                <tr><td colSpan={5} className="empty">{data ? "No open estimates" : "Loading..."}</td></tr>
              ) : (
                openEstimates.slice(0, 6).map((e) => (
                  <tr key={e.id}>
                    <td className="mono">#{e.number}</td>
                    <td>{e.customer}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="mono">{fmtMoney(e.total)}</td>
                    <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(e.created)}</td>
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

function KPI({
  label,
  value,
  meta,
  valueClass = "",
  metaClass = "",
}: {
  label: string;
  value: string;
  meta: string;
  valueClass?: string;
  metaClass?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      <div className={`kpi-meta ${metaClass}`}>{meta}</div>
    </div>
  );
}

function AgingRow({ label, val, total, color }: { label: string; val: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div className="aging-row">
      <span className="aging-label">{label}</span>
      <div className="aging-bar-wrap">
        <div className="aging-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="aging-amt">{fmtMoney(val)}</span>
    </div>
  );
}
