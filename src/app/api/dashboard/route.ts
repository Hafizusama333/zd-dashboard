import { NextResponse } from "next/server";
import { hcpFetch, hcpFetchAll, hcpFetchJobsScheduled, hcpFetchSince, hcpJobLineItems, mapPool } from "@/lib/hcp";
import {
  buildMaterialJob,
  computeAging,
  computeBaselines,
  computeCashFlow,
  computeContractors,
  computeCustomerStats,
  computeConversion,
  computeFireItems,
  computeGrossMargin,
  computeKPIs,
  computeRouteClusters,
  countJobsCreated,
  defaultRange,
  isLucasJob,
  jobScheduledDate,
  normalizeCustomer,
  normalizeEstimate,
  normalizeInvoice,
  normalizeJob,
  rangeEndExclusive,
  rangeLabel,
  rangeStart,
  sumJobRevenue,
  summarizeMaterials,
} from "@/lib/normalize";
import type { DashboardData, DateRange, MaterialJob } from "@/lib/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  const now = new Date();
  const def = defaultRange(now);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  let range: DateRange = {
    start: startParam && ISO_DATE.test(startParam) ? startParam : def.start,
    end: endParam && ISO_DATE.test(endParam) ? endParam : def.end,
  };
  // Swap if inverted so the window is always valid.
  if (range.start > range.end) range = { start: range.end, end: range.start };

  const start = rangeStart(range.start);
  const startISO = start.toISOString();
  const endISO = rangeEndExclusive(range.end).toISOString();
  // Wider spans cross more job pages; scale the page cap by range length so short ranges stay fast.
  const spanDays = Math.max(1, Math.round((rangeEndExclusive(range.end).getTime() - start.getTime()) / 86400000));
  const jobPageLimit = spanDays > 270 ? 50 : spanDays > 90 ? 25 : spanDays > 31 ? 12 : 6;

  // Page-stop key for estimates: prefer completed_at (from work_timestamps) so recently
  // completed estimates stay in-window for the ready-to-invoice queue even when created
  // earlier; fall back to created_at for not-yet-completed ones.
  const estCompletedOrCreated = (e: AnyRec): string | null => {
    const wts = (e.work_timestamps as AnyRec) || {};
    return (wts.completed_at as string) || (e.created_at as string) || (e.created as string) || null;
  };
  const jobCreated = (j: AnyRec): string | null =>
    (j.created_at as string) || (j.created as string) || null;

  const [jobsRaw, estimatesRaw, invoicesRaw, customersRaw, revenueJobsRaw, createdJobsRaw] = await Promise.all([
    // Job revenue earned windows by the Scheduled date (matches HCP's report); page
    // newest-first and stop once past the window.
    safe("jobs", () => hcpFetchSince<AnyRec>("/jobs", "jobs", startISO, jobScheduledDate, 100, jobPageLimit), [], errors),
    // Page newest-first by created_at, but stop by COMPLETED date so recently-completed
    // estimates (the ready-to-invoice queue) are fully covered even if created earlier.
    safe("estimates", () => hcpFetchSince<AnyRec>("/estimates", "estimates", startISO, estCompletedOrCreated, 100, jobPageLimit), [], errors),
    // AR = open (unpaid) invoices, server-side filtered by status. All-time, not period-scoped.
    safe("invoices", () => hcpFetchAll<AnyRec>("/invoices", "invoices", 100, 50, { "status[]": "open" }), [], errors),
    safe("customers", () => hcpFetchAll<AnyRec>("/customers", "customers", 100, 5), [], errors),
    // Exact "Job revenue earned" set: HCP server-side filters jobs by scheduled date in
    // range + work_status completed. Summing subtotal over this matches the HCP report.
    safe(
      "revenue_jobs",
      () => hcpFetchJobsScheduled<AnyRec>(range.start, range.end, ["completed"], 100, 50),
      [],
      errors,
    ),
    // "Job count" report windows by CREATED date (no HCP server-side created filter exists,
    // so page newest-first by created_at and stop past the window, then filter client-side).
    safe("created_jobs", () => hcpFetchSince<AnyRec>("/jobs", "jobs", startISO, jobCreated, 100, jobPageLimit), [], errors),
  ]);

  const jobs = jobsRaw.map(normalizeJob);
  // Precise job-revenue figures (subtotal basis) from the server-side filtered set.
  const revenueJobs = revenueJobsRaw.map(normalizeJob);
  const periodRevenueOverride = sumJobRevenue(revenueJobs);
  const periodJobsOverride = revenueJobs.length;
  // Job count: created-in-range, non-canceled (HCP "Job count" report).
  const jobsCreatedCountOverride = countJobsCreated(createdJobsRaw.map(normalizeJob), range);
  const estimates = estimatesRaw.map(normalizeEstimate);
  const customers = customersRaw.map(normalizeCustomer);

  const jobCustomerMap = new Map<string, string>();
  const jobServiceMap = new Map<string, string>();
  const jobAddressMap = new Map<string, string>();
  const jobZipMap = new Map<string, string>();
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
    // Service address + ZIP for AR table.
    const addr = jobs[idx]?.address;
    const zip = jobs[idx]?.zip;
    if (addr && addr !== "—") jobAddressMap.set(id, addr);
    if (zip) jobZipMap.set(id, zip);
  });
  // invoicesRaw is already server-side filtered to status=open (the AR set).
  // Resolve the Job # for each open invoice by fetching its job (the AR table shows it).
  // job.invoice_number is the closest job identifier HCP exposes via the API.
  const arJobIds = Array.from(
    new Set(invoicesRaw.map((r) => (r as AnyRec).job_id as string | undefined).filter((x): x is string => !!x)),
  );
  const jobNumberMap = new Map<string, string>();
  // Throttled (mapPool) so we don't fire ~100 parallel /jobs requests and hit HCP 429.
  await mapPool(arJobIds, 4, async (jid) => {
    try {
      const j = await hcpFetch<AnyRec>(`/jobs/${jid}`);
      const raw = j.invoice_number ?? j.job_number ?? j.number;
      const num = raw != null ? String(raw) : "";
      if (num) jobNumberMap.set(jid, num);
      // Service address (with ZIP) from the invoice's own job — covers all-time AR,
      // not just the in-window jobs already in jobAddressMap.
      const nj = normalizeJob(j);
      if (nj.address && nj.address !== "—") jobAddressMap.set(jid, nj.address);
      if (nj.zip) jobZipMap.set(jid, nj.zip);
    } catch {
      // leave blank on failure
    }
  });
  const ar = invoicesRaw.map((r) => normalizeInvoice(r, jobCustomerMap, jobServiceMap, jobNumberMap, jobAddressMap, jobZipMap));

  const aging = computeAging(ar);
  const agingTotal = aging.current + aging.days_1_30 + aging.days_31_60 + aging.days_61_90 + aging.days_90_plus;

  // Gross profit margin: pull line items for the revenue set (scheduled-in-range + completed)
  // and compute (revenue - cost)/revenue over non-tax lines — matches HCP's report.
  const revenueItemSets = await mapPool(revenueJobs, 4, async (j) => {
    try {
      return await hcpJobLineItems(j.id);
    } catch (e) {
      errors[`margin_items_${j.id}`] = e instanceof Error ? e.message : String(e);
      return [];
    }
  });
  const grossMarginOverride = computeGrossMargin(revenueItemSets);
  // Estimate conversion: estimates are fetched created-windowed, so compute directly.
  const conversionOverride = computeConversion(estimates, range);

  const kpis = computeKPIs({ jobs, estimates, ar, agingTotal, range, now, periodRevenueOverride, periodJobsOverride, jobsCreatedCountOverride, grossMarginOverride, conversionOverride });
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
    await mapPool(target, 4, async (i) => {
      const j = jobsRaw[i];
      const id = (j as AnyRec).id as string;
      try {
        const items = await hcpJobLineItems(id);
        return buildMaterialJob(j, jobs[i], items);
      } catch (e) {
        errors[`line_items_${id}`] = e instanceof Error ? e.message : String(e);
        return null;
      }
    })
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
    range,
    periodLabel: rangeLabel(range),
    periodStart: startISO,
    periodEnd: endISO,
    errors: Object.keys(errors).length ? errors : undefined,
  };

  return NextResponse.json(data);
}
