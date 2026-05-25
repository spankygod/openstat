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
  const series = data.analytics?.series ?? [];
  const totalAgents = data.overview?.agents.total ?? 0;
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;
  const freshHeartbeatAgents =
    data.overview?.agents.byStatus.online ??
    data.overview?.agents.byStatus.active ??
    data.overview?.agents.byStatus.ok ??
    0;
  const attentionCount = data.analytics?.totals.unreadNotifications ?? 0;
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
  const fleetUptimeTone = getUptimeTone(fleetUptime);
  const fleetUptimeState =
    fleetUptime >= 95
      ? "Operational"
      : fleetUptime >= 80
        ? "Degraded"
        : "Needs attention";

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
          badge={{
            label: `${formatPercentage(freshHeartbeatAgents, totalAgents)} current`,
            tone: freshHeartbeatAgents > 0 ? "success" : "warning",
          }}
          href="/dashboard/agents"
          label="Current heartbeat"
          series={series}
          seriesKey="activeAgents"
          tone={freshHeartbeatAgents > 0 ? "success" : "warning"}
          value={formatNumber(freshHeartbeatAgents)}
        />
        <DashboardKpiCard
          badge={{
            label: `${formatNumber(totalAgents)} tracked`,
            tone: "neutral",
          }}
          href="/dashboard/agents"
          label="Total agents"
          value={formatNumber(totalAgents)}
        />
        <DashboardKpiCard
          badge={{
            label: fleetUptimeState,
            tone:
              fleetUptime >= 95
                ? "success"
                : fleetUptime >= 80
                  ? "warning"
                  : "danger",
          }}
          href="/dashboard/agents"
          label="Heartbeat uptime"
          monitorBars={buildKpiUptimeBars(fleetUptime, 24, fleetUptimeTone)}
          monitorLabel={`Agent heartbeat uptime ${fleetUptime}% over ${range}`}
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
          badge={{
            label: attentionCount > 0 ? "Needs review" : "Clear",
            tone: attentionCount > 0 ? "warning" : "success",
          }}
          href="/dashboard/alerts"
          label="Attention"
          tone={attentionCount > 0 ? "warning" : "success"}
          value={formatNumber(attentionCount)}
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
  const tone = getUptimeTone(uptimePercent);
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
        {props.agents.map((agent) => {
          const agentUptime = agent.heartbeatHealth?.uptimePercent ?? 0;
          const agentTone = getUptimeTone(agentUptime);
          const agentBars = buildUptimeBars(agentUptime, 18, agentTone);

          return (
            <a
              className="agent-uptime-agent"
              href={`/dashboard/agents?range=${props.range}&inspect=agent&id=${agent.id}`}
              key={agent.id}
            >
              <span className="agent-uptime-agent-header">
                <span>{agent.name}</span>
                <strong>{agentUptime}%</strong>
              </span>
              <span
                aria-label={`${agent.name} uptime ${agentUptime}% over ${props.range}`}
                className="agent-uptime-agent-bars"
                role="img"
              >
                {agentBars.map((bar, index) => (
                  <span
                    className={`agent-uptime-agent-bar agent-uptime-${bar}`}
                    key={index}
                  />
                ))}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function getUptimeTone(uptimePercent: number) {
  return uptimePercent >= 95 ? "good" : uptimePercent >= 80 ? "watch" : "bad";
}

function buildKpiUptimeBars(
  uptimePercent: number,
  count: number,
  degradedTone: "good" | "watch" | "bad",
) {
  return buildUptimeBars(uptimePercent, count, degradedTone).map((tone) => ({
    tone,
  }));
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
