# ZD Maintenance — Command Center · Developer Handover

Live business-intelligence dashboard for **ZD Maintenance** (Charlotte, NC). Pulls data from
**HousecallPro** (jobs/estimates/invoices/customers), **Gmail via n8n webhooks** (email audit),
and a **Google Sheet via n8n webhook** (contractor accounts-payable). Normalizes everything and
renders KPIs, aging, contractor stats, material margins, etc.

Built to replace an older static `ZD_Dashboard_Live.html` + n8n-middleman setup — the HCP data
now flows through this app's own API routes instead of n8n.

---

## 1. Stack

| | |
|---|---|
| Framework | **Next.js 16.2.6** (App Router). ⚠️ Non-standard/breaking build — see `AGENTS.md`; read `node_modules/next/dist/docs/` before writing Next code. |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) + `src/app/globals.css` |
| Language | TypeScript 5 |
| Email fetch | `imapflow` (in `src/lib/gmail.ts`) — **currently unused by routes**; email page uses the n8n webhook instead |
| Fonts | DM Sans + DM Mono (next/font) |

**Scripts:** `npm run dev` · `npm run build` · `npm start` · `npm run lint`

---

## 2. Environment variables

`.env.local` (git-ignored). Read **server-side only** — never reach the browser.

| Var | Required | Purpose |
|---|---|---|
| `HCP_API_KEY` | ✅ | HousecallPro API key. Sent as `Authorization: Token <key>`. |
| `HCP_BASE_URL` | ⚠️ default `https://api.housecallpro.com` | HCP API base. |
| `ANTHROPIC_API_KEY` | optional | Enables AI chat panels. Without it `/api/chat` returns a stub. |
| `GMAIL_USER` | optional | Gmail address for IMAP reader (`src/lib/gmail.ts`, currently unwired). |
| `GMAIL_APP_PASSWORD` | optional | 16-char Google App Password (not the plain account password). |

**Hardcoded external URLs** (not env — change in code if they rotate):
- AP sheet webhook: `src/app/api/ap/route.ts` → `https://zdmaintenance.app.n8n.cloud/webhook/1c405bba-...`
- Email webhook: `src/app/api/emails/route.ts` → `https://zdmaintenance.app.n8n.cloud/webhook/bb1b9e56-...`

**Hardcoded HCP IDs** (`src/lib/normalize.ts`):
- `ZD_GENERIC_ID = "pro_ace920fd9c4344e78367974cf1e4b5d5"` — generic "ZD Maintenance" employee; real contractor resolved from job tags.
- `LUCAS_EMPLOYEE_ID = "pro_4c8790abf70e4ada9b2dedc4e95128b1"` — drives the Material Costs page.

---

## 3. Data flow

```
Browser (pages) ──▶ DashboardProvider (React context)
                        └─▶ GET /api/dashboard?start&end ──▶ HCP API (jobs/estimates/invoices/customers)
                                                              normalize + compute → 1 JSON blob (DashboardData)

AP page  ──▶ GET  /api/ap        ──▶ n8n webhook (Google Sheet)  → contractor AP rows
         └─▶ POST /api/ap/costs  ──▶ HCP /jobs + line_items       → match rows to jobs, return billed cost + completion
Emails   ──▶ GET  /api/emails    ──▶ n8n webhook (Gmail)          → inbound message list
Chat     ──▶ POST /api/chat      ──▶ Anthropic Messages API       → single-shot reply
```

`DashboardProvider` (`src/components/DashboardProvider.tsx`) fetches `/api/dashboard` on mount and
whenever the date range changes, exposing `{ data, status, refresh, range, setRange }` via context.
All main pages read from that one blob. AP and Emails pages fetch their own endpoints directly.

---

## 4. API endpoints

### `GET /api/dashboard`  — `src/app/api/dashboard/route.ts`
The workhorse. `force-dynamic`, no cache.

**Query params:** `start`, `end` (both `YYYY-MM-DD`, inclusive). Invalid/missing → default range
(**last day of previous month → today**). If `start > end` they're swapped.

**Behavior:** fires 6 HCP fetches in parallel, each wrapped in `safe()` so one failure doesn't kill
the response (errors collected into `data.errors`). Then fetches per-job line items (throttled) for
gross-margin and Lucas material calcs.

The 6 parallel fetches:
| Key | Source | Windowing |
|---|---|---|
| `jobs` | `/jobs` | page newest-first, stop past window by **scheduled date** (`jobScheduledDate`) |
| `estimates` | `/estimates` | page newest-first, stop by **completed-or-created** date |
| `invoices` | `/invoices?status[]=open` | all-time open (unpaid) invoices = the AR set |
| `customers` | `/customers` | up to 5 pages |
| `revenue_jobs` | `/jobs` server-filtered `scheduled_start_min/max` + `work_status[]=completed` | **exact** "Job revenue earned" set |
| `created_jobs` | `/jobs` | newest-first, stop by **created** date → for "Job count" |

Then: builds `job_id → {customer, service, address, zip, number}` maps, resolves each open
invoice's Job # via per-job `GET /jobs/{id}` (throttled `mapPool` concurrency 4), fetches line
items for the revenue set (margin) and Lucas jobs (materials).

**Returns** `DashboardData` (see `src/lib/types.ts`) — full object below in §6.

`pageLimit` scales with span: `>270d→50`, `>90d→25`, `>31d→12`, else `6` pages.

---

### `GET /api/ap`  — `src/app/api/ap/route.ts`
Fetches contractor accounts-payable rows from the **n8n Google-Sheet webhook**.

⚠️ The sheet's column keys are literal gibberish (`adfdfdsafadsfd`, `fasdfdsfdsfsd`, `fdsf`) — the
route maps them by meaning:

| Sheet key | → field |
|---|---|
| `adfdfdsafadsfd` | `submitted` (timestamp) |
| `fasdfdsfdsfsd` | `contractor` |
| `fdsf` | `address` |
| `Work order number (...)` | `wo` |
| `Amount (cantidad)` | `amount` |
| `Pics sent (fotos enviadas)` | `picsSent` (bool) |
| `Paid` | `paid` (bool) |
| `Invoice Number` | `invoiceNumber` |

Rows without a contractor **and** WO# are dropped. Returns `{ rows: APRow[] }`. On webhook failure → `502 { error, rows: [] }`.

---

### `POST /api/ap/costs`  — `src/app/api/ap/costs/route.ts`
Given AP rows, returns each row's **billed cost** (from HCP line items) and **completion status**.

**Body:** `{ items: [{ key, address, wo }] }`
**Returns:** `{ costs: { [key]: number|null }, completed: { [key]: boolean|null } }`

**Matching logic:**
1. Builds a job index (module-level cache, **5-min TTL**) from `/jobs` (40 pages): `newestByStreet`, `byInvoiceNumber` (invoice#→jobId), `statusByJob`.
2. Each row → **newest job at that street** (`streetKey` = `<number> <firstword>`, fuzzy). Fallback: WO# → `invoice_number` match.
3. Fetch that job's line items (throttled 5, retry on 429), sum non-tax `unit_price × quantity`.
4. `completed` = job's `work_status` starts with `complete`.

---

### `GET /api/emails`  — `src/app/api/emails/route.ts`
Inbound Gmail messages via the **n8n Gmail webhook**. Decodes base64url MIME (prefers `text/plain`,
falls back to tag-stripped `text/html`), parses `From`, dates (`internalDate` epoch ms, then
`Date`), and labels. `seen` = message has **no** `UNREAD` label. Returns `{ stub: false, emails: LiveEmail[] }`.

> Note: `src/lib/gmail.ts` is a **standalone IMAP reader** (imapflow, App Password) that is **not
> currently wired to any route** — the email page uses the webhook instead. Kept as an alternative source.

---

### `POST /api/chat`  — `src/app/api/chat/route.ts`
Single-shot proxy to Anthropic Messages API. **Body:** `{ message, system? }`. Model
`claude-sonnet-4-6`, `max_tokens: 1024`. No `ANTHROPIC_API_KEY` → returns `{ reply: <stub>, stub: true }`.
⚠️ Stateless — no conversation history sent; each call is one user message.

---

## 5. Key formulas & business rules (`src/lib/normalize.ts`)

**⚠️ Money is in cents.** `money()` divides any integer ≥ 100 by 100. HCP returns amounts in cents;
this is the single conversion point. Non-integer or small values pass through.

### Revenue
- **Job revenue earned (`period_revenue` / `total_revenue`)** = Σ pre-tax **`subtotal`** over jobs
  whose **scheduled date** ∈ range **AND** `work_status = completed`. Falls back to `total` if
  `subtotal` absent. Matches HCP's "Job revenue earned" report. Computed precisely from the
  server-filtered `revenue_jobs` set (`sumJobRevenue`). `total_revenue` is deliberately **equal** to `period_revenue` (per client request).
- **`monthly_revenue`** = Σ `total` over completed jobs completed month-to-date (by `completed_at`, not scheduled — ~40% of jobs have null `scheduled_start`).

### Counts
- **`jobs_created_count`** = jobs **created** in range, **all statuses except canceled** (HCP "Job count" report). `countJobsCreated`.
- **`jobs_this_period`** = count of the completed-in-range revenue set.
- `open_jobs` = status ∈ {scheduled, in_progress, dispatched, needs_scheduling}. `jobs_in_progress` = status `in_progress`.

### Estimate conversion (`conversion_rate`)
Bucketed by **option `approval_status`**, over estimates **created** in range (`computeConversion`):
- `won` = any option approved · `lost` = any option declined · `open` = pending · `excluded` = canceled (dropped).
- **rate = won / (won + lost + open) × 100.**

### Gross margin (`gross_margin_pct`)
Over the revenue set's line items (`computeGrossMargin`): `(revenue − cost) / revenue × 100`,
where `revenue` = Σ non-tax line `amount`, `cost` = Σ non-tax `unit_cost × quantity`. **Fallback = 41** if no data.

### AR / aging (`computeAging`)
Buckets **open invoice `total` (amount due)** by `daysOverdue` (from `due_at`):
`current (≤0)`, `1–30`, `31–60`, `61–90`, `90+`. `ar_critical` = Σ invoices `daysOverdue > 60`.
`collection_rate = revenue / (revenue + agingTotal) × 100`. `pipeline_value` = total open AR.

### Other KPIs
- `avg_estimate_value` = mean of positive estimate totals.
- `avg_days_to_close` = mean (`updated − created`) days over won estimates.

### Contractors (`computeContractors`)
Attributes each job/estimate to `assigned_employees[0]`. If that's the **generic ZD employee**, uses
the contractor name from **job tags** (excluding process/trade tags via `NON_CONTRACTOR` regex).
`completionRate = completed/jobs`, `cancelRate = cancelled/jobs`, `avgJobValue = revenue/completed`.

### Materials / Lucas (`buildMaterialJob`, `summarizeMaterials`)
Only jobs assigned to **`LUCAS_EMPLOYEE_ID`** (max 30). Per job: `laborCost = Σ labor unit_cost×qty`,
`laborPrice = Σ labor amount`, `margin = laborPrice − laborCost`, `marginPct = margin/laborPrice`.

### Fire items (`computeFireItems`) — alert feed
`STALE_HOURS = 72`. Triggers: invoices 30+ days overdue (**critical**); jobs unscheduled 72h+
(**critical**); jobs with no contractor (**critical**); estimates unscheduled 72h+ (**critical**);
completed estimates awaiting invoice 72h+ (**high**); jobs past scheduled date (**high**).

### Route clusters (`computeRouteClusters`)
Open jobs grouped by ZIP, only ZIPs with **≥2** jobs, top 5 by total value.

### Service categorization (`guessService`)
Regex over free-text job/estimate description → Plumbing / Electrical / HVAC / Roofing / Flooring /
Painting / Drywall / Carpentry / Landscaping / etc. Order matters (specific before generic).

### Customer name resolution
- `companyOnlyName` (jobs, estimates): **company only**, else `—`.
- `customerName` (AR): company, else person name. Client wants the **business** name (e.g. property-management company), not the tenant.

### ⚠️ Hardcoded / placeholder values to revisit
- `computeCashFlow`: **`apDue = 7200`** is hardcoded. `net_position = collected − 7200`.
- `gross_margin_pct` fallback **41**.
- Pricebook page (`src/app/pricebook/page.tsx`): `LINE_ITEMS` array and `ASSUMED_MARGIN` are **static demo data**, not live.

---

## 6. Core types (`src/lib/types.ts`)

`DashboardData` (the `/api/dashboard` response) contains:
`kpis` (`KPIs`), `cashFlow`, `fireItems[]`, `jobs[]`, `estimates[]`, `ar[]` (invoices), `aging`,
`customers[]`, `customerStats[]`, `contractors[]`, `baselines[]` (per-service avg/min/max),
`routeClusters[]`, `materialJobs[]`, `lucasMaterialSummary`, plus `range`, `periodLabel`,
`periodStart/End`, `fetchedAt`, and optional `errors`.

See `types.ts` for every field — it's the source of truth for the data contract.

---

## 7. HCP client helpers (`src/lib/hcp.ts`)

- `hcpFetch` — single GET, `Token` auth, throws on non-2xx.
- `fetchWithRetry` — honors `Retry-After` on **429**, else exponential backoff (max 4 retries).
- `hcpFetchAll` — generic paginator (stops when a page < pageSize).
- `hcpFetchSince` — pages newest-first, stops once a full page predates `sinceISO − bufferDays` (14-day buffer for lagging `completed_at`).
- `hcpFetchJobsScheduled` — server-side `scheduled_start_min/max` + `work_status[]` filter (the revenue set).
- `hcpJobLineItems(jobId)` — `GET /jobs/{id}/line_items`.
- `mapPool(items, limit, fn)` — bounded-concurrency map to stay under HCP rate limits.

---

## 8. Pages (all client components, App Router)

| Route | File | Reads |
|---|---|---|
| `/` Command | `src/app/page.tsx` | dashboard context (KPIs, fire items, cashflow) |
| `/emails` Email Audit | `src/app/emails/page.tsx` | `GET /api/emails` |
| `/jobs` Jobs & Dispatch | `src/app/jobs/page.tsx` | context `.jobs` |
| `/estimates` | `src/app/estimates/page.tsx` | context `.estimates` |
| `/ar` Accounts Receivable | `src/app/ar/page.tsx` | context `.ar`, `.aging` |
| `/ap` Contractor AP | `src/app/ap/page.tsx` | `GET /api/ap` + `POST /api/ap/costs` |
| `/contractors` | `src/app/contractors/page.tsx` | context `.contractors` |
| `/customers` | `src/app/customers/page.tsx` | context `.customerStats` |
| `/materials` Material Costs | `src/app/materials/page.tsx` | context `.materialJobs`, `.lucasMaterialSummary` |
| `/pricebook` Price Book | `src/app/pricebook/page.tsx` | context `.baselines` + **static demo rows** |

**Shared components** (`src/components/`): `Sidebar` (nav + live badges), `Topbar` (refresh + date
range), `DashboardProvider` (context), `LoadingOverlay`, `ChatPanel` (AI, POSTs `/api/chat`),
`StatusBadge`, `AgingRow`, `DataSourceTooltip` (shows each table's data provenance).

---

## 9. Gotchas / notes for the next dev

1. **Next.js 16 is non-standard here.** `AGENTS.md`/`CLAUDE.md` warn that APIs/conventions differ from stock — check `node_modules/next/dist/docs/` before writing framework code.
2. **All money in cents** from HCP. Only convert via `money()`.
3. **HCP statuses have spaces** (`"complete unrated"`). Normalized to underscores at the boundary (`complete_unrated`, `pro_canceled`).
4. **Estimate `total_amount` is usually null** — real value = sum of `options[].total_amount`.
5. **Invoices carry no customer/address** — joined from jobs via `job_id` maps.
6. **AP sheet column names are gibberish** — mapping in `/api/ap`. If the sheet columns change, update `RawRow`.
7. **AP cost matching is fuzzy** (street `<number> <firstword>`), can mis-match; WO#→invoice_number is the fallback.
8. `apDue` cash-flow figure is **hardcoded 7200** — no live AP-total source yet.
9. **`src/lib/gmail.ts` (IMAP) is dead code** relative to routes; email uses the n8n webhook.
10. Pagination caps scale with date span; widen `pageLimit` in the dashboard route for deeper history.
11. `/api/chat` is **stateless single-shot** — no history. Model id `claude-sonnet-4-6` is hardcoded.
12. Everything is **read-only** — no writes back to HCP, the sheet, or Gmail.
