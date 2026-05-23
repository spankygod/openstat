import {
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
          href="/dashboard/alerts"
          label="Attention"
          meta="Notifications"
          tone={(data.analytics?.totals.unreadNotifications ?? 0) > 0 ? "warning" : "success"}
          value={formatNumber(data.analytics?.totals.unreadNotifications)}
        />
      </section>

      <DashboardPanel title="Agent health">
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
