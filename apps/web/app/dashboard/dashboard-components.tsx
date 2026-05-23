import type { ReactNode } from "react";

import { Chip, SearchField } from "@heroui/react";
import { AlertTriangle, Bell, Clock3, RefreshCw, Search } from "lucide-react";

import type { DashboardRange } from "../../lib/openstat-api";
import { SignInModal } from "../sign-in-modal";
export { DashboardDataTable } from "./dashboard-data-table";
export { DashboardEmptyState } from "./dashboard-empty-state";
export { DashboardKpiCard } from "./dashboard-kpi-card";
export type { DashboardSparklineKey, KpiTone } from "./dashboard-kpi-card";

export function DashboardTopToolbar(props: {
  eyebrow?: string;
  range: DashboardRange;
  errorCount: number;
  showSignIn?: boolean;
  title?: string;
  unreadNotifications: number;
}) {
  return (
    <header className="dashboard-topbar">
      <div className="dashboard-title-block">
        <p className="dashboard-eyebrow">{props.eyebrow ?? "OpenStat"}</p>
        <h1>{props.title ?? "AI trading agent telemetry"}</h1>
      </div>

      <div className="dashboard-toolbar-actions">
        <SearchField
          aria-label="Search dashboard"
          className="dashboard-search"
          name="dashboard-search"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Search aria-hidden="true" size={15} />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Search runs, trades, traces..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <nav className="dashboard-range-control" aria-label="Dashboard range">
          {(["24h", "7d", "30d"] as const).map((range) => (
            <a
              aria-current={props.range === range ? "page" : undefined}
              className="dashboard-range-link"
              href={`/dashboard?range=${range}`}
              key={range}
            >
              {range}
            </a>
          ))}
        </nav>

        <a
          className="dashboard-icon-link"
          href={`/dashboard?range=${props.range}`}
        >
          <RefreshCw aria-hidden="true" size={16} />
          <span>Refresh</span>
        </a>

        <a className="dashboard-icon-link" href="#alerts">
          <Bell aria-hidden="true" size={16} />
          <span>{props.unreadNotifications || props.errorCount}</span>
        </a>

        {props.showSignIn ? (
          <SignInModal className="dashboard-signin-button">Sign in</SignInModal>
        ) : null}
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
          <h2>{props.title}</h2>
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

export function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}
