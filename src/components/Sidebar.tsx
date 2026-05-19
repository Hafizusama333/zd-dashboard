"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardProvider";

type NavLink = { href: string; label: string; icon: React.ReactNode; badge?: "ar" | "fire" | "jobs" };

const opsLinks: NavLink[] = [
  {
    href: "/",
    label: "Command",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/emails",
    label: "Email Audit",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    badge: "fire",
  },
  {
    href: "/jobs",
    label: "Jobs & Dispatch",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    badge: "jobs",
  },
  {
    href: "/estimates",
    label: "Estimates & Pricing",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3-3-3m3 3V4" />
      </svg>
    ),
  },
];

const finLinks: NavLink[] = [
  {
    href: "/ar",
    label: "Accounts Receivable",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: "ar",
  },
  {
    href: "/ap",
    label: "Contractor AP",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
];

const teamLinks: NavLink[] = [
  {
    href: "/contractors",
    label: "Contractors",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/pricebook",
    label: "Price Book",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data, lastSync } = useDashboard();

  const badgeValue = (badge?: "ar" | "fire" | "jobs"): number | null => {
    if (!data || !badge) return null;
    if (badge === "ar") return data.ar.length;
    if (badge === "fire") return data.fireItems.filter((f) => f.target === "emails").length;
    if (badge === "jobs")
      return data.jobs.filter(
        (j) => ["scheduled", "in_progress", "needs_scheduling"].includes(j.status) && j.tech === "—",
      ).length;
    return null;
  };

  const renderLink = (l: NavLink) => {
    const active = pathname === l.href;
    const bv = badgeValue(l.badge);
    return (
      <Link key={l.href} href={l.href} className={`nav-item${active ? " active" : ""}`}>
        {l.icon}
        {l.label}
        {bv != null && bv > 0 && <span className="nav-badge">{bv}</span>}
      </Link>
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">ZD</div>
        <div>
          <div className="logo-text">ZD Maintenance</div>
          <div className="logo-sub">Command Center</div>
        </div>
      </div>
      <div className="nav">
        <div className="nav-section-label">Operations</div>
        {opsLinks.map(renderLink)}
        <div className="nav-section-label">Finance</div>
        {finLinks.map(renderLink)}
        <div className="nav-section-label">Team</div>
        {teamLinks.map(renderLink)}
      </div>
      <div className="sidebar-footer">
        {lastSync ? `Synced: ${lastSync}` : "Charlotte, NC"}
      </div>
    </nav>
  );
}
