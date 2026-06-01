import { NextResponse } from "next/server";
import { hcpFetchAll, hcpJobLineItems } from "@/lib/hcp";
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
  normalizeCustomer,
  normalizeEstimate,
  normalizeInvoice,
  normalizeJob,
  summarizeMaterials,
} from "@/lib/normalize";
import type { DashboardData, MaterialJob } from "@/lib/types";

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
  const kpis = computeKPIs({ jobs, estimates, ar, agingTotal });
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
    fetchedAt: new Date().toISOString(),
    errors: Object.keys(errors).length ? errors : undefined,
  };

  return NextResponse.json(data);
}
