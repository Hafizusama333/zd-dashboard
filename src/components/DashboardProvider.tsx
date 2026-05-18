"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { DashboardData } from "@/lib/types";

type Status = "idle" | "loading" | "live" | "error";

type Ctx = {
  data: DashboardData | null;
  status: Status;
  statusText: string;
  errorMsg: string | null;
  refresh: () => Promise<void>;
  lastSync: string | null;
};

const DashboardCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [statusText, setStatusText] = useState<string>("Idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setStatusText("Fetching data...");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as DashboardData;
      setData(payload);
      const ts = new Date().toLocaleTimeString();
      setStatus("live");
      setStatusText(`Live · ${ts}`);
      setLastSync(ts);
      if (payload.errors && Object.keys(payload.errors).length) {
        setErrorMsg(
          "Some HCP endpoints failed: " +
            Object.entries(payload.errors)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" | "),
        );
      }
    } catch (e) {
      setStatus("error");
      setStatusText("Connection failed");
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DashboardCtx.Provider
      value={{ data, status, statusText, errorMsg, refresh, lastSync }}
    >
      {children}
    </DashboardCtx.Provider>
  );
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}
