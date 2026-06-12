"use client";

import Link from "next/link";
import AgingRow from "@/components/AgingRow";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";

const PERIOD_SHORT: Record<string, string> = {
  wtd: "This week",
  mtd: "This month",
  qtd: "This quarter",
  ytd: "This year",
};

export default function CommandCenter() {
  const { data } = useDashboard();
  const k = data?.kpis;
  const periodShort = data ? PERIOD_SHORT[data.period] ?? "This period" : "This period";
  const cf = data?.cashFlow;
  const fire = data?.fireItems ?? [];
  const contractors = data?.contractors ?? [];
  const aging = data?.aging;
  const agingTotal = aging
    ? aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus
    : 0;

  const actionQueueItems = buildActionQueue(data);
  const collectionVsTarget = k ? Math.round(k.collection_rate) : null;

  return (
    <div className="page">
      <div className="fire-strip">
        <div className="fire-label">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Resolve Today
        </div>
        <div className="fire-items">
          {fire.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--red)" }}>
              {data ? "Nothing urgent" : "Loading..."}
            </span>
          ) : (
            fire.map((f, i) => (
              <Link key={i} href={`/${f.target === "emails" ? "emails" : f.target}`} className="fire-chip">
                <div className="chip-dot" />
                {f.message}
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <KPI
          label="Revenue"
          value={fmtMoney(k?.period_revenue ?? 0)}
          meta={data ? `${periodShort} · since ${new Date(data.periodStart).toLocaleDateString()}` : "—"}
        />
        <KPI
          label="Collection Rate"
          value={collectionVsTarget != null ? `${collectionVsTarget}%` : "—"}
          metaClass={collectionVsTarget != null && collectionVsTarget < 90 ? "down" : "up"}
          meta={collectionVsTarget != null ? `Target 90% · ${Math.max(0, 90 - collectionVsTarget)}pts gap` : "—"}
        />
        <KPI
          label="Pipeline Value"
          value={fmtMoney(k?.pipeline_value ?? 0)}
          meta={`${k?.open_estimates ?? 0} open estimates`}
        />
        <KPI
          label="Gross Profit Margin"
          value={k ? `${Math.round(k.gross_margin_pct)}%` : "—"}
          metaClass="up"
          meta="Healthy · target 40%"
        />
      </div>

      <div className="kpi-grid section-gap">
        <KPI
          label={`Jobs ${periodShort}`}
          value={k ? String(k.jobs_this_period) : "—"}
          meta={`${k?.jobs_in_progress ?? 0} in progress`}
        />
        <KPI
          label="Estimate Conversion"
          value={k ? `${Math.round(k.conversion_rate)}%` : "—"}
          metaClass="warn"
          meta="Target 70%"
        />
        <KPI
          label="Outstanding AR"
          value={fmtMoney(k?.ar_balance ?? 0)}
          valueClass="down"
          metaClass="down"
          meta={`${data?.ar?.length ?? 0} unpaid invoices`}
        />
        <KPI
          label="Total Revenue"
          value={fmtMoney(k?.total_revenue ?? 0)}
          metaClass="up"
          meta="All completed jobs"
        />
      </div>

      <div className="cf-bar section-gap">
        <CFSeg label="Collected" value={fmtMoney(cf?.collected ?? 0)} valueClass="up" />
        <CFSeg label="AR Outstanding" value={fmtMoney(cf?.ar_outstanding ?? 0)} valueClass="down" />
        <CFSeg label="AP Due" value={fmtMoney(cf?.ap_due ?? 0)} valueClass="down" />
        <CFSeg label="Pipeline (30d)" value={fmtMoney(cf?.pipeline_30d ?? 0)} style={{ color: "var(--blue)" }} />
        <CFSeg label="Net Position" value={fmtMoney(cf?.net_position ?? 0)} valueClass="up" />
      </div>

      <div className="grid-2 section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Action Queue</span>
            <Link className="card-action" href="/ar">View all →</Link>
          </div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <tbody>
                {actionQueueItems.length === 0 ? (
                  <tr><td className="empty">{data ? "Queue empty" : "Loading..."}</td></tr>
                ) : (
                  actionQueueItems.map((row, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${row.severityClass}`}>{row.severityLabel}</span></td>
                      <td>{row.text}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={row.href} className={`action-btn ${row.btnClass || ""}`}>
                          {row.btnLabel}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Contractor Leaderboard</span>
            <Link className="card-action" href="/contractors">Full report →</Link>
          </div>
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Contractor</th><th>Jobs</th><th>Complete</th><th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 ? (
                  <tr><td colSpan={5} className="empty">{data ? "No contractor data" : "Loading..."}</td></tr>
                ) : (
                  contractors.slice(0, 5).map((c, i) => (
                    <tr key={c.id}>
                      <td className="mono">{i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className={`avatar ${avatarTone(i)}`}>{c.initials}</div>
                          {c.name}
                        </div>
                      </td>
                      <td>{c.jobs}</td>
                      <td>
                        <span className={`badge ${completionBadge(c.completionRate)}`}>
                          {Math.round(c.completionRate)}%
                        </span>
                      </td>
                      <td className="mono">{fmtMoney(c.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title">AR Aging Summary</span>
          <Link className="card-action" href="/ar">Full AR →</Link>
        </div>
        <div className="card-body">
          {aging ? (
            <>
              <AgingRow label="Current" val={aging.current} total={agingTotal} color="var(--green)" amtClass="up" />
              <AgingRow label="1–30 days" val={aging.days_1_30} total={agingTotal} color="var(--amber)" amtClass="warn" />
              <AgingRow label="31–60 days" val={aging.days_31_60} total={agingTotal} color="var(--amber)" amtClass="warn" />
              <AgingRow label="61–90 days" val={aging.days_61_90} total={agingTotal} color="#d85a30" />
              <AgingRow label="90+ days" val={aging.days_90_plus} total={agingTotal} color="var(--red)" amtClass="down" />
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--text-2)" }}>Total AR</span>
                <span style={{ fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>{fmtMoney(agingTotal)}</span>
              </div>
            </>
          ) : (
            <div className="empty">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({
  label, value, meta, valueClass = "", metaClass = "",
}: {
  label: string; value: string; meta: string; valueClass?: string; metaClass?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      <div className={`kpi-meta ${metaClass}`}>{meta}</div>
    </div>
  );
}

function CFSeg({ label, value, valueClass = "", style = {} }: { label: string; value: string; valueClass?: string; style?: React.CSSProperties }) {
  return (
    <div className="cf-seg">
      <div className="cf-seg-label">{label}</div>
      <div className={`cf-seg-val ${valueClass}`} style={style}>{value}</div>
    </div>
  );
}

type ActionRow = {
  severityLabel: string;
  severityClass: string;
  text: string;
  href: string;
  btnLabel: string;
  btnClass?: string;
};

function buildActionQueue(data: ReturnType<typeof useDashboard>["data"]): ActionRow[] {
  if (!data) return [];
  const rows: ActionRow[] = [];

  const worstInv = [...data.ar].sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
  if (worstInv && worstInv.daysOverdue >= 30) {
    rows.push({
      severityLabel: "Critical",
      severityClass: "badge-red",
      text: `${worstInv.customer} — #${worstInv.number} ${fmtMoney(worstInv.total)} · ${worstInv.daysOverdue}d`,
      href: "/ar",
      btnLabel: "Demand letter →",
      btnClass: "danger",
    });
  }

  const unassigned = data.jobs.find(
    (j) => ["scheduled", "in_progress", "needs_scheduling"].includes(j.status) && j.tech === "—",
  );
  if (unassigned) {
    rows.push({
      severityLabel: "Critical",
      severityClass: "badge-red",
      text: `${unassigned.address} — no contractor assigned`,
      href: "/jobs",
      btnLabel: "Assign →",
    });
  }

  const staleEst = [...data.estimates]
    .filter((e) => ["pending", "sent", "scheduled", "needs_scheduling"].includes(e.status))
    .sort((a, b) => b.daysSinceSent - a.daysSinceSent)[0];
  if (staleEst && staleEst.daysSinceSent >= 7) {
    rows.push({
      severityLabel: "High",
      severityClass: "badge-amber",
      text: `${staleEst.customer} estimate — ${staleEst.daysSinceSent} days no response`,
      href: "/estimates",
      btnLabel: "Follow up →",
    });
  }

  const unreviewed = data.jobs.filter((j) => j.status === "complete_unrated").length;
  if (unreviewed >= 3) {
    rows.push({
      severityLabel: "High",
      severityClass: "badge-amber",
      text: `${unreviewed} completed jobs — no review sent`,
      href: "/jobs",
      btnLabel: "Send reviews →",
    });
  }

  rows.push({
    severityLabel: "Medium",
    severityClass: "badge-blue",
    text: "Marcus AP — WO-1831 variance $340 (demo)",
    href: "/ap",
    btnLabel: "Review →",
  });

  return rows.slice(0, 6);
}

function avatarTone(idx: number): string {
  return ["av-green", "av-blue", "av-amber", "av-red"][idx % 4];
}

function completionBadge(rate: number): string {
  if (rate >= 85) return "badge-green";
  if (rate >= 70) return "badge-amber";
  return "badge-red";
}
