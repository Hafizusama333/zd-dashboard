"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";
import type { Estimate, ServiceBaseline } from "@/lib/types";

const fmtAge = (hours: number): string =>
  hours <= 0 ? "—" : hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.round(hours)}h`;

function priceCheck(est: Estimate, baselines: ServiceBaseline[]): { label: string; cls: string } {
  if (est.total <= 0) return { label: "🔍 Needs AI review", cls: "badge-blue" };
  const baseline = baselines.find((b) => b.service === est.service);
  if (!baseline) return { label: "🔍 No baseline", cls: "badge-gray" };
  const diff = ((est.total - baseline.avg) / baseline.avg) * 100;
  if (diff > 25) return { label: `🔴 Overpriced +${Math.round(diff)}%`, cls: "badge-red" };
  if (diff < -20) return { label: `⚠ Underpriced ${Math.round(diff)}%`, cls: "badge-amber" };
  return { label: "✓ Fair price", cls: "badge-green" };
}

export default function EstimatesPage() {
  const { data } = useDashboard();
  const k = data?.kpis;
  const estimates = data?.estimates ?? [];
  const baselines = data?.baselines ?? [];

  // Client priority: unscheduled (not attended) and completed (visited, need invoice).
  // Oldest first so the longest-standing rise to the top.
  const unscheduled = estimates
    .filter((e) => e.bucket === "unscheduled")
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  const completedNeedInvoice = estimates
    .filter((e) => e.bucket === "completed")
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);

  const unscheduledStale = unscheduled.filter((e) => e.hoursWaiting >= 72).length;
  const completedStale = completedNeedInvoice.filter((e) => e.hoursWaiting >= 72).length;

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="kpi-grid section-gap">
            <KPI
              label="Unscheduled Estimates"
              value={String(unscheduled.length)}
              valueClass={unscheduledStale ? "down" : ""}
              metaClass={unscheduledStale ? "down" : "warn"}
              meta={`${unscheduledStale} over 72h`}
            />
            <KPI
              label="Completed — Need Invoice"
              value={String(completedNeedInvoice.length)}
              valueClass={completedStale ? "down" : "up"}
              metaClass={completedStale ? "down" : "warn"}
              meta={`${completedStale} over 72h`}
            />
            <KPI label="Pipeline Value" value={fmtMoney(k?.pipeline_value ?? 0)} meta={`${k?.open_estimates ?? 0} open`} />
            <KPI
              label="Conversion Rate"
              value={k ? `${Math.round(k.conversion_rate)}%` : "—"}
              metaClass="warn"
              meta="Estimate → job"
            />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Unscheduled Estimates — Not Yet Attended</span>
              <span className="badge badge-red">Oldest first</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EST #</th><th>Customer</th><th>Service</th><th>Amount</th><th>Waiting</th><th>AI Price Check</th>
                  </tr>
                </thead>
                <tbody>
                  {unscheduled.length === 0 ? (
                    <tr><td colSpan={6} className="empty">{data ? "Nothing unscheduled" : "Loading..."}</td></tr>
                  ) : (
                    unscheduled.slice(0, 30).map((e) => {
                      const pc = priceCheck(e, baselines);
                      const stale = e.hoursWaiting >= 72;
                      return (
                        <tr key={e.id} style={stale ? { background: "var(--red-light)" } : undefined}>
                          <td className="mono">#{e.number}</td>
                          <td>{e.customer}</td>
                          <td>{e.service}</td>
                          <td className="mono">{fmtMoney(e.total)}</td>
                          <td className="mono" style={{ color: stale ? "var(--red)" : "var(--amber)", fontWeight: stale ? 600 : 400 }}>
                            {fmtAge(e.hoursWaiting)}{stale ? " ⚠" : ""}
                          </td>
                          <td><span className={`badge ${pc.cls}`}>{pc.label}</span></td>
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
              <span className="card-title">Completed Estimates — Awaiting Invoice</span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>Visited · ready to invoice</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EST #</th><th>Customer</th><th>Service</th><th>Amount</th><th>Waiting</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedNeedInvoice.length === 0 ? (
                    <tr><td colSpan={6} className="empty">{data ? "None awaiting invoice" : "Loading..."}</td></tr>
                  ) : (
                    completedNeedInvoice.slice(0, 30).map((e) => {
                      const stale = e.hoursWaiting >= 72;
                      return (
                        <tr key={e.id} style={stale ? { background: "var(--red-light)" } : undefined}>
                          <td className="mono">#{e.number}</td>
                          <td>{e.customer}</td>
                          <td>{e.service}</td>
                          <td className="mono">{fmtMoney(e.total)}</td>
                          <td className="mono" style={{ color: stale ? "var(--red)" : "inherit", fontWeight: stale ? 600 : 400 }}>
                            {fmtAge(e.hoursWaiting)}{stale ? " ⚠" : ""}
                          </td>
                          <td><button className="action-btn">Create invoice →</button></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Service Baselines (from completed jobs)</span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>Used by AI price check</span>
            </div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Service</th><th>Avg</th><th>Min</th><th>Max</th><th>Sample</th></tr>
                </thead>
                <tbody>
                  {baselines.length === 0 ? (
                    <tr><td colSpan={5} className="empty">{data ? "No baseline data" : "Loading..."}</td></tr>
                  ) : (
                    baselines.map((b) => (
                      <tr key={b.service}>
                        <td><b>{b.service}</b></td>
                        <td className="mono">{fmtMoney(b.avg)}</td>
                        <td className="mono">{fmtMoney(b.min)}</td>
                        <td className="mono">{fmtMoney(b.max)}</td>
                        <td>{b.sample} jobs</td>
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
            "Which unscheduled estimates have waited longest and who should I call first?",
            "What should I price a 1500 sqft interior paint job based on history?",
            "List completed estimates that still need an invoice",
          ]}
        />
      </div>
    </div>
  );
}

function KPI({ label, value, meta, valueClass = "", metaClass = "" }: { label: string; value: string; meta: string; valueClass?: string; metaClass?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      <div className={`kpi-meta ${metaClass}`}>{meta}</div>
    </div>
  );
}
