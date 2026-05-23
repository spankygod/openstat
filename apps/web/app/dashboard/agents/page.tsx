import {
  type DashboardAgent,
  getDashboardData,
  getDashboardInspectorData,
} from "../../../lib/openstat-api";
import {
  DashboardDataTable,
  DashboardKpiCard,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
  formatNumber,
} from "../dashboard-components";
import {
  getFirstParam,
  parseDashboardRange,
  parseInspectorKind,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type AgentsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function AgentsPage(props: AgentsPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const data = await getDashboardData(range);
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;
  const online =
    data.overview?.agents.byStatus.online ??
    data.overview?.agents.byStatus.active ??
    0;
  const heartbeatTotals = data.agents.reduce(
    (totals, agent) => {
      totals.healthy += agent.heartbeatHealth?.healthyHeartbeats ?? 0;
      totals.received += agent.heartbeatHealth?.receivedHeartbeats ?? 0;

      return totals;
    },
    { healthy: 0, received: 0 },
  );
  const fleetUptime =
    heartbeatTotals.received > 0
      ? Math.round((heartbeatTotals.healthy / heartbeatTotals.received) * 100)
      : 0;

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/agents?range=${range}`}
      data={data}
      inspector={inspector}
      range={range}
      title="Agents"
    >
      <section className="dashboard-kpi-grid dashboard-route-kpis">
        <DashboardKpiCard
          href="/dashboard/agents"
          label="Online"
          meta="Healthy heartbeats"
          tone={online > 0 ? "success" : "warning"}
          value={formatNumber(online)}
        />
        <DashboardKpiCard
          href="/dashboard/agents"
          label="Total agents"
          meta="In this project"
          value={formatNumber(data.overview?.agents.total)}
        />
        <DashboardKpiCard
          href="/dashboard/agents"
          label="Heartbeat uptime"
          meta={`${formatNumber(heartbeatTotals.received)} logged in ${range}`}
          tone={
            fleetUptime >= 95
              ? "success"
              : fleetUptime >= 80
                ? "warning"
                : "danger"
          }
          value={`${fleetUptime}%`}
        />
        <DashboardKpiCard
          href="/dashboard/alerts"
          label="Attention"
          meta="Notifications"
          tone={
            (data.analytics?.totals.unreadNotifications ?? 0) > 0
              ? "warning"
              : "success"
          }
          value={formatNumber(data.analytics?.totals.unreadNotifications)}
        />
      </section>

      <DashboardPanel className="dashboard-route-panel" title="Agents Uptime">
        <AgentsUptimeMonitor agents={data.agents} range={range} />
      </DashboardPanel>

      <DashboardPanel className="dashboard-route-panel" title="Agent health">
        <DashboardDataTable
          empty="No agents yet."
          items={data.agents}
          columns={[
            {
              key: "agent",
              label: "Agent",
              render: (agent) => (
                <a
                  className="dashboard-table-primary"
                  href={`/dashboard/agents?range=${range}&inspect=agent&id=${agent.id}`}
                >
                  {agent.name}
                </a>
              ),
            },
            {
              key: "external",
              label: "External ID",
              render: (agent) => agent.externalId ?? agent.id,
            },
            {
              key: "status",
              label: "Status",
              render: (agent) => <DashboardStatusChip status={agent.status} />,
            },
            {
              key: "lastSeen",
              label: "Last seen",
              render: (agent) => formatDateTime(agent.lastSeenAt),
            },
          ]}
        />
      </DashboardPanel>
    </DashboardRouteShell>
  );
}

function AgentsUptimeMonitor(props: {
  agents: DashboardAgent[];
  range: "24h" | "7d" | "30d";
}) {
  const totals = props.agents.reduce(
    (current, agent) => {
      current.healthy += agent.heartbeatHealth?.healthyHeartbeats ?? 0;
      current.received += agent.heartbeatHealth?.receivedHeartbeats ?? 0;

      return current;
    },
    { healthy: 0, received: 0 },
  );
  const uptimePercent =
    totals.received > 0
      ? Math.round((totals.healthy / totals.received) * 100)
      : 0;
  const state =
    uptimePercent >= 95
      ? "Operational"
      : uptimePercent >= 80
        ? "Degraded"
        : "Needs attention";
  const tone =
    uptimePercent >= 95 ? "good" : uptimePercent >= 80 ? "watch" : "bad";
  const bars = buildUptimeBars(uptimePercent, 72, tone);

  return (
    <div className="agent-uptime-monitor">
      <div className="agent-uptime-summary">
        <div>
          <span className="agent-uptime-title">Agents Uptime</span>
          <span className="agent-uptime-value">{uptimePercent}%</span>
          <small>
            {formatNumber(totals.received)} heartbeats in {props.range}
          </small>
        </div>
        <strong className={`agent-uptime-state agent-uptime-state-${tone}`}>
          {state}
        </strong>
      </div>

      <div
        aria-label={`Agents uptime ${uptimePercent}% over ${props.range}`}
        className="agent-uptime-bars"
        role="img"
      >
        {bars.map((bar, index) => (
          <span
            className={`agent-uptime-bar agent-uptime-${bar}`}
            key={index}
          />
        ))}
      </div>

      <div className="agent-uptime-agent-grid">
        {props.agents.map((agent) => (
          <a
            className="agent-uptime-agent"
            href={`/dashboard/agents?range=${props.range}&inspect=agent&id=${agent.id}`}
            key={agent.id}
          >
            <span>{agent.name}</span>
            <strong>{agent.heartbeatHealth?.uptimePercent ?? 0}%</strong>
          </a>
        ))}
      </div>
    </div>
  );
}

function buildUptimeBars(
  uptimePercent: number,
  count: number,
  degradedTone: "good" | "watch" | "bad",
) {
  const degradedCount = Math.max(
    0,
    Math.min(count, Math.round(count * ((100 - uptimePercent) / 100))),
  );

  return Array.from({ length: count }, (_, index) =>
    index >= count - degradedCount ? degradedTone : "good",
  );
}
