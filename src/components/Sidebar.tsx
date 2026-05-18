"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardProvider";

type NavLink = { href: string; label: string; icon: React.ReactNode; badge?: "ar" };

const links: NavLink[] = [
  {
    href: "/",
    label: "Command Center",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "Jobs & Dispatch",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/estimates",
    label: "Estimates",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
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
    href: "/customers",
    label: "Customers",
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data, lastSync } = useDashboard();

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
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-item${active ? " active" : ""}`}
            >
              {l.icon}
              {l.label}
              {l.badge === "ar" && (
                <span className="nav-badge">{data?.ar?.length ?? 0}</span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="sidebar-footer">
        {lastSync ? `Synced: ${lastSync}` : "Last sync: never"}
      </div>
    </nav>
  );
}
