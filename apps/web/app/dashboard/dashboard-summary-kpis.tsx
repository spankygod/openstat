import {
  DashboardKpiCard,
  formatNumber,
  type DashboardKpiMonitorTone,
} from "./dashboard-components";
import type { DashboardData } from "./dashboard-overview-types";

export function DashboardSummaryKpis(props: { data: DashboardData }) {
  const totals = props.data.analytics?.totals ?? {};
  const series = props.data.analytics?.series ?? [];
  const overview = props.data.overview;
  const freshHeartbeatAgents =
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
  const heartbeatTotals = props.data.agents.reduce(
    (current, agent) => {
      current.healthy += agent.heartbeatHealth?.healthyHeartbeats ?? 0;
      current.received += agent.heartbeatHealth?.receivedHeartbeats ?? 0;

      return current;
    },
    { healthy: 0, received: 0 },
  );
  const fleetUptime =
    heartbeatTotals.received > 0
      ? Math.round((heartbeatTotals.healthy / heartbeatTotals.received) * 100)
      : 0;
  const fleetUptimeTone = getUptimeTone(fleetUptime);

  return (
    <section className="dashboard-kpi-grid" aria-label="Dashboard summary">
      <DashboardKpiCard
        badge={{
          label: `${formatPercentage(freshHeartbeatAgents, totalAgents)} current`,
          tone: freshHeartbeatAgents > 0 ? "success" : "warning",
        }}
        href="/dashboard/agents"
        label="Agents"
        monitorBars={buildUptimeBars(fleetUptime, 24, fleetUptimeTone)}
        monitorLabel={`Agent heartbeat uptime ${fleetUptime}%`}
        tone={freshHeartbeatAgents > 0 ? "success" : "warning"}
        value={`${formatNumber(freshHeartbeatAgents)} / ${formatNumber(totalAgents)}`}
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
            tone: "neutral",
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
        value={
          <span className="dashboard-kpi-value-parts">
            <span className="dashboard-kpi-value-part dashboard-kpi-value-neutral">
              {formatNumber(totals.decisions)}
            </span>
            <span className="dashboard-kpi-value-separator">/</span>
            <span className="dashboard-kpi-value-part dashboard-kpi-value-warning">
              {formatNumber(totals.orders)}
            </span>
            <span className="dashboard-kpi-value-separator">/</span>
            <span className="dashboard-kpi-value-part dashboard-kpi-value-success">
              {formatNumber(totals.fills)}
            </span>
          </span>
        }
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
            tone: "danger",
          },
          {
            points: series.map((point) => point.failures),
            tone: "warning",
          },
        ]}
        tone={riskAndFailures > 0 ? "danger" : "success"}
        value={
          <span className="dashboard-kpi-value-parts">
            <span className="dashboard-kpi-value-part dashboard-kpi-value-danger">
              {formatNumber(totals.riskRejects)}
            </span>
            <span className="dashboard-kpi-value-separator">/</span>
            <span className="dashboard-kpi-value-part dashboard-kpi-value-warning">
              {formatNumber(totals.failures)}
            </span>
          </span>
        }
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

function getUptimeTone(uptimePercent: number): DashboardKpiMonitorTone {
  return uptimePercent >= 95 ? "good" : uptimePercent >= 80 ? "watch" : "bad";
}

function buildUptimeBars(
  uptimePercent: number,
  count: number,
  degradedTone: DashboardKpiMonitorTone,
) {
  const degradedCount = Math.max(
    0,
    Math.min(count, Math.round(count * ((100 - uptimePercent) / 100))),
  );

  return Array.from({ length: count }, (_, index) => ({
    tone: index >= count - degradedCount ? degradedTone : "good",
  }));
}
