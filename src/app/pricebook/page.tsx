"use client";

import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { fmtMoney } from "@/lib/format";

const ASSUMED_MARGIN: Record<string, number> = {
  Roofing: 44,
  Flooring: 41,
  "Interior Paint": 32,
  Handyman: 29,
  Inspection: 58,
  "Drywall Repair": 37,
};

function healthBadge(margin: number): { cls: string; label: string } {
  if (margin >= 45) return { cls: "badge-green", label: "Best margin" };
  if (margin >= 40) return { cls: "badge-green", label: "Healthy" };
  if (margin >= 35) return { cls: "badge-amber", label: "Watch margin" };
  return { cls: "badge-amber", label: "Low margin" };
}

const LINE_ITEMS = [
  { name: "Replace shower diverter — T1", unit: "Each", mat: "$13–$36", labor: "$100–$160", floor: "$150", std: "$175", updated: "May 2026" },
  { name: "Interior paint — per room", unit: "Room", mat: "$80–$120", labor: "$200–$320", floor: "$380", std: "$480", updated: "Mar 2026" },
  { name: "Roof inspection", unit: "Job", mat: "$0", labor: "$280–$400", floor: "$350", std: "$810", updated: "Apr 2026" },
  { name: "LVP flooring install", unit: "Sq ft", mat: "$2.10", labor: "$2.80", floor: "$4.20", std: "$5.80", updated: "Jan 2026", stale: true },
  { name: "Drywall patch — small", unit: "Each", mat: "$15–$30", labor: "$80–$140", floor: "$180", std: "$280", updated: "Apr 2026" },
];

export default function PriceBookPage() {
  const { data } = useDashboard();
  const baselines = data?.baselines ?? [];

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Historical Price Baseline — Built from Completed Jobs</span>
              <button className="action-btn primary">Build New Price Book →</button>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service Type</th><th>Avg Invoice</th><th>Min</th><th>Max</th><th>Est Margin%</th><th>Sample</th><th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.length === 0 ? (
                    <tr><td colSpan={7} className="empty">{data ? "No baseline data" : "Loading..."}</td></tr>
                  ) : (
                    baselines.map((b) => {
                      const margin = ASSUMED_MARGIN[b.service] ?? 35;
                      const h = healthBadge(margin);
                      const marginCls = margin >= 40 ? "up" : margin >= 35 ? "warn" : "warn";
                      return (
                        <tr key={b.service}>
                          <td><b>{b.service}</b></td>
                          <td className="mono">{fmtMoney(b.avg)}</td>
                          <td className="mono">{fmtMoney(b.min)}</td>
                          <td className="mono">{fmtMoney(b.max)}</td>
                          <td className={`mono ${marginCls}`}>{margin}%</td>
                          <td>{b.sample} jobs</td>
                          <td><span className={`badge ${h.cls}`}>{h.label}</span></td>
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
              <span className="card-title">Tiered Pricing Example — Shower Diverter Repair</span>
              <span className="card-action">Add to price book →</span>
            </div>
            <div className="card-body">
              <div className="tier-grid">
                <TierCard
                  tone="green"
                  name="Tier 1 — Basic"
                  price="$150–$200"
                  sub="Cartridge swap · <1.5hrs"
                  mat="$13–$36"
                  labor="$100–$160"
                />
                <TierCard
                  tone="amber"
                  name="Tier 2 — Standard"
                  price="$200–$280"
                  sub="Valve swap · 1.5–2hrs"
                  mat="$60–$134"
                  labor="$140–$190"
                />
                <TierCard
                  tone="blue"
                  name="Tier 3 — Complex"
                  price="$280–$350"
                  sub="Full replace · 2hrs+"
                  mat="$105–$220"
                  labor="$220–$300"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Price Book — All Line Items</span>
              <button className="action-btn">+ Add Item</button>
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Service</th><th>Unit</th><th>Mat Cost</th><th>Labor</th><th>Floor Price</th><th>Std Price</th><th>Last Updated</th></tr>
                </thead>
                <tbody>
                  {LINE_ITEMS.map((it, i) => (
                    <tr key={i}>
                      <td>{it.name}</td>
                      <td>{it.unit}</td>
                      <td className="mono">{it.mat}</td>
                      <td className="mono">{it.labor}</td>
                      <td className="mono">{it.floor}</td>
                      <td className="mono">{it.std}</td>
                      <td className="mono" style={{ color: it.stale ? "var(--amber)" : "var(--text-2)" }}>{it.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ChatPanel
          context="pb"
          quickPrompts={[
            "What should I price a 1,800 sqft LVP flooring job based on historical data?",
            "Build me a new price book entry for gutter cleaning",
            "Which services have the worst margins and what should I do?",
          ]}
        />
      </div>
    </div>
  );
}

function TierCard({ tone, name, price, sub, mat, labor }: { tone: "green" | "amber" | "blue"; name: string; price: string; sub: string; mat: string; labor: string }) {
  const headBg = tone === "green" ? "var(--green-light)" : tone === "amber" ? "var(--amber-light)" : "var(--blue-light)";
  const color = tone === "green" ? "var(--green)" : tone === "amber" ? "var(--amber)" : "var(--blue)";
  const nameColor = tone === "green" ? "var(--green-dark)" : color;
  return (
    <div className="tier-card">
      <div className="tier-head" style={{ background: headBg }}>
        <div className="tier-name" style={{ color: nameColor }}>{name}</div>
        <div className="tier-price" style={{ color }}>{price}</div>
        <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{sub}</div>
      </div>
      <div className="tier-body">
        <div className="tier-line"><span className="tier-line-label">Materials</span><span className="tier-line-val">{mat}</span></div>
        <div className="tier-line"><span className="tier-line-label">Labor</span><span className="tier-line-val">{labor}</span></div>
      </div>
    </div>
  );
}
