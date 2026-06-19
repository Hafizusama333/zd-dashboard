"use client";

import { useDashboard } from "./DashboardProvider";

type Props = {
  /** Where the data physically comes from, e.g. "HousecallPro /jobs". */
  source: string;
  /** Filters applied (server- or client-side). One line each. */
  filters: string[];
  /**
   * Time window the data covers. Pass "range" to render the live selected
   * date range from the Topbar, "all-time" for unscoped sets, or any literal.
   */
  time?: "range" | "all-time" | string;
};

/**
 * Small "i" affordance that reveals, on hover/focus, exactly how the adjacent
 * table or metric was pulled: its source endpoint, the filters applied, and the
 * time window. Reused across every page so the provenance is always one hover away.
 */
export default function DataSourceTooltip({ source, filters, time = "range" }: Props) {
  const { range, lastSync } = useDashboard();

  const timeLine =
    time === "range"
      ? `${range.start} → ${range.end}`
      : time === "all-time"
        ? "All-time (not period-scoped)"
        : time;

  return (
    <span className="ds-tip" tabIndex={0} aria-label="Data source details">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeWidth="2" strokeLinecap="round" d="M12 16v-4m0-4h.01" />
      </svg>
      <span className="ds-tip-pop" role="tooltip">
        <span className="ds-tip-row">
          <span className="ds-tip-key">Source</span>
          <span className="ds-tip-val">{source}</span>
        </span>
        <span className="ds-tip-row">
          <span className="ds-tip-key">Filters</span>
          <span className="ds-tip-val">
            {filters.length ? (
              filters.map((f, i) => <span key={i} className="ds-tip-filter">{f}</span>)
            ) : (
              <span className="ds-tip-filter">None</span>
            )}
          </span>
        </span>
        <span className="ds-tip-row">
          <span className="ds-tip-key">Time</span>
          <span className="ds-tip-val">{timeLine}</span>
        </span>
        {lastSync && (
          <span className="ds-tip-row">
            <span className="ds-tip-key">Pulled</span>
            <span className="ds-tip-val">{lastSync}</span>
          </span>
        )}
      </span>
    </span>
  );
}
