"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboard } from "./DashboardProvider";

const titles: Record<string, string> = {
  "/": "Command Center",
  "/emails": "Email Audit",
  "/jobs": "Jobs & Dispatch",
  "/estimates": "Estimates & Pricing",
  "/ar": "Accounts Receivable",
  "/ap": "Contractor AP",
  "/contractors": "Contractors",
  "/pricebook": "Price Book",
};

export default function Topbar() {
  const pathname = usePathname();
  const { status, statusText, refresh, errorMsg } = useDashboard();
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
        " · " +
        new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    );
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <span className="page-title">{titles[pathname] || "Dashboard"}</span>
          {dateStr && <span className="date-badge">{dateStr}</span>}
        </div>
        <div className="topbar-right">
          <div className="status-bar">
            <div className={`status-dot ${status}`} />
            <span>{statusText}</span>
          </div>
          <button className="btn" onClick={() => void refresh()}>↻ Refresh</button>
          <button className="btn">Export Report</button>
          <button className="btn btn-primary">+ New Work Order</button>
        </div>
      </div>
      {errorMsg && (
        <div style={{ padding: "12px 24px 0" }}>
          <div className="error-banner">{errorMsg}</div>
        </div>
      )}
    </>
  );
}
