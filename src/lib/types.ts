export type Job = {
  id: string;
  number: string;
  customer: string;
  address: string;
  status: string;
  tech: string;
  techId: string | null;
  scheduled: string | null;
  completedAt: string | null;
  total: number | null;
  service: string;
  zip: string;
  createdAt: string | null;
  hoursUnscheduled: number;
  // Pre-tax subtotal — HCP's "Job revenue earned" report sums this, not total_amount.
  subtotal: number | null;
};

export type EstimateBucket = "unscheduled" | "scheduled" | "completed" | "won" | "canceled" | "other";

export type Estimate = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: number;
  service: string;
  address: string; // service address (street, city, state)
  zip: string; // service address ZIP
  created: string | null;
  updated: string | null;
  daysSinceSent: number;
  hoursWaiting: number;
  bucket: EstimateBucket;
  // HCP conversion bucket from option approval_status: won (any option approved),
  // lost (any declined), open (pending), excluded (canceled — not counted at all).
  convBucket: "won" | "lost" | "open" | "excluded";
};

export type Invoice = {
  id: string;
  number: string;
  jobNumber: string;
  customer: string;
  address: string; // service address (street, city, state) from linked job
  zip: string; // service address ZIP from linked job
  amount: number; // invoice amount
  total: number; // amount due (outstanding)
  due: string | null;
  daysOverdue: number;
  status: string;
  service: string;
  latestSendDate: string | null;
  created: string | null;
  daysOut: number; // days since created
};

export type Customer = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  tags: string[];
  created: string | null;
  isBusiness: boolean;
};

export type LineItem = {
  id: string;
  name: string;
  kind: string;
  unitCost: number;
  unitPrice: number;
  quantity: number;
  amount: number;
};

export type MaterialJob = {
  jobId: string;
  number: string;
  customer: string;
  address: string;
  status: string;
  completedAt: string | null;
  total: number;
  laborCost: number;
  laborPrice: number;
  taxAmount: number;
  margin: number;
  marginPct: number;
  items: LineItem[];
};

export type Aging = {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
};

// Custom date range. start/end are ISO date strings (YYYY-MM-DD), both inclusive.
export type DateRange = { start: string; end: string };

export type KPIs = {
  total_revenue: number;
  monthly_revenue: number;
  period_revenue: number;
  open_jobs: number;
  jobs_in_progress: number;
  jobs_this_month: number;
  jobs_this_period: number;
  // Job count = jobs CREATED in range, all statuses except canceled (HCP "Job count" report).
  jobs_created_count: number;
  completed_jobs: number;
  cancelled_jobs: number;
  ar_balance: number;
  ar_critical: number;
  open_estimates: number;
  pipeline_value: number;
  collection_rate: number;
  conversion_rate: number;
  avg_estimate_value: number;
  avg_days_to_close: number;
  gross_margin_pct: number;
};

export type FireItem = {
  severity: "critical" | "high" | "medium";
  message: string;
  target: "ar" | "jobs" | "estimates" | "emails" | "ap";
};

export type Contractor = {
  id: string;
  name: string;
  initials: string;
  role: string;
  jobs: number;
  completedJobs: number;
  scheduledJobs: number;
  estimates: number;
  completedEstimates: number;
  scheduledEstimates: number;
  completionRate: number;
  revenue: number;
  avgJobValue: number;
  cancelRate: number;
};

export type CustomerStat = {
  name: string;
  jobs: number;
  jobsThisWeek: number;
  completedJobs: number;
  revenue: number;
  avgJobValue: number;
  estimates: number;
  wonEstimates: number;
  conversionRate: number;
};

export type ServiceBaseline = {
  service: string;
  avg: number;
  min: number;
  max: number;
  sample: number;
};

export type RouteCluster = {
  zip: string;
  jobCount: number;
  totalValue: number;
};

export type CashFlow = {
  collected: number;
  ar_outstanding: number;
  ap_due: number;
  pipeline_30d: number;
  net_position: number;
};

export type DashboardData = {
  kpis: KPIs;
  cashFlow: CashFlow;
  fireItems: FireItem[];
  jobs: Job[];
  estimates: Estimate[];
  ar: Invoice[];
  aging: Aging;
  customers: Customer[];
  customerStats: CustomerStat[];
  contractors: Contractor[];
  baselines: ServiceBaseline[];
  routeClusters: RouteCluster[];
  materialJobs: MaterialJob[];
  lucasMaterialSummary: {
    totalLaborCost: number;
    totalRevenue: number;
    totalMargin: number;
    jobCount: number;
    avgMarginPct: number;
  };
  fetchedAt: string;
  range: DateRange;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  errors?: Record<string, string>;
};
