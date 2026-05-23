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
  const riskAndFailures = (totals.riskRejects ?? 0) + (totals.failures ?? 0);

  return (
    <section className="dashboard-kpi-grid" aria-label="Dashboard summary">
      <DashboardKpiCard
        href="/dashboard/agents"
        label="Agents"
        tone={onlineAgents > 0 ? "success" : "warning"}
        value={`${formatNumber(onlineAgents)} / ${formatNumber(totalAgents)}`}
      />
      <DashboardKpiCard
        href="/dashboard?inspect=events"
        label="Events"
        series={series}
        seriesKey="events"
        value={formatNumber(overview?.events.total)}
      />
      <DashboardKpiCard
        href="/dashboard/runs"
        label="Decision flow"
        sparklinePoints={series.map(
          (point) => point.decisions + point.orders + point.fills,
        )}
        value={`${formatNumber(totals.decisions)} / ${formatNumber(totals.orders)} / ${formatNumber(totals.fills)}`}
      />
      <DashboardKpiCard
        href="/dashboard/alerts"
        label="Risk & failures"
        sparklinePoints={series.map(
          (point) => point.riskRejects + point.failures,
        )}
        tone={riskAndFailures > 0 ? "danger" : "success"}
        value={`${formatNumber(totals.riskRejects)} / ${formatNumber(totals.failures)}`}
      />
    </section>
  );
}
