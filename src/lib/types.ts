export type Job = {
  id: string;
  number: string;
  customer: string;
  address: string;
  status: string;
  tech: string;
  scheduled: string | null;
  total: number | null;
};

export type Estimate = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: number;
  created: string | null;
  updated: string | null;
};

export type Invoice = {
  id: string;
  number: string;
  customer: string;
  total: number;
  due: string | null;
  daysOverdue: number;
  status: string;
};

export type Customer = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  tags: string[];
  created: string | null;
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
  open_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  ar_balance: number;
  open_estimates: number;
  pipeline_value: number;
};

export type DashboardData = {
  kpis: KPIs;
  jobs: Job[];
  estimates: Estimate[];
  ar: Invoice[];
  aging: Aging;
  customers: Customer[];
  fetchedAt: string;
  errors?: Record<string, string>;
};
