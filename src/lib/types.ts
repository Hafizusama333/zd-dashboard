export type Job = {
  id: string;
  number: string;
  customer: string;
  address: string;
  status: string;
  tech: string;
  techId: string | null;
  scheduled: string | null;
  total: number | null;
  service: string;
  zip: string;
};

export type Estimate = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: number;
  service: string;
  created: string | null;
  updated: string | null;
  daysSinceSent: number;
};

export type Invoice = {
  id: string;
  number: string;
  customer: string;
  total: number;
  due: string | null;
  daysOverdue: number;
  status: string;
  service: string;
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

export type KPIs = {
  total_revenue: number;
  monthly_revenue: number;
  open_jobs: number;
  jobs_in_progress: number;
  jobs_this_month: number;
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
  completionRate: number;
  revenue: number;
  avgJobValue: number;
  cancelRate: number;
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
  errors?: Record<string, string>;
};
