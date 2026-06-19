"use client";

import { useEffect, useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DataSourceTooltip from "@/components/DataSourceTooltip";
import { fmtDate } from "@/lib/format";
import { useDashboard } from "@/components/DashboardProvider";
import { rangeStart, rangeEndExclusive } from "@/lib/normalize";

type LiveEmail = {
  uid: number;
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string | null;
  seen: boolean;
  ageHours: number;
  sizeEstimate: number;
  labels: string[];
};

const PAGE_SIZE = 25;

const fmtAge = (hours: number): string =>
  hours <= 0 ? "—" : hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.round(hours)}h`;

// Color a label badge by its meaning. Gmail system labels vary; map a few
// common ones, everything else falls back to gray.
function labelClass(name: string): string {
  const n = name.toLowerCase();
  if (n === "unread") return "badge-amber";
  if (n.includes("work order")) return "badge-blue";
  if (n.includes("important") || n.includes("starred")) return "badge-red";
  if (n.startsWith("category_") || n === "inbox") return "badge-gray";
  return "badge-gray";
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<LiveEmail[]>([]);
  const [state, setState] = useState<"loading" | "live" | "error">("loading");
  const [msg, setMsg] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LiveEmail | null>(null);
  const { range, data: dashData } = useDashboard();
  const rangeLabelStr = dashData?.periodLabel ?? "selected range";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/emails", { cache: "no-store" });
        const json = (await res.json()) as { error?: string; emails?: LiveEmail[] };
        if (cancelled) return;
        if (json.error) {
          setState("error");
          setMsg(json.error);
          return;
        }
        setEmails(json.emails || []);
        setState("live");
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setMsg(e instanceof Error ? e.message : "fetch failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter by the global date range (from the Topbar). Emails within [start, end]
  // inclusive are kept; those with no parseable date are dropped.
  const periodEmails = useMemo(() => {
    const start = rangeStart(range.start).getTime();
    const end = rangeEndExclusive(range.end).getTime();
    return emails.filter((e) => {
      if (e.date === null) return false;
      const t = new Date(e.date).getTime();
      return t >= start && t < end;
    });
  }, [emails, range]);

  const kpis = useMemo(() => {
    let unread = 0;
    let stale = 0; // unread ≥ 24h
    const senders = new Set<string>();
    for (const e of periodEmails) {
      if (!e.seen) unread++;
      if (!e.seen && e.ageHours >= 24) stale++;
      if (e.fromEmail) senders.add(e.fromEmail.toLowerCase());
    }
    return { total: periodEmails.length, unread, stale, senders: senders.size };
  }, [periodEmails]);

  // Oldest first so the longest-waiting mail surfaces at the top.
  const sorted = useMemo(
    () => [...periodEmails].sort((a, b) => b.ageHours - a.ageHours),
    [periodEmails]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) =>
      [e.from, e.fromEmail, e.to, e.subject, e.labels.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sorted, search]);

  // Reset to first page when the search or range changes — during render, not
  // in an effect, to avoid a cascading re-render.
  const rangeKey = range.start + ".." + range.end;
  const [prevKey, setPrevKey] = useState(search + "|" + rangeKey);
  if (search + "|" + rangeKey !== prevKey) {
    setPrevKey(search + "|" + rangeKey);
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
      {state !== "live" && (
        <div className="demo-banner">
          {state === "loading"
            ? "Connecting to Gmail inbox…"
            : `⚠ Email fetch error: ${msg}`}
        </div>
      )}

      {state === "live" && (
        <>
        <div className="section-head section-gap">
          <span className="section-head-label">Inbox Metrics</span>
          <DataSourceTooltip
            source="Gmail inbox via /api/emails (latest 250 messages)"
            filters={[
              "Received date within selected range",
              "Emails with no parseable date excluded",
              "Stale = unread & age ≥ 24h",
            ]}
            time="range"
          />
        </div>
        <div className="kpi-grid section-gap">
          <KPI label="Total Emails" value={String(kpis.total)} meta={`${kpis.senders} senders`} />
          <KPI label="Unread" value={String(kpis.unread)} valueClass="warn" meta="Awaiting triage" />
          <KPI
            label="Stale (≥24h)"
            value={String(kpis.stale)}
            valueClass={kpis.stale > 0 ? "down" : "up"}
            meta="Unread & aging"
          />
          <KPI label="Inbox" value={String(kpis.total)} meta="Latest 250 messages" />
        </div>
        </>
      )}

      <div className="grid-chat">
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <span className="card-title">
                Email Audit — Inbound · {rangeLabelStr} (oldest first)
                <DataSourceTooltip
                  source="Gmail inbox via /api/emails (latest 250)"
                  filters={[
                    "Received date within selected range",
                    search.trim() ? `Search: "${search.trim()}"` : "No search filter",
                    "Sorted by age (oldest first), paginated 25/page",
                  ]}
                  time="range"
                />
              </span>
              <input
                type="search"
                placeholder="Search sender, subject, label…"
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
              {state === "loading" ? (
                <div style={{ padding: 24, color: "var(--text-2)" }}>Loading inbox…</div>
              ) : state === "error" ? (
                <div style={{ padding: 24, color: "var(--red)" }}>Could not load emails: {msg}</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 24, color: "var(--text-2)" }}>
                  {emails.length === 0
                    ? "Inbox empty."
                    : search.trim()
                      ? "No matches for your search."
                      : `No emails in ${rangeLabelStr}.`}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>From</th>
                      <th>Subject</th>
                      <th>Labels</th>
                      <th>Received</th>
                      <th>Waiting</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((e) => {
                      const stale = !e.seen && e.ageHours >= 24;
                      return (
                        <tr
                          key={e.uid}
                          onClick={() => setSelected(e)}
                          style={{ cursor: "pointer", ...(stale ? { background: "var(--red-light)" } : {}) }}
                        >
                          <td>
                            <div className="dot" style={{ background: e.seen ? "var(--text-3)" : "var(--blue)" }} />
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.from || "—"}
                            </b>
                            {e.fromEmail && (
                              <div
                                title={e.fromEmail}
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-2)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {e.fromEmail}
                              </div>
                            )}
                          </td>
                          <td
                            title={e.subject}
                            style={{
                              maxWidth: 380,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {e.subject || "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {e.labels.slice(0, 3).map((l) => (
                                <span key={l} className={`badge ${labelClass(l)}`} style={{ fontSize: 10 }}>
                                  {l}
                                </span>
                              ))}
                              {e.labels.length > 3 && (
                                <span style={{ fontSize: 10, color: "var(--text-3)" }}>+{e.labels.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="mono" style={{ color: "var(--text-2)" }}>{fmtDate(e.date)}</td>
                          <td
                            className="mono"
                            style={{ color: stale ? "var(--red)" : "inherit", fontWeight: stale ? 600 : 400 }}
                          >
                            {fmtAge(e.ageHours)}{stale ? " ⚠" : ""}
                          </td>
                          <td>
                            {e.seen ? (
                              <span className="badge badge-gray">Read</span>
                            ) : (
                              <span className="badge badge-amber">Unread</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {state === "live" && filtered.length > 0 && (
              <div
                className="card-body"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
              >
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="action-btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
          context="emails"
          quickPrompts={[
            "Which emails are unread and over 24h old?",
            "Summarize emails labeled NEW WORK ORDERS",
            "List all senders with unread messages",
          ]}
        />
      </div>

      {selected && <EmailDrawer email={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function EmailDrawer({ email, onClose }: { email: LiveEmail; onClose: () => void }) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          height: "100%",
          background: "white",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{email.subject || "(no subject)"}</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
              {fmtDate(email.date)} · {fmtSize(email.sizeEstimate)}
            </div>
          </div>
          <button className="action-btn" onClick={onClose} style={{ flexShrink: 0 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <Field label="From">
            <b>{email.from || "—"}</b>
            {email.fromEmail && (
              <span style={{ color: "var(--text-2)", fontSize: 12 }}> &lt;{email.fromEmail}&gt;</span>
            )}
          </Field>
          <Field label="To">{email.to || "—"}</Field>
          <Field label="Status">
            <span className={`badge ${email.seen ? "badge-gray" : "badge-amber"}`}>
              {email.seen ? "Read" : "Unread"}
            </span>
          </Field>
          {email.labels.length > 0 && (
            <Field label="Tags">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {email.labels.map((l) => (
                  <span key={l} className={`badge ${labelClass(l)}`} style={{ fontSize: 10 }}>
                    {l}
                  </span>
                ))}
              </div>
            </Field>
          )}
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Body
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text)" }}>
            {email.body || email.snippet || "No body content available."}
          </div>
          {email.body && email.body !== email.snippet && (
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-3)" }}>
              Message ID: {email.id} · Thread: {email.threadId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 13 }}>
      <div style={{ width: 56, flexShrink: 0, color: "var(--text-2)", fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, wordBreak: "break-word" }}>{children}</div>
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
