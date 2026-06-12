import { NextResponse } from "next/server";
import { hcpFetchAll, hcpFetchSince, hcpJobLineItems } from "@/lib/hcp";
import {
  buildMaterialJob,
  computeAging,
  computeBaselines,
  computeCashFlow,
  computeContractors,
  computeCustomerStats,
  computeFireItems,
  computeKPIs,
  computeRouteClusters,
  isLucasJob,
  jobCompletedDate,
  normalizeCustomer,
  normalizeEstimate,
  normalizeInvoice,
  normalizeJob,
  PERIOD_LABELS,
  periodStart,
  summarizeMaterials,
} from "@/lib/normalize";
import type { DashboardData, MaterialJob, Period } from "@/lib/types";

const VALID_PERIODS: Period[] = ["wtd", "mtd", "qtd", "ytd"];

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

export async function GET(req: Request) {
  const errors: Record<string, string> = {};

  const url = new URL(req.url);
  const periodParam = (url.searchParams.get("period") || "mtd").toLowerCase() as Period;
  const period: Period = VALID_PERIODS.includes(periodParam) ? periodParam : "mtd";
  const now = new Date();
  const start = periodStart(period, now);
  const startISO = start.toISOString();
  // YTD/QTD can span many pages; bound by period so MTD/WTD stay fast.
  const jobPageLimit = period === "ytd" ? 50 : period === "qtd" ? 25 : 6;

  const estCreated = (e: AnyRec): string | null =>
    (e.created_at as string) || (e.created as string) || null;

  const [jobsRaw, estimatesRaw, invoicesRaw, customersRaw] = await Promise.all([
    // Period KPIs count jobs by completed_at; page newest-first and stop once past the window.
    safe("jobs", () => hcpFetchSince<AnyRec>("/jobs", "jobs", startISO, jobCompletedDate, 100, jobPageLimit), [], errors),
    safe("estimates", () => hcpFetchSince<AnyRec>("/estimates", "estimates", startISO, estCreated, 100, jobPageLimit), [], errors),
    // AR/aging is all-time outstanding, not period-scoped.
    safe("invoices", () => hcpFetchAll<AnyRec>("/invoices", "invoices", 100, 10), [], errors),
    safe("customers", () => hcpFetchAll<AnyRec>("/customers", "customers", 100, 5), [], errors),
  ]);

  const jobs = jobsRaw.map(normalizeJob);
  const estimates = estimatesRaw.map(normalizeEstimate);
  const customers = customersRaw.map(normalizeCustomer);

  const jobCustomerMap = new Map<string, string>();
  const jobServiceMap = new Map<string, string>();
  jobsRaw.forEach((j, idx) => {
    const id = (j as AnyRec).id as string | undefined;
    if (!id) return;
    const cust = (j as AnyRec).customer as AnyRec | undefined;
    if (cust) {
      // Business customer (company) wins, matching normalize.customerName.
      const first = (cust.first_name as string) || "";
      const last = (cust.last_name as string) || "";
      const name = (cust.company as string) || `${first} ${last}`.trim() || (cust.name as string) || "";
      if (name) jobCustomerMap.set(id, name);
    }
    const svc = jobs[idx]?.service;
    if (svc) jobServiceMap.set(id, svc);
  });
  const allInvoices = invoicesRaw.map((r) => normalizeInvoice(r, jobCustomerMap, jobServiceMap));

  const paidStatuses = new Set(["paid", "voided", "void", "refunded"]);
  const ar = allInvoices.filter((inv) => !paidStatuses.has(inv.status) && inv.total > 0);

  const aging = computeAging(ar);
  const agingTotal = aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus;
  const kpis = computeKPIs({ jobs, estimates, ar, agingTotal, period, now });
  const fireItems = computeFireItems({ ar, jobs, estimates });
  const contractors = computeContractors(jobsRaw, jobs, estimatesRaw, estimates);
  const customerStats = computeCustomerStats(jobs, estimates);
  const baselines = computeBaselines(jobs);
  const routeClusters = computeRouteClusters(jobs);
  const cashFlow = computeCashFlow({ kpis, ar, pipeline: kpis.pipeline_value });

  // Fetch line items for Lucas's most recent jobs (limit to keep latency reasonable).
  const lucasIndices: number[] = [];
  jobsRaw.forEach((j, i) => {
    if (isLucasJob(j)) lucasIndices.push(i);
  });
  const MATERIAL_JOB_LIMIT = 30;
  const target = lucasIndices.slice(0, MATERIAL_JOB_LIMIT);
  const materialJobs: MaterialJob[] = (
    await Promise.all(
      target.map(async (i) => {
        const j = jobsRaw[i];
        const id = (j as AnyRec).id as string;
        try {
          const items = await hcpJobLineItems(id);
          return buildMaterialJob(j, jobs[i], items);
        } catch (e) {
          errors[`line_items_${id}`] = e instanceof Error ? e.message : String(e);
          return null;
        }
      }),
    )
  ).filter((x): x is MaterialJob => !!x);
  const lucasMaterialSummary = summarizeMaterials(materialJobs);

  const data: DashboardData = {
    kpis,
    cashFlow,
    fireItems,
    jobs,
    estimates,
    ar,
    aging,
    customers,
    customerStats,
    contractors,
    baselines,
    routeClusters,
    materialJobs,
    lucasMaterialSummary,
    fetchedAt: now.toISOString(),
    period,
    periodLabel: PERIOD_LABELS[period],
    periodStart: startISO,
    errors: Object.keys(errors).length ? errors : undefined,
  };

  return NextResponse.json(data);
}
