# ZD Maintenance — Command Center

Next.js 16 dashboard that pulls live data from HousecallPro and renders the same UI as the original `ZD_Dashboard_Live.html`, without the n8n middleman.

## Setup

```bash
npm install
cp .env.example .env.local      # then edit with your real keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

```bash
HCP_API_KEY=...                 # required — HousecallPro API key (server-side only)
HCP_BASE_URL=https://api.housecallpro.com
ANTHROPIC_API_KEY=...           # optional — enables AI chat panels
```

`.env.local` is git-ignored. Keys are read only on the server (route handlers under `src/app/api/`); they never reach the browser.

## Architecture

- `GET /api/dashboard` — calls HCP in parallel (`/jobs`, `/estimates`, `/invoices`, `/customers`), normalizes payloads, computes aging + KPIs, returns one JSON blob.
- `POST /api/chat` — proxies a single Claude message; returns a stub explanation if `ANTHROPIC_API_KEY` is not set.
- `DashboardProvider` (client) — fetches `/api/dashboard` on mount, exposes data + a `refresh()` action via React context. The "Refresh" button in the topbar calls this.
- Pages (`/`, `/jobs`, `/estimates`, `/ar`, `/customers`) read from context and render. Chat panels live next to Jobs / Estimates / AR.

## Notes

- HCP money amounts are returned in cents; the normalizer divides integer values ≥ 100 by 100.
- Invoices don't carry a `customer` field, so we build a `job_id → customer name` map from jobs and join.
- Pagination is capped at 5 pages × 100 items per resource. Bump `pageLimit` in `src/app/api/dashboard/route.ts` if you need more history.
- All HCP status values come with spaces (e.g. `"complete unrated"`). They're normalized to underscores at the boundary; downstream code uses `complete_unrated`, `pro_canceled`, etc.

## Build

```bash
npm run build
npm start
```
