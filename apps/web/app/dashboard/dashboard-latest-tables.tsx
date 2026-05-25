import {
  DashboardDataTable,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
  formatRelativeTime,
} from "./dashboard-components";
import {
  formatEventType,
  formatReferenceLabel,
  getAgentLabel,
  getEventState,
  summarizeEvent,
} from "./dashboard-event-utils";
import type { DashboardData, DashboardRange } from "./dashboard-overview-types";

export function DashboardLatestTables(props: {
  data: DashboardData;
  range: DashboardRange;
}) {
  const agentNameById = new Map(
    props.data.agents.map((agent) => [
      agent.id,
      agent.name || agent.externalId || agent.id,
    ]),
  );

  return (
    <section className="dashboard-table-grid">
      <DashboardPanel
        actions={<a href="/dashboard/runs">View all</a>}
        className="dashboard-latest-panel"
        id="runs"
        title="Latest runs"
        titleCount={props.data.runs.length}
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
        className="dashboard-latest-panel"
        id="trades"
        title="Latest trades"
        titleCount={props.data.trades.length}
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
        actions={<a href={`/dashboard/events?range=${props.range}`}>Explore</a>}
        className="dashboard-events-panel dashboard-latest-panel"
        title="Latest events"
        titleCount={props.data.overview?.events.latest.length ?? 0}
      >
        <DashboardDataTable
          empty="No events ingested yet."
          items={props.data.overview?.events.latest ?? []}
          columns={[
            {
              key: "summary",
              label: "Summary",
              render: (event) => (
                <span className="dashboard-event-summary">
                  <a
                    className="dashboard-table-primary dashboard-event-summary-link"
                    href={`/dashboard?range=${props.range}&inspect=event&id=${event.id}`}
                  >
                    {summarizeEvent(event)}
                  </a>
                  <span className="dashboard-event-links">
                    <span>{formatEventType(event.eventType)}</span>
                    {event.traceId ? (
                      <a
                        href={`/dashboard?range=${props.range}&inspect=trace&id=${event.traceId}`}
                      >
                        trace
                      </a>
                    ) : null}
                    {event.runId ? (
                      <span title={event.runId}>
                        run{" "}
                        {formatReferenceLabel(event.runId, {
                          dropPrefix: "run",
                        })}
                      </span>
                    ) : null}
                  </span>
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (event) => (
                <DashboardStatusChip status={getEventState(event)} />
              ),
            },
            {
              key: "agent",
              label: "Agent",
              render: (event) => (
                <span className="dashboard-table-secondary">
                  {getAgentLabel(event.agentId, agentNameById)}
                </span>
              ),
            },
            {
              key: "source",
              label: "Source",
              render: (event) => (
                <span className="dashboard-source-label">{event.source}</span>
              ),
            },
            {
              key: "time",
              label: "Time",
              render: (event) => (
                <span title={formatDateTime(event.timestamp)}>
                  {formatRelativeTime(event.timestamp)}
                </span>
              ),
            },
          ]}
        />
      </DashboardPanel>
    </section>
  );
}
