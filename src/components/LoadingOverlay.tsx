"use client";

import { useDashboard } from "./DashboardProvider";

export default function LoadingOverlay() {
  const { status, data } = useDashboard();
  if (status !== "loading" || data) return null;
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">Fetching live data from HousecallPro...</div>
    </div>
  );
}
