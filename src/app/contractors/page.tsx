"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";

const TONES = ["av-green", "av-blue", "av-amber", "av-red"];

function completionBadge(rate: number): { cls: string; label: string } {
  if (rate >= 85) return { cls: "badge-green", label: `${Math.round(rate)}%` };
  if (rate >= 70) return { cls: "badge-amber", label: `${Math.round(rate)}%` };
  return { cls: "badge-red", label: `${Math.round(rate)}%` };
}

function flagFor(rate: number, cancelRate: number): { cls: string; label: string } | null {
  if (rate < 70 || cancelRate > 15) return { cls: "badge-red", label: "🚨 Flag" };
  if (rate < 85 || cancelRate > 8) return { cls: "badge-amber", label: "⚠ Watch" };
  if (rate >= 90) return { cls: "badge-green", label: "✓ Top" };
  return null;
}

export default function ContractorsPage() {
  const { data } = useDashboard();
  const contractors = data?.contractors ?? [];
  const baselines = data?.baselines ?? [];

  const companyAvgByService: Record<string, number> = {};
  baselines.forEach((b) => { companyAvgByService[b.service] = b.avg; });

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Contractor Scorecard</span>
              <span className="card-action">Export →</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contractor</th><th>Jobs</th><th>Complete%</th><th>Revenue</th><th>Avg Job Val</th><th>Cancel%</th><th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.length === 0 ? (
                    <tr><td colSpan={7} className="empty">{data ? "No contractor data" : "Loading..."}</td></tr>
                  ) : (
                    contractors.slice(0, 20).map((c, i) => {
                      const comp = completionBadge(c.completionRate);
                      const flag = flagFor(c.completionRate, c.cancelRate);
                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className={`avatar ${TONES[i % 4]}`}>{c.initials}</div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-2)" }}>{c.role}</div>
                              </div>
                            </div>
                          </td>
                          <td>{c.jobs}</td>
                          <td><span className={`badge ${comp.cls}`}>{comp.label}</span></td>
                          <td className="mono">{fmtMoney(c.revenue)}</td>
                          <td className="mono">{fmtMoney(c.avgJobValue)}</td>
                          <td>{c.cancelRate.toFixed(0)}%</td>
                          <td>{flag ? <span className={`badge ${flag.cls}`}>{flag.label}</span> : "—"}</td>
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
              <span className="card-title">Pricing Consistency vs Company Average</span>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Contractor</th><th>Their Avg Job</th><th>Company Avg</th><th>Variance</th><th>Flag</th></tr>
                </thead>
                <tbody>
                  {contractors.length === 0 ? (
                    <tr><td colSpan={5} className="empty">{data ? "No data" : "Loading..."}</td></tr>
                  ) : (
                    contractors.slice(0, 10).map((c) => {
                      const companyAvg = baselines.length
                        ? baselines.reduce((a, b) => a + b.avg, 0) / baselines.length
                        : 0;
                      const variance = companyAvg > 0 ? ((c.avgJobValue - companyAvg) / companyAvg) * 100 : 0;
                      let cls = "badge-green", label = "✓ Consistent", varCls = "";
                      if (variance > 25) { cls = "badge-red"; label = "🔴 Overpricing"; varCls = "down"; }
                      else if (variance < -20) { cls = "badge-amber"; label = "⚠ Underpricing"; varCls = "down"; }
                      else if (Math.abs(variance) < 10) { cls = "badge-green"; label = "✓ Consistent"; varCls = "up"; }
                      return (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td className="mono">{fmtMoney(c.avgJobValue)}</td>
                          <td className="mono">{fmtMoney(companyAvg)}</td>
                          <td className={`mono ${varCls}`}>{variance >= 0 ? "+" : ""}{variance.toFixed(1)}%</td>
                          <td><span className={`badge ${cls}`}>{label}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ChatPanel
          context="cont"
          quickPrompts={[
            "Give me a full performance breakdown on the lowest performer",
            "Which contractor has the best margin contribution?",
            "Draft pricing coaching notes for underpricing contractors",
          ]}
        />
      </div>
    </div>
  );
}
