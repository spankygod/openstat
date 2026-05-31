import type { ReactNode } from "react";

import { Chip, SearchField } from "@heroui/react";
import { AlertTriangle, Bell, Clock3, RefreshCw, Search } from "lucide-react";

import type { DashboardRange } from "../../lib/openstat-api";
import { DashboardSidebarToggle } from "./dashboard-sidebar";
import { DashboardThemeModeControl } from "./dashboard-theme-mode-control";
export { DashboardDataTable } from "./dashboard-data-table";
export { DashboardEmptyState } from "./dashboard-empty-state";
export { DashboardKpiCard } from "./dashboard-kpi-card";
export type {
  DashboardKpiMonitorTone,
  DashboardSparklineKey,
  KpiTone,
} from "./dashboard-kpi-card";

export function DashboardTopToolbar(props: {
  eyebrow?: string;
  range: DashboardRange;
  rangeBasePath?: string;
  showSignIn?: boolean;
  title?: string;
  unreadNotifications: number;
}) {
  const rangeBasePath = props.rangeBasePath ?? "/dashboard";

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-toolbar-actions">
        <DashboardSidebarToggle />

        <div className="dashboard-toolbar-utility-actions">
          <SearchField
            aria-label="Search dashboard"
            className="dashboard-search"
            name="dashboard-search"
            variant="secondary"
          >
            <SearchField.Group className="dashboard-search-group">
              <SearchField.SearchIcon className="dashboard-search-icon">
                <Search aria-hidden="true" size={15} />
              </SearchField.SearchIcon>
              <SearchField.Input
                className="dashboard-search-input"
                placeholder="Search runs, trades, traces..."
              />
            </SearchField.Group>
          </SearchField>

          <a className="dashboard-icon-link" href="#alerts">
            <Bell aria-hidden="true" size={16} />
            <span>{props.unreadNotifications}</span>
          </a>

          <DashboardThemeModeControl />
        </div>
      </div>

      <div className="dashboard-toolbar-main">
        <div className="dashboard-title-block">
          <h1>{props.title ?? "AI trading agent telemetry"}</h1>
        </div>

        <div className="dashboard-toolbar-secondary-actions">
          <span className="dashboard-timeframe-label">Timeframe</span>
          <nav className="dashboard-range-control" aria-label="Dashboard range">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <a
                aria-current={props.range === range ? "page" : undefined}
                className="dashboard-range-link"
                href={`${rangeBasePath}?range=${range}`}
                key={range}
              >
                {range}
              </a>
            ))}
          </nav>

          <a
            aria-label="Refresh dashboard"
            className="dashboard-icon-link"
            href={`${rangeBasePath}?range=${props.range}`}
          >
            <RefreshCw aria-hidden="true" size={16} />
          </a>

          {props.showSignIn ? (
            <a className="dashboard-signin-button" href="/sign-in">
              Sign in
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function DashboardPanel(props: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  id?: string;
  title: string;
  titleCount?: number;
}) {
  return (
    <section
      className={["dashboard-panel", props.className].filter(Boolean).join(" ")}
      id={props.id}
    >
      <div className="dashboard-panel-header">
        <div>
          {props.eyebrow ? (
            <p className="dashboard-panel-eyebrow">{props.eyebrow}</p>
          ) : null}
          <div className="dashboard-panel-title-row">
            <h2>{props.title}</h2>
            {typeof props.titleCount === "number" ? (
              <Chip
                className="dashboard-panel-title-count"
                size="sm"
                variant="soft"
              >
                <Chip.Label>{props.titleCount}</Chip.Label>
              </Chip>
            ) : null}
          </div>
        </div>
        {props.actions ? (
          <div className="dashboard-panel-actions">{props.actions}</div>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

export function DashboardStatusChip(props: { status: string }) {
  const normalized = props.status.toLowerCase();
  const color =
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("revoked")
      ? "danger"
      : normalized.includes("stale") || normalized.includes("pending")
        ? "warning"
        : normalized.includes("active") ||
            normalized.includes("online") ||
            normalized.includes("ok") ||
            normalized.includes("filled")
          ? "success"
          : "default";

  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{props.status}</Chip.Label>
    </Chip>
  );
}

export function DashboardAttentionItem(props: {
  href: string;
  meta: string;
  title: string;
  tone?: "danger" | "warning" | "neutral";
}) {
  const Icon = props.tone === "danger" ? AlertTriangle : Clock3;

  return (
    <a
      className={`dashboard-attention-item dashboard-attention-${props.tone ?? "neutral"}`}
      href={props.href}
    >
      <span className="dashboard-attention-icon">
        <Icon aria-hidden="true" size={15} />
      </span>
      <span>
        <strong>{props.title}</strong>
        <small>{props.meta}</small>
      </span>
    </a>
  );
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Unknown";
  }

  const seconds = Math.round((date.valueOf() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absoluteSeconds < 60) {
    return formatter.format(seconds, "second");
  }

  const minutes = Math.round(seconds / 60);

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);

  return formatter.format(days, "day");
}

export function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

export function formatPnl(value?: number) {
  const amount = value ?? 0;
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${formatted}`;
}
