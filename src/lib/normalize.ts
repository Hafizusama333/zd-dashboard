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
  LineItem,
  MaterialJob,
  RouteCluster,
  ServiceBaseline,
} from "./types";
import type { HCPLineItem } from "./hcp";

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

// HCP nests the BUSINESS customer in `company` (e.g. "PURE Property Management").
// first_name/last_name on a job is the tenant/contact (often "Vacant Home" or blank).
// Client wants the business customer, so company wins; fall back to person name.
const customerName = (o: AnyRec | undefined): string => {
  if (!o) return "—";
  const company = s(pick(o, "company"));
  if (company) return company;
  const first = s(pick(o, "first_name"));
  const last = s(pick(o, "last_name"));
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || s(pick(o, "name"), "—");
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

const hoursSince = (iso: string | null | undefined): number => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3600000);
};

export const STALE_HOURS = 72;

// Categorize from the free-text job/estimate description. Order: specific -> generic.
// Categories tuned to real ZD descriptions (mostly plumbing / electrical / handyman).
const guessService = (description: string): string => {
  const d = description.toLowerCase();
  if (/(toilet|drain|faucet|leak|snake|water heater|wax ring|valve|shower|sink|pipe|plumb|clog|sewer)/.test(d)) return "Plumbing";
  if (/(outlet|breaker|wiring|electric|light fixture|flicker|switch|panel|gfci)/.test(d)) return "Electrical";
  if (/(hvac|furnace|\bac\b|air condition|heat pump|thermostat|duct|exhaust fan)/.test(d)) return "HVAC";
  if (/(roof|shingle|gutter)/.test(d)) return "Roofing";
  if (/(floor|lvp|tile|carpet|hardwood|laminate)/.test(d)) return "Flooring";
  if (/(paint|primer|stain|mailbox)/.test(d)) return "Painting";
  if (/(drywall|patch|sheetrock|ceiling)/.test(d)) return "Drywall Repair";
  if (/(door|trim|quarter round|moulding|molding|cabinet|deck|carpentr|crawl space|blind|shoemould)/.test(d)) return "Carpentry";
  if (/(tree|yard|lawn|landscap|mulch|bush|hedge|debris|haul)/.test(d)) return "Landscaping";
  if (/(mold|mildew)/.test(d)) return "Mold Remediation";
  if (/(clean|pressure wash|power wash)/.test(d)) return "Cleaning";
  if (/(pest|bug|spray|exterminat|rodent)/.test(d)) return "Pest Control";
  if (/(microwave|disposal|dishwasher|appliance|refrigerator|washer|dryer|oven|stove)/.test(d)) return "Appliance";
  if (/(light|fan|ceiling fan)/.test(d)) return "Electrical";
  if (/(inspect)/.test(d)) return "Inspection";
  if (/(handyman|odd job|misc|deposit|install|replace|repair)/.test(d)) return "Handyman";
  return "Other";
};

const ZD_GENERIC_ID = "pro_ace920fd9c4344e78367974cf1e4b5d5";

export function normalizeJob(raw: AnyRec): Job {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const address = pick<AnyRec>(raw, "address", "service_address") || {};
  const assigned = pick<AnyRec[]>(raw, "assigned_employees") || [];
  const first = assigned[0];
  const employeeName = first
    ? `${s(pick(first, "first_name"))} ${s(pick(first, "last_name"))}`.trim() || "—"
    : "—";
  let techId = first ? s(pick(first, "id")) || null : null;
  // When job is assigned to generic "ZD Maintenance" the real contractor name is in job-level tags.
  let tech = employeeName;
  if (techId === ZD_GENERIC_ID || /^zd\s*maintenance$/i.test(employeeName)) {
    const jobTags = pick<unknown[]>(raw, "tags") || [];
    const tagNames = jobTags.map((t) => (typeof t === "string" ? t : s((t as AnyRec).name))).filter(Boolean);
    // Exclude process/workflow/trade-category tags — they aren't contractor names.
    const NON_CONTRACTOR = /quality|control|handyman|carpentor|carpenter|painter|plumber|electric|pipeline|automation|warranty|urgent|priority|follow|review|deposit|estimate|invoice|recurring|maintenance/i;
    const contractorTag = tagNames.find((t) => t && !NON_CONTRACTOR.test(t));
    if (contractorTag) tech = contractorTag;
    // No identifiable contractor tag → leave unassigned rather than guessing a process tag.
    else tech = "—";
  }
  const schedule = pick<AnyRec>(raw, "schedule") || {};
  const description = s(pick(raw, "description", "note", "notes"));
  const status = s(pick(raw, "work_status", "status"), "unknown").toLowerCase().replace(/ /g, "_");
  const createdAt = (pick(raw, "created_at", "created") as string) || null;
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "invoice_number", "job_number", "number", "id")),
    customer: customerName(customer),
    address: addressLine(address),
    status,
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
    createdAt,
    hoursUnscheduled: status === "needs_scheduling" ? hoursSince(createdAt) : 0,
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
  const status = s(pick(raw, "work_status", "status"), "draft").toLowerCase().replace(/ /g, "_");
  // HCP estimate total_amount is almost always null; the real value is the sum of options.
  // Only trust a top-level total when it's a positive number.
  const topTotal = money(pick(raw, "total_amount", "total"));
  const total = topTotal > 0 ? topTotal : optTotal;
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "estimate_number", "number", "id")),
    customer: customerName(customer),
    status,
    total,
    service: guessService(description),
    created,
    updated: (pick(raw, "updated_at", "updated") as string) || null,
    daysSinceSent,
    hoursWaiting: hoursSince(created),
    bucket: estimateBucket(status),
  };
}

// Client priorities: unscheduled (not attended) and completed (visited, need invoice).
function estimateBucket(status: string): import("./types").EstimateBucket {
  if (status === "needs_scheduling") return "unscheduled";
  if (status === "scheduled" || status === "in_progress") return "scheduled";
  if (status.startsWith("complete")) return "completed";
  if (status === "created_job_from_estimate") return "won";
  if (status.includes("cancel")) return "canceled";
  return "other";
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
  const company = s(pick(raw, "company"));
  return {
    id: s(pick(raw, "id", "uuid")),
    name: `${s(pick(raw, "first_name"))} ${s(pick(raw, "last_name"))}`.trim() || s(pick(raw, "name"), "—"),
    company,
    email: s(pick(raw, "email")),
    phone,
    tags: tagList,
    created: (pick(raw, "created_at", "created") as string) || null,
    isBusiness: !!company,
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

const fmtAge = (hours: number): string =>
  hours >= 48 ? `${Math.floor(hours / 24)}d` : `${Math.round(hours)}h`;

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

  // Jobs unscheduled 72+ hours (client rule). Sort oldest, report count + oldest age.
  const staleJobs = jobs
    .filter((j) => j.status === "needs_scheduling" && j.hoursUnscheduled >= STALE_HOURS)
    .sort((a, b) => b.hoursUnscheduled - a.hoursUnscheduled);
  if (staleJobs.length) {
    out.push({
      severity: "critical",
      message: `${staleJobs.length} job${staleJobs.length === 1 ? "" : "s"} unscheduled 72h+ — oldest ${fmtAge(staleJobs[0].hoursUnscheduled)}`,
      target: "jobs",
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

  // Estimates unscheduled (not attended) 72+ hours.
  const staleUnsched = estimates
    .filter((e) => e.bucket === "unscheduled" && e.hoursWaiting >= STALE_HOURS)
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  if (staleUnsched.length) {
    out.push({
      severity: "critical",
      message: `${staleUnsched.length} estimate${staleUnsched.length === 1 ? "" : "s"} unscheduled 72h+ — oldest ${fmtAge(staleUnsched[0].hoursWaiting)}`,
      target: "estimates",
    });
  }

  // Estimates completed (visited) but not yet invoiced, 72+ hours.
  const staleCompleted = estimates
    .filter((e) => e.bucket === "completed" && e.hoursWaiting >= STALE_HOURS)
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  if (staleCompleted.length) {
    out.push({
      severity: "high",
      message: `${staleCompleted.length} completed estimate${staleCompleted.length === 1 ? "" : "s"} awaiting invoice 72h+`,
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

  return out;
}

// Resolve which contractor a job/estimate is attributed to.
// Normal jobs: assigned_employees[0]. ZD-generic-assigned: the normalized `tech`
// (which normalizeJob already resolved from job tags). Returns {id, name, role}.
type Attrib = { id: string; name: string; role: string };
function attribFromRaw(raw: AnyRec, normTech?: string): Attrib | null {
  const employees = (raw.assigned_employees as AnyRec[] | undefined) || [];
  const first = employees[0];
  if (!first) {
    return normTech && normTech !== "—" ? { id: `tag:${normTech}`, name: normTech, role: "Field" } : null;
  }
  const id = s(pick(first, "id"));
  if (!id) return null;
  const empName = `${s(pick(first, "first_name"))} ${s(pick(first, "last_name"))}`.trim();
  // Generic ZD employee → attribute to the tag-derived contractor name from normalizeJob.
  if ((id === ZD_GENERIC_ID || /^zd\s*maintenance$/i.test(empName)) && normTech && normTech !== "—") {
    return { id: `tag:${normTech}`, name: normTech, role: "Subcontractor" };
  }
  return { id, name: empName || "Unknown", role: s(pick(first, "role"), "Field") };
}

const SCHEDULED_JOB = (st: string) =>
  ["scheduled", "in_progress", "needs_scheduling", "dispatched"].includes(st);

export function computeContractors(
  jobsRaw: AnyRec[],
  jobs: Job[],
  estimatesRaw: AnyRec[] = [],
  estimates: Estimate[] = [],
): Contractor[] {
  const byId = new Map<string, {
    id: string;
    name: string;
    role: string;
    jobs: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    revenue: number;
    estimates: number;
    completedEst: number;
    scheduledEst: number;
  }>();

  const ensure = (a: Attrib) => {
    const e = byId.get(a.id) || {
      id: a.id, name: a.name, role: a.role,
      jobs: 0, completed: 0, scheduled: 0, cancelled: 0, revenue: 0,
      estimates: 0, completedEst: 0, scheduledEst: 0,
    };
    byId.set(a.id, e);
    return e;
  };

  jobsRaw.forEach((raw, idx) => {
    const norm = jobs[idx];
    if (!norm) return;
    const a = attribFromRaw(raw, norm.tech);
    if (!a) return;
    const entry = ensure(a);
    entry.jobs += 1;
    if (COMPLETE(norm.status)) {
      entry.completed += 1;
      entry.revenue += norm.total || 0;
    }
    if (SCHEDULED_JOB(norm.status)) entry.scheduled += 1;
    if (CANCELLED(norm.status)) entry.cancelled += 1;
  });

  estimatesRaw.forEach((raw, idx) => {
    const norm = estimates[idx];
    if (!norm) return;
    const a = attribFromRaw(raw);
    if (!a) return;
    const entry = ensure(a);
    entry.estimates += 1;
    if (norm.bucket === "completed" || norm.bucket === "won") entry.completedEst += 1;
    if (norm.bucket === "scheduled" || norm.bucket === "unscheduled") entry.scheduledEst += 1;
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
      scheduledJobs: v.scheduled,
      estimates: v.estimates,
      completedEstimates: v.completedEst,
      scheduledEstimates: v.scheduledEst,
      completionRate: v.jobs ? (v.completed / v.jobs) * 100 : 0,
      cancelRate: v.jobs ? (v.cancelled / v.jobs) * 100 : 0,
      revenue: v.revenue,
      avgJobValue: v.completed ? v.revenue / v.completed : 0,
    });
  });

  return contractors.sort((a, b) => b.revenue - a.revenue);
}

// Per-business-customer rollup (joins jobs + estimates by normalized customer name).
export function computeCustomerStats(jobs: Job[], estimates: Estimate[]): import("./types").CustomerStat[] {
  const weekAgo = Date.now() - 7 * 86400000;
  const byName = new Map<string, import("./types").CustomerStat>();
  const ensure = (name: string) => {
    const e = byName.get(name) || {
      name, jobs: 0, jobsThisWeek: 0, completedJobs: 0, revenue: 0,
      avgJobValue: 0, estimates: 0, wonEstimates: 0, conversionRate: 0,
    };
    byName.set(name, e);
    return e;
  };

  for (const j of jobs) {
    if (!j.customer || j.customer === "—") continue;
    const e = ensure(j.customer);
    e.jobs += 1;
    if (j.createdAt && new Date(j.createdAt).getTime() >= weekAgo) e.jobsThisWeek += 1;
    if (COMPLETE(j.status)) {
      e.completedJobs += 1;
      e.revenue += j.total || 0;
    }
  }
  for (const est of estimates) {
    if (!est.customer || est.customer === "—") continue;
    const e = ensure(est.customer);
    e.estimates += 1;
    if (est.bucket === "won") e.wonEstimates += 1;
  }

  const stats = [...byName.values()];
  for (const e of stats) {
    e.avgJobValue = e.completedJobs ? e.revenue / e.completedJobs : 0;
    e.conversionRate = e.estimates ? (e.wonEstimates / e.estimates) * 100 : 0;
  }
  return stats.sort((a, b) => b.revenue - a.revenue);
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

export const LUCAS_EMPLOYEE_ID = "pro_4c8790abf70e4ada9b2dedc4e95128b1";

export function isLucasJob(jobRaw: AnyRec): boolean {
  const assigned = (jobRaw.assigned_employees as AnyRec[]) || [];
  return assigned.some((e) => s(e.id) === LUCAS_EMPLOYEE_ID);
}

export function buildMaterialJob(
  jobRaw: AnyRec,
  normalized: Job,
  items: HCPLineItem[],
): MaterialJob {
  const li: LineItem[] = items.map((it) => ({
    id: s(it.id),
    name: s(it.name),
    kind: s(it.kind),
    unitCost: money(it.unit_cost),
    unitPrice: money(it.unit_price),
    quantity: n(it.quantity),
    amount: money(it.amount),
  }));
  const laborItems = li.filter((i) => i.kind === "labor");
  const taxItems = li.filter((i) => i.kind === "tax");
  const laborCost = laborItems.reduce((a, b) => a + b.unitCost * b.quantity, 0);
  const laborPrice = laborItems.reduce((a, b) => a + b.amount, 0);
  const taxAmount = taxItems.reduce((a, b) => a + b.amount, 0);
  const total = normalized.total || 0;
  const margin = laborPrice - laborCost;
  const marginPct = laborPrice > 0 ? (margin / laborPrice) * 100 : 0;
  return {
    jobId: normalized.id,
    number: normalized.number,
    customer: normalized.customer,
    address: normalized.address,
    status: normalized.status,
    completedAt: (pick(jobRaw, "work_timestamps.completed_at") as string) || null,
    total,
    laborCost,
    laborPrice,
    taxAmount,
    margin,
    marginPct,
    items: li,
  };
}

export function summarizeMaterials(jobs: MaterialJob[]) {
  const totalLaborCost = jobs.reduce((a, j) => a + j.laborCost, 0);
  const totalRevenue = jobs.reduce((a, j) => a + j.laborPrice, 0);
  const totalMargin = totalRevenue - totalLaborCost;
  const jobCount = jobs.length;
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  return { totalLaborCost, totalRevenue, totalMargin, jobCount, avgMarginPct };
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
