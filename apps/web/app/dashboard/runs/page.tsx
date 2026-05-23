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

type RunsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function RunsPage(props: RunsPageProps) {
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
      closeHref={`/dashboard/runs?range=${range}`}
      data={data}
      inspector={inspector}
      range={range}
      title="Runs"
    >
      <section className="dashboard-workbench">
        <aside className="dashboard-filter-rail" aria-label="Run filters">
          <strong>Filters</strong>
          <span>Range: {range}</span>
          <span>Status</span>
          <span>Agent</span>
          <span>Strategy</span>
          <span>Risk result</span>
        </aside>

        <DashboardPanel title="Decision-to-trade runs">
          <DashboardDataTable
            empty="No runs yet."
            items={data.runs}
            columns={[
              {
                key: "run",
                label: "Run",
                render: (run) => (
                  <a
                    className="dashboard-table-primary"
                    href={`/dashboard/runs?range=${range}&inspect=run&id=${run.id}`}
                  >
                    {run.strategy ?? run.externalRunId ?? run.id}
                  </a>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (run) => <DashboardStatusChip status={run.status} />,
              },
              {
                key: "started",
                label: "Started",
                render: (run) => formatDateTime(run.startedAt),
              },
            ]}
          />
        </DashboardPanel>
      </section>
    </DashboardRouteShell>
  );
}
