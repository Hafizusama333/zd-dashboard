"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";
import type { Estimate, ServiceBaseline } from "@/lib/types";

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
  const openEstimates = estimates.filter((e) =>
    ["pending", "sent", "needs_follow_up", "draft", "scheduled", "needs_scheduling"].includes(e.status),
  );

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="kpi-grid section-gap">
            <KPI label="Pipeline Value" value={fmtMoney(k?.pipeline_value ?? 0)} meta={`${openEstimates.length} open estimates`} />
            <KPI
              label="Conversion Rate"
              value={k ? `${Math.round(k.conversion_rate)}%` : "—"}
              metaClass="warn"
              meta="Target 70%"
            />
            <KPI
              label="Avg Days to Close"
              value={k && k.avg_days_to_close ? `${k.avg_days_to_close.toFixed(1)}d` : "—"}
              metaClass="up"
              meta="From won estimates"
            />
            <KPI
              label="Avg Estimate Value"
              value={fmtMoney(k?.avg_estimate_value ?? 0)}
              meta="Based on sent estimates"
            />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Open Estimates — Pricing Fairness</span>
              <button className="action-btn primary">AI Price New Estimate →</button>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EST #</th><th>Customer</th><th>Service</th><th>Amount</th><th>Days Sent</th><th>AI Price Check</th>
                  </tr>
                </thead>
                <tbody>
                  {openEstimates.length === 0 ? (
                    <tr><td colSpan={6} className="empty">{data ? "No open estimates" : "Loading..."}</td></tr>
                  ) : (
                    openEstimates.slice(0, 20).map((e) => {
                      const pc = priceCheck(e, baselines);
                      const stale = e.daysSinceSent >= 7;
                      return (
                        <tr key={e.id}>
                          <td className="mono">#{e.number}</td>
                          <td>{e.customer}</td>
                          <td>{e.service}</td>
                          <td className="mono">{fmtMoney(e.total)}</td>
                          <td>
                            <span style={{ color: stale ? "var(--red)" : "inherit", fontWeight: stale ? 500 : 400 }}>
                              {e.daysSinceSent}d
                            </span>
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

          <div className="card">
            <div className="card-header">
              <span className="card-title">AI Estimate Content Generator</span>
              <span className="card-action">Upload photos →</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 14 }}>
                Upload job photos and select service type. AI analyzes scope, suggests pricing from historical data, and writes client-ready estimate content.
              </p>
              <div style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius)", padding: 24, textAlign: "center", cursor: "pointer", marginBottom: 14 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>Drop job photos here or click to upload</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Supports JPG, PNG · AI will analyze scope from images</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Service Type</div>
                  <select style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, background: "var(--bg)" }}>
                    {baselines.map((b) => <option key={b.service}>{b.service}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Sq Footage (optional)</div>
                  <input type="text" placeholder="e.g. 1,200 sq ft" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, background: "var(--bg)" }} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>
                Generate AI Estimate + Content →
              </button>
            </div>
          </div>
        </div>

        <ChatPanel
          context="estimates"
          quickPrompts={[
            "Write professional estimate content for a roof repair at 1247 Maplewood",
            "What should I price a 1500 sqft interior paint job based on history?",
            "Flag all underpriced estimates in the pipeline",
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

