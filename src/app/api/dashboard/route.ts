import { NextResponse } from "next/server";
import { hcpFetchAll } from "@/lib/hcp";
import {
  computeAging,
  computeKPIs,
  normalizeCustomer,
  normalizeEstimate,
  normalizeInvoice,
  normalizeJob,
} from "@/lib/normalize";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

type AnyRec = Record<string, unknown>;

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T, errors: Record<string, string>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors[label] = e instanceof Error ? e.message : String(e);
    return fallback;
  }
}

export async function GET() {
  const errors: Record<string, string> = {};

  const [jobsRaw, estimatesRaw, invoicesRaw, customersRaw] = await Promise.all([
    safe("jobs", () => hcpFetchAll<AnyRec>("/jobs", "jobs", 100, 5), [], errors),
    safe("estimates", () => hcpFetchAll<AnyRec>("/estimates", "estimates", 100, 5), [], errors),
    safe("invoices", () => hcpFetchAll<AnyRec>("/invoices", "invoices", 100, 5), [], errors),
    safe("customers", () => hcpFetchAll<AnyRec>("/customers", "customers", 100, 5), [], errors),
  ]);

  const jobs = jobsRaw.map(normalizeJob);
  const estimates = estimatesRaw.map(normalizeEstimate);
  const customers = customersRaw.map(normalizeCustomer);

  // Map job_id -> customer name to enrich invoices (HCP invoice payload omits customer).
  const jobCustomerMap = new Map<string, string>();
  for (const j of jobsRaw) {
    const id = (j as Record<string, unknown>).id as string | undefined;
    const cust = (j as Record<string, unknown>).customer as Record<string, unknown> | undefined;
    if (id && cust) {
      const first = (cust.first_name as string) || "";
      const last = (cust.last_name as string) || "";
      const name = `${first} ${last}`.trim() || (cust.name as string) || (cust.company as string) || "";
      if (name) jobCustomerMap.set(id, name);
    }
  }
  const allInvoices = invoicesRaw.map((r) => normalizeInvoice(r, jobCustomerMap));

  const paidStatuses = new Set(["paid", "voided", "void", "refunded"]);
  const ar = allInvoices.filter((inv) => !paidStatuses.has(inv.status) && inv.total > 0);

  const aging = computeAging(ar);
  const kpis = computeKPIs({ jobs, estimates, ar });

  const data: DashboardData = {
    kpis,
    jobs,
    estimates,
    ar,
    aging,
    customers,
    fetchedAt: new Date().toISOString(),
    errors: Object.keys(errors).length ? errors : undefined,
  };

  return NextResponse.json(data);
}
