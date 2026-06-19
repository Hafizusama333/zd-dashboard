export const fmtMoney = (val: number | null | undefined): string => {
  if (val == null || (typeof val === "number" && !Number.isFinite(val))) return "—";
  return "$" + Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
};

export const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return (
    dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) +
    " " +
    dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
};

export const badgeClass = (s: string | null | undefined): string => {
  if (!s) return "badge badge-gray";
  const map: Record<string, string> = {
    scheduled: "badge-blue",
    in_progress: "badge-amber",
    dispatched: "badge-blue",
    completed: "badge-green",
    complete_rated: "badge-green",
    complete_unrated: "badge-green",
    cancelled: "badge-gray",
    canceled: "badge-gray",
    pro_canceled: "badge-gray",
    user_canceled: "badge-gray",
    open: "badge-red",
    created_job_from_estimate: "badge-green",
    paid: "badge-green",
    unpaid: "badge-red",
    past_due: "badge-red",
    pending: "badge-amber",
    sent: "badge-blue",
    approved: "badge-green",
    draft: "badge-gray",
    needs_follow_up: "badge-amber",
    needs_scheduling: "badge-amber",
  };
  return `badge ${map[s] || "badge-gray"}`;
};

export const labelize = (s: string | null | undefined): string =>
  s ? s.replace(/_/g, " ") : "unknown";
