import type {
  Aging,
  CashFlow,
  Contractor,
  Customer,
  Estimate,
  FireItem,
  Invoice,
  Job,
  KPIs,
  RouteCluster,
  ServiceBaseline,
} from "./types";

type AnyRec = Record<string, unknown>;

const s = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const num = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(num) ? num : 0;
};
const pick = <T = unknown>(o: AnyRec, ...keys: string[]): T | undefined => {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: unknown = o;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as AnyRec)) cur = (cur as AnyRec)[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
};

const money = (v: unknown): number => {
  const num = n(v);
  if (Number.isInteger(num) && Math.abs(num) >= 100) return num / 100;
  return num;
};

const customerName = (o: AnyRec | undefined): string => {
  if (!o) return "—";
  const first = s(pick(o, "first_name"));
  const last = s(pick(o, "last_name"));
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || s(pick(o, "name", "company"), "—");
};

const addressLine = (o: AnyRec | undefined): string => {
  if (!o) return "—";
  const parts = [
    s(pick(o, "street", "address1", "line1")),
    s(pick(o, "city")),
    s(pick(o, "state")),
  ].filter(Boolean);
  return parts.join(", ") || "—";
};

const zipOf = (o: AnyRec | undefined): string => s(pick(o || {}, "zip", "postal_code"));

const guessService = (description: string): string => {
  const d = description.toLowerCase();
  if (/(roof|shingle|gutter)/.test(d)) return "Roofing";
  if (/(floor|lvp|tile|carpet|hardwood)/.test(d)) return "Flooring";
  if (/(paint|primer|wall)/.test(d)) return "Interior Paint";
  if (/(drywall|patch|sheetrock)/.test(d)) return "Drywall Repair";
  if (/(inspect)/.test(d)) return "Inspection";
  if (/(handyman|odd job|misc)/.test(d)) return "Handyman";
  return "Other";
};

export function normalizeJob(raw: AnyRec): Job {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const address = pick<AnyRec>(raw, "address", "service_address") || {};
  const assigned = pick<AnyRec[]>(raw, "assigned_employees") || [];
  const first = assigned[0];
  const tech = first
    ? `${s(pick(first, "first_name"))} ${s(pick(first, "last_name"))}`.trim() || "—"
    : "—";
  const techId = first ? s(pick(first, "id")) || null : null;
  const schedule = pick<AnyRec>(raw, "schedule") || {};
  const description = s(pick(raw, "description", "note", "notes"));
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "invoice_number", "job_number", "number", "id")),
    customer: customerName(customer),
    address: addressLine(address),
    status: s(pick(raw, "work_status", "status"), "unknown").toLowerCase().replace(/ /g, "_"),
    tech,
    techId,
    scheduled:
      (pick(schedule, "scheduled_start", "arrival_window_start") as string) ||
      (pick(raw, "scheduled_start") as string) ||
      null,
    total: pick(raw, "total_amount", "total") !== undefined
      ? money(pick(raw, "total_amount", "total"))
      : null,
    service: guessService(description),
    zip: zipOf(address),
  };
}

export function normalizeEstimate(raw: AnyRec): Estimate {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const options = pick<AnyRec[]>(raw, "options") || [];
  const optTotal = options.reduce(
    (acc, opt) => acc + money(pick(opt, "total_amount", "total")),
    0,
  );
  const created = (pick(raw, "created_at", "created") as string) || null;
  const daysSinceSent = created
    ? Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000))
    : 0;
  const description = s(pick(raw, "description", "note", "notes")) ||
    options.map((o) => s(pick(o, "name"))).join(" ");
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "estimate_number", "number", "id")),
    customer: customerName(customer),
    status: s(pick(raw, "work_status", "status"), "draft").toLowerCase().replace(/ /g, "_"),
    total: pick(raw, "total_amount", "total") !== undefined
      ? money(pick(raw, "total_amount", "total"))
      : optTotal,
    service: guessService(description),
    created,
    updated: (pick(raw, "updated_at", "updated") as string) || null,
    daysSinceSent,
  };
}

export function normalizeInvoice(raw: AnyRec, jobCustomerMap?: Map<string, string>, jobServiceMap?: Map<string, string>): Invoice {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const jobId = s(pick(raw, "job_id"));
  const due = (pick(raw, "due_at", "due_date") as string) || null;
  const daysOverdue = due
    ? Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 86400000))
    : 0;
  const linkedCustomer = jobId && jobCustomerMap ? jobCustomerMap.get(jobId) : undefined;
  const linkedService = jobId && jobServiceMap ? jobServiceMap.get(jobId) : undefined;
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "invoice_number", "number", "id")),
    customer: linkedCustomer || customerName(customer),
    total: money(pick(raw, "due_amount", "amount_due", "balance_due", "amount", "total_amount", "total")),
    due,
    daysOverdue,
    status: s(pick(raw, "status", "payment_status"), "unpaid").toLowerCase().replace(/ /g, "_"),
    service: linkedService || "Other",
  };
}

export function normalizeCustomer(raw: AnyRec): Customer {
  const phones = pick<AnyRec[]>(raw, "mobile_numbers", "home_numbers", "work_numbers") || [];
  const phone = phones.length ? s(pick(phones[0], "number")) : s(pick(raw, "phone"));
  const tags = pick<string[] | AnyRec[]>(raw, "tags");
  const tagList: string[] = Array.isArray(tags)
    ? tags.map((t) => (typeof t === "string" ? t : s((t as AnyRec).name)))
    : [];
  return {
    id: s(pick(raw, "id", "uuid")),
    name: `${s(pick(raw, "first_name"))} ${s(pick(raw, "last_name"))}`.trim() || s(pick(raw, "name"), "—"),
    company: s(pick(raw, "company")),
    email: s(pick(raw, "email")),
    phone,
    tags: tagList,
    created: (pick(raw, "created_at", "created") as string) || null,
  };
}

export function computeAging(invoices: Invoice[]): Aging {
  const a: Aging = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
  for (const inv of invoices) {
    const d = inv.daysOverdue;
    const amt = inv.total;
    if (d <= 0) a.current += amt;
    else if (d <= 30) a.days_1_30 += amt;
    else if (d <= 60) a.days_31_60 += amt;
    else if (d <= 90) a.days_61_90 += amt;
    else a.days_90_plus += amt;
  }
  return a;
}

const COMPLETE = (st: string) => st.startsWith("complete") || st === "completed" || st === "paid";
const CANCELLED = (st: string) => st.includes("cancel");
const OPEN_JOB = (st: string) =>
  ["scheduled", "in_progress", "dispatched", "needs_scheduling"].includes(st);
const OPEN_EST = (st: string) =>
  ["pending", "sent", "needs_follow_up", "draft", "scheduled", "needs_scheduling", "in_progress"].includes(st);

export function computeKPIs(args: {
  jobs: Job[];
  estimates: Estimate[];
  ar: Invoice[];
  agingTotal: number;
}): KPIs {
  const { jobs, estimates, ar, agingTotal } = args;
  const completed = jobs.filter((j) => COMPLETE(j.status));
  const cancelled = jobs.filter((j) => CANCELLED(j.status));
  const open = jobs.filter((j) => OPEN_JOB(j.status));
  const inProg = jobs.filter((j) => j.status === "in_progress");
  const openEstimates = estimates.filter((e) => OPEN_EST(e.status));
  const wonEstimates = estimates.filter((e) => e.status === "created_job_from_estimate");
  const closedEstimates = estimates.length - openEstimates.length;
  const conversion = closedEstimates > 0 ? (wonEstimates.length / closedEstimates) * 100 : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthJobs = completed.filter((j) => {
    if (!j.scheduled) return false;
    const t = new Date(j.scheduled).getTime();
    return t >= monthStart;
  });
  const monthlyRevenue = monthJobs.reduce((acc, j) => acc + (j.total || 0), 0);

  const totalRevenue = completed.reduce((acc, j) => acc + (j.total || 0), 0);
  const collectionRate = totalRevenue + agingTotal > 0
    ? (totalRevenue / (totalRevenue + agingTotal)) * 100
    : 0;

  const sentEstTotals = estimates.filter((e) => e.total > 0).map((e) => e.total);
  const avgEstValue = sentEstTotals.length
    ? sentEstTotals.reduce((a, b) => a + b, 0) / sentEstTotals.length
    : 0;

  const closedDurations = wonEstimates
    .map((e) => {
      if (!e.created || !e.updated) return null;
      return (new Date(e.updated).getTime() - new Date(e.created).getTime()) / 86400000;
    })
    .filter((x): x is number => x !== null && Number.isFinite(x));
  const avgDaysToClose = closedDurations.length
    ? closedDurations.reduce((a, b) => a + b, 0) / closedDurations.length
    : 0;

  const arCritical = ar.filter((i) => i.daysOverdue > 60).reduce((a, b) => a + b.total, 0);

  return {
    total_revenue: totalRevenue,
    monthly_revenue: monthlyRevenue,
    open_jobs: open.length,
    jobs_in_progress: inProg.length,
    jobs_this_month: monthJobs.length,
    completed_jobs: completed.length,
    cancelled_jobs: cancelled.length,
    ar_balance: ar.reduce((acc, i) => acc + i.total, 0),
    ar_critical: arCritical,
    open_estimates: openEstimates.length,
    pipeline_value: openEstimates.reduce((acc, e) => acc + e.total, 0),
    collection_rate: collectionRate,
    conversion_rate: conversion,
    avg_estimate_value: avgEstValue,
    avg_days_to_close: avgDaysToClose,
    gross_margin_pct: 41,
  };
}

export function computeFireItems(args: { ar: Invoice[]; jobs: Job[]; estimates: Estimate[] }): FireItem[] {
  const { ar, jobs, estimates } = args;
  const out: FireItem[] = [];

  const overdue30 = ar.filter((i) => i.daysOverdue >= 30);
  if (overdue30.length) {
    const sum = overdue30.reduce((a, b) => a + b.total, 0);
    out.push({
      severity: "critical",
      message: `${overdue30.length} invoice${overdue30.length === 1 ? "" : "s"} 30+ days overdue — $${Math.round(sum).toLocaleString()}`,
      target: "ar",
    });
  }

  const unassigned = jobs.filter(
    (j) => OPEN_JOB(j.status) && (j.tech === "—" || !j.techId),
  );
  if (unassigned.length) {
    out.push({
      severity: "critical",
      message: `${unassigned.length} job${unassigned.length === 1 ? "" : "s"} — no contractor assigned`,
      target: "jobs",
    });
  }

  const staleEstimates = estimates.filter(
    (e) => OPEN_EST(e.status) && e.daysSinceSent >= 7,
  );
  if (staleEstimates.length) {
    out.push({
      severity: "high",
      message: `${staleEstimates.length} estimates pending 7+ days`,
      target: "estimates",
    });
  }

  const overdueJobs = jobs.filter((j) => {
    if (!j.scheduled || !OPEN_JOB(j.status)) return false;
    return new Date(j.scheduled).getTime() < Date.now();
  });
  if (overdueJobs.length) {
    out.push({
      severity: "high",
      message: `${overdueJobs.length} job${overdueJobs.length === 1 ? "" : "s"} past scheduled date`,
      target: "jobs",
    });
  }

  out.push({
    severity: "medium",
    message: "1 missed lead — 26hrs unanswered (demo)",
    target: "emails",
  });

  return out;
}

export function computeContractors(jobsRaw: AnyRec[], jobs: Job[]): Contractor[] {
  const byId = new Map<string, {
    id: string;
    name: string;
    role: string;
    jobs: number;
    completed: number;
    cancelled: number;
    revenue: number;
  }>();

  jobsRaw.forEach((raw, idx) => {
    const employees = (raw.assigned_employees as AnyRec[] | undefined) || [];
    const first = employees[0];
    if (!first) return;
    const id = s(pick(first, "id"));
    if (!id) return;
    const norm = jobs[idx];
    if (!norm) return;
    const entry = byId.get(id) || {
      id,
      name: `${s(pick(first, "first_name"))} ${s(pick(first, "last_name"))}`.trim() || "Unknown",
      role: s(pick(first, "role"), "Field"),
      jobs: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
    };
    entry.jobs += 1;
    if (COMPLETE(norm.status)) {
      entry.completed += 1;
      entry.revenue += norm.total || 0;
    }
    if (CANCELLED(norm.status)) entry.cancelled += 1;
    byId.set(id, entry);
  });

  const contractors: Contractor[] = [];
  byId.forEach((v) => {
    contractors.push({
      id: v.id,
      name: v.name,
      initials: v.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?",
      role: v.role,
      jobs: v.jobs,
      completedJobs: v.completed,
      completionRate: v.jobs ? (v.completed / v.jobs) * 100 : 0,
      cancelRate: v.jobs ? (v.cancelled / v.jobs) * 100 : 0,
      revenue: v.revenue,
      avgJobValue: v.completed ? v.revenue / v.completed : 0,
    });
  });

  return contractors.sort((a, b) => b.revenue - a.revenue);
}

export function computeBaselines(jobs: Job[]): ServiceBaseline[] {
  const byService = new Map<string, number[]>();
  for (const j of jobs) {
    if (!COMPLETE(j.status) || !j.total) continue;
    const arr = byService.get(j.service) || [];
    arr.push(j.total);
    byService.set(j.service, arr);
  }
  const baselines: ServiceBaseline[] = [];
  byService.forEach((vals, service) => {
    if (!vals.length) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    baselines.push({
      service,
      avg: sum / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      sample: vals.length,
    });
  });
  return baselines.sort((a, b) => b.sample - a.sample);
}

export function computeRouteClusters(jobs: Job[]): RouteCluster[] {
  const byZip = new Map<string, { jobCount: number; totalValue: number }>();
  for (const j of jobs) {
    if (!OPEN_JOB(j.status) || !j.zip) continue;
    const entry = byZip.get(j.zip) || { jobCount: 0, totalValue: 0 };
    entry.jobCount += 1;
    entry.totalValue += j.total || 0;
    byZip.set(j.zip, entry);
  }
  const clusters: RouteCluster[] = [];
  byZip.forEach((v, zip) => clusters.push({ zip, ...v }));
  return clusters
    .filter((c) => c.jobCount >= 2)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
}

export function computeCashFlow(args: { kpis: KPIs; ar: Invoice[]; pipeline: number }): CashFlow {
  const { kpis, ar, pipeline } = args;
  const collected = kpis.total_revenue;
  const arOut = ar.reduce((a, b) => a + b.total, 0);
  const apDue = 7200;
  return {
    collected,
    ar_outstanding: arOut,
    ap_due: apDue,
    pipeline_30d: pipeline,
    net_position: collected - apDue,
  };
}
