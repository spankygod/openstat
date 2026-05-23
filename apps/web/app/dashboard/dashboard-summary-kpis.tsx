import { DashboardKpiCard, formatNumber } from "./dashboard-components";
import type { DashboardData } from "./dashboard-overview-types";

export function DashboardSummaryKpis(props: { data: DashboardData }) {
  const totals = props.data.analytics?.totals ?? {};
  const series = props.data.analytics?.series ?? [];
  const overview = props.data.overview;
  const onlineAgents =
    overview?.agents.byStatus.online ??
    overview?.agents.byStatus.active ??
    overview?.agents.byStatus.ok ??
    0;
  const totalAgents = overview?.agents.total ?? 0;
  const totalEvents = overview?.events.total ?? 0;
  const failures = totals.failures ?? 0;
  const fills = totals.fills ?? 0;
  const orders = totals.orders ?? 0;
  const riskAndFailures = (totals.riskRejects ?? 0) + (totals.failures ?? 0);

  return (
    <section className="dashboard-kpi-grid" aria-label="Dashboard summary">
      <DashboardKpiCard
        badge={{
          label: `${formatPercentage(onlineAgents, totalAgents)} online`,
          tone: onlineAgents > 0 ? "success" : "warning",
        }}
        href="/dashboard/agents"
        label="Agents"
        tone={onlineAgents > 0 ? "success" : "warning"}
        value={`${formatNumber(onlineAgents)} / ${formatNumber(totalAgents)}`}
      />
      <DashboardKpiCard
        badge={{
          label: `${formatPercentage(failures, totalEvents)} errors`,
          tone: failures > 0 ? "danger" : "success",
        }}
        href="/dashboard?inspect=events"
        label="Events"
        series={series}
        seriesKey="events"
        value={formatNumber(overview?.events.total)}
      />
      <DashboardKpiCard
        badge={{
          label: `${formatPercentage(fills, orders)} filled`,
          tone: fills > 0 ? "success" : "neutral",
        }}
        href="/dashboard/runs"
        label="Trade funnel"
        sparklineSeries={[
          {
            points: series.map((point) => point.decisions),
          },
          {
            points: series.map((point) => point.orders),
            tone: "warning",
          },
          {
            points: series.map((point) => point.fills),
            tone: "success",
          },
        ]}
        value={`${formatNumber(totals.decisions)} / ${formatNumber(totals.orders)} / ${formatNumber(totals.fills)}`}
      />
      <DashboardKpiCard
        badge={{
          label: `${formatPercentage(riskAndFailures, totalEvents)} issues`,
          tone: riskAndFailures > 0 ? "danger" : "success",
        }}
        href="/dashboard/alerts"
        label="Risk & failures"
        sparklineSeries={[
          {
            points: series.map((point) => point.riskRejects),
            tone: "warning",
          },
          {
            points: series.map((point) => point.failures),
            tone: "danger",
          },
        ]}
        tone={riskAndFailures > 0 ? "danger" : "success"}
        value={`${formatNumber(totals.riskRejects)} / ${formatNumber(totals.failures)}`}
      />
    </section>
  );
}

function formatPercentage(value: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  const percentage = (value / total) * 100;

  if (percentage > 0 && percentage < 1) {
    return "<1%";
  }

  return `${Math.round(percentage)}%`;
}
