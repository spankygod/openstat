import {
  DashboardDataTable,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
} from "./dashboard-components";
import type { DashboardData, DashboardRange } from "./dashboard-overview-types";

export function DashboardLatestTables(props: {
  data: DashboardData;
  range: DashboardRange;
}) {
  return (
    <section className="dashboard-table-grid">
      <DashboardPanel
        actions={<a href="/dashboard/runs">View all</a>}
        id="runs"
        title="Latest runs"
      >
        <DashboardDataTable
          empty="No runs yet."
          items={props.data.runs}
          columns={[
            {
              key: "run",
              label: "Run",
              render: (run) => (
                <a
                  className="dashboard-table-primary"
                  href={`/dashboard?range=${props.range}&inspect=run&id=${run.id}`}
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

      <DashboardPanel
        actions={<a href="/dashboard/trades">View all</a>}
        id="trades"
        title="Latest trades"
      >
        <DashboardDataTable
          empty="No trades yet."
          items={props.data.trades}
          columns={[
            {
              key: "trade",
              label: "Trade",
              render: (trade) => (
                <a
                  className="dashboard-table-primary"
                  href={`/dashboard?range=${props.range}&inspect=trade&id=${trade.id}`}
                >
                  {trade.side.toUpperCase()} {trade.symbol}
                </a>
              ),
            },
            {
              key: "value",
              label: "Value",
              render: (trade) =>
                `${trade.quantity}${trade.price ? ` at ${trade.price}` : ""}`,
            },
            {
              key: "status",
              label: "Status",
              render: (trade) => <DashboardStatusChip status={trade.status} />,
            },
          ]}
        />
      </DashboardPanel>

      <DashboardPanel
        actions={<a href="/dashboard?inspect=events">Explore</a>}
        className="dashboard-events-panel"
        title="Latest events"
      >
        <DashboardDataTable
          empty="No events ingested yet."
          items={props.data.overview?.events.latest ?? []}
          columns={[
            {
              key: "event",
              label: "Event",
              render: (event) => (
                <a
                  className="dashboard-table-primary"
                  href={`/dashboard?range=${props.range}&inspect=event&id=${event.id}`}
                >
                  {event.eventType}
                </a>
              ),
            },
            {
              key: "source",
              label: "Source",
              render: (event) => event.source,
            },
            {
              key: "time",
              label: "Time",
              render: (event) => formatDateTime(event.timestamp),
            },
          ]}
        />
      </DashboardPanel>
    </section>
  );
}
