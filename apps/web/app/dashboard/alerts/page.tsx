import {
  getDashboardData,
  getDashboardInspectorData,
} from "../../../lib/openstat-api";
import {
  DashboardDataTable,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
} from "../dashboard-components";
import {
  getFirstParam,
  parseDashboardRange,
  parseInspectorKind,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type AlertsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function AlertsPage(props: AlertsPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const data = await getDashboardData(range);
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/alerts?range=${range}`}
      data={data}
      inspector={inspector}
      range={range}
      title="Alerts"
    >
      <DashboardPanel title="Notification inbox">
        <DashboardDataTable
          empty="No alerts yet."
          items={data.notifications}
          columns={[
            {
              key: "alert",
              label: "Alert",
              render: (notification) => (
                <a
                  className="dashboard-table-primary"
                  href={`/dashboard/alerts?range=${range}&inspect=notification&id=${notification.id}`}
                >
                  {notification.title}
                </a>
              ),
            },
            {
              key: "type",
              label: "Type",
              render: (notification) => notification.type,
            },
            {
              key: "status",
              label: "Status",
              render: (notification) => (
                <DashboardStatusChip status={notification.status} />
              ),
            },
            {
              key: "created",
              label: "Created",
              render: (notification) => formatDateTime(notification.createdAt),
            },
          ]}
        />
      </DashboardPanel>
    </DashboardRouteShell>
  );
}
