"use client";

import { useEffect, useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { useDashboard } from "@/components/DashboardProvider";
import { periodStart, PERIOD_LABELS } from "@/lib/normalize";

type APRow = {
  rowNumber: number;
  submitted: string;
  contractor: string;
  address: string;
  wo: string;
  amount: string;
  picsSent: boolean;
  paid: boolean;
};

const TONES = ["av-green", "av-blue", "av-amber", "av-red"];
const PAGE_SIZE = 25;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable tone per contractor name.
function toneFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

// Price field is mostly clean numbers but can hold stray text. Parse leading
// "$1,234" style numbers for KPI sums; non-numeric rows contribute 0.
function parseAmount(amount: string): number {
  const m = amount.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return NaN;
  return parseFloat(m[0]);
}

function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Submission timestamps look like "11/15/2024 8:25:34" (M/D/YYYY). Parse to a
// Date; return null when unparseable so period filtering can skip the row.
function parseSubmitted(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const mm = +m[1];
  const dd = +m[2];
  let yy = +m[3];
  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Render a row's price as money when numeric, else raw text, else dash.
function fmtPrice(amount: string): string {
  if (!amount) return "—";
  const n = parseAmount(amount);
  return Number.isNaN(n) ? amount : fmtMoney(n);
}

export default function APPage() {
  const [rows, setRows] = useState<APRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { period } = useDashboard();

  useEffect(() => {
    let alive = true;
    fetch("/api/ap")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.error) setError(data.error);
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Filter by the global time period (WTD/MTD/QTD/YTD from the Topbar). Rows
  // whose submission date is on/after the period start are kept; rows with no
  // parseable date are dropped from period-scoped views.
  const periodRows = useMemo(() => {
    const start = periodStart(period).getTime();
    return rows.filter((r) => {
      const d = parseSubmitted(r.submitted);
      return d !== null && d.getTime() >= start;
    });
  }, [rows, period]);

  const kpis = useMemo(() => {
    let total = 0;
    let paidSum = 0;
    let unpaidSum = 0;
    let missingPics = 0;
    const contractors = new Set<string>();
    for (const r of periodRows) {
      if (r.contractor) contractors.add(r.contractor);
      if (!r.picsSent) missingPics++;
      const amt = parseAmount(r.amount);
      if (!Number.isNaN(amt)) {
        total += amt;
        if (r.paid) paidSum += amt;
        else unpaidSum += amt;
      }
    }
    return {
      total,
      paidSum,
      unpaidSum,
      missingPics,
      contractors: contractors.size,
      count: periodRows.length,
    };
  }, [periodRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return periodRows;
    return periodRows.filter((r) =>
      [r.contractor, r.address, r.wo, r.amount, r.submitted]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [periodRows, search]);

  // Reset to first page when the search term or period changes — adjust during
  // render instead of in an effect to avoid a cascading re-render.
  const [prevKey, setPrevKey] = useState(search + "|" + period);
  if (search + "|" + period !== prevKey) {
    setPrevKey(search + "|" + period);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  return (
    <div className="page">
      <div className="grid-chat">
        <div>
          <div className="kpi-grid section-gap">
            <KPI
              label="Total Submitted"
              value={fmtMoney(kpis.total)}
              meta={`${kpis.contractors} contractor${kpis.contractors === 1 ? "" : "s"}`}
            />
            <KPI label="Paid" value={fmtMoney(kpis.paidSum)} valueClass="up" meta={`${kpis.count} submissions`} />
            <KPI label="Unpaid" value={fmtMoney(kpis.unpaidSum)} valueClass="warn" meta="Awaiting payment" />
            <KPI
              label="Missing Pics"
              value={String(kpis.missingPics)}
              valueClass={kpis.missingPics > 0 ? "down" : "up"}
              meta="No photos sent"
            />
          </div>

          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">Contractor AP Submissions — {PERIOD_LABELS[period]}</span>
              <input
                className="ap-search"
                type="search"
                placeholder="Search contractor, WO#, address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontFamily: "inherit",
                  minWidth: 240,
                }}
              />
            </div>
            <div className="table-scroll" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24, color: "var(--text-2)" }}>Loading submissions…</div>
              ) : error ? (
                <div style={{ padding: 24, color: "var(--red)" }}>
                  Could not load AP data: {error}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 24, color: "var(--text-2)" }}>
                  {rows.length === 0
                    ? "No submissions found."
                    : search.trim()
                      ? "No matches for your search."
                      : `No submissions in ${PERIOD_LABELS[period]}.`}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contractor</th>
                      <th>WO #</th>
                      <th>Address</th>
                      <th>Price</th>
                      <th>Pics</th>
                      <th>Submitted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.rowNumber}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className={`avatar ${toneFor(r.contractor)}`}>{initials(r.contractor)}</div>
                            {r.contractor || "—"}
                          </div>
                        </td>
                        <td className="mono">{r.wo || "—"}</td>
                        <td>{r.address || "—"}</td>
                        <td className="mono">{fmtPrice(r.amount)}</td>
                        <td>
                          <span className={`badge ${r.picsSent ? "badge-green" : "badge-red"}`}>
                            {r.picsSent ? "Yes" : "Missing"}
                          </span>
                        </td>
                        <td className="mono">{r.submitted || "—"}</td>
                        <td>
                          <span className={`badge ${r.paid ? "badge-green" : "badge-amber"}`}>
                            {r.paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && !error && filtered.length > 0 && (
              <div
                className="card-body"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="action-btn"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    Page {safePage} / {totalPages}
                  </span>
                  <button
                    className="action-btn"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatPanel
          context="ap"
          quickPrompts={[
            "Which contractors have unpaid submissions?",
            "List all submissions missing photos",
            "Summarize this week's AP submissions by contractor",
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
