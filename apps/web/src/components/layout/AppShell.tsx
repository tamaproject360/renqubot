"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: "DB" },
  { label: "Setup", href: "/setup", icon: "ST" },
  { label: "Integrations", href: "/integrations", icon: "IN" },
  { label: "WhatsApp", href: "/whatsapp", icon: "WA" },
  { label: "Transactions", href: "/transactions", icon: "TR" },
  { label: "Categories", href: "/categories", icon: "CT" },
  { label: "System", href: "/system", icon: "SY" },
];

const getPageTitle = (pathname: string) => {
  const activeItem = navigationItems.find((item) =>
    pathname.startsWith(item.href),
  );
  return activeItem?.label ?? "Dashboard";
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? "app-shell app-shell--collapsed" : "app-shell"}>
      <aside className="sidebar" aria-label="Navigasi utama admin">
        <div className="sidebar__brand">
          <div className="sidebar__logo" aria-hidden="true">
            RB
          </div>
          <div className="sidebar__brand-copy">
            <div className="sidebar__title">Renqu Bot</div>
            <div className="sidebar__subtitle">Finance Operations</div>
          </div>
        </div>

        <button
          aria-pressed={collapsed}
          className="sidebar__collapse"
          type="button"
          onClick={() => setCollapsed((current) => !current)}
        >
          <span aria-hidden="true">{collapsed ? ">" : "<"}</span>
          <span className="sidebar__label">
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </button>

        <nav className="sidebar__nav">
          {navigationItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "sidebar__link sidebar__link--active"
                    : "sidebar__link"
                }
                href={item.href}
              >
                <span className="sidebar__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sidebar__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <strong>Admin Console</strong>
          <p
            style={{
              color: "#bfdbfe",
              fontSize: 13,
              lineHeight: 1.5,
              margin: "8px 0 0",
            }}
          >
            Setup, monitoring, dan kontrol operasional bot keuangan.
          </p>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <div className="topbar__eyebrow">Renqu Bot Control Center</div>
            <div className="topbar__title">{getPageTitle(pathname)}</div>
          </div>
          <div className="topbar__status">
            <span aria-hidden="true">●</span>
            Corporate Blue Theme
          </div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
