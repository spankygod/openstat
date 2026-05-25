import {
  getDashboardData,
  getDashboardEvents,
  getDashboardInspectorData,
  type DashboardEvent,
} from "../../../lib/openstat-api";
import {
  DashboardDataTable,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
  formatRelativeTime,
} from "../dashboard-components";
import {
  formatEventType,
  formatReferenceLabel,
  getAgentLabel,
  getEventState,
  summarizeEvent,
} from "../dashboard-event-utils";
import {
  getFirstParam,
  parseDashboardRange,
  parseInspectorKind,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type EventsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function EventsPage(props: EventsPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const [data, eventData] = await Promise.all([
    getDashboardData(range),
    getDashboardEvents(range),
  ]);
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;
  const agentNameById = new Map(
    data.agents.map((agent) => [
      agent.id,
      agent.name || agent.externalId || agent.id,
    ]),
  );
  const errors = [...data.errors, ...eventData.errors];

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/events?range=${range}`}
      data={{ ...data, errors }}
      inspector={inspector}
      range={range}
      title="Events"
    >
      <DashboardPanel
        actions={
          <span>
            {formatEventCount(
              eventData.events.length,
              Boolean(eventData.pagination?.nextCursor),
            )}
          </span>
        }
        className="dashboard-route-panel dashboard-events-route-panel"
        title="Event stream"
      >
        <DashboardDataTable
          empty="No events ingested yet."
          items={eventData.events}
          columns={[
            {
              key: "summary",
              label: "Summary",
              render: (event) => (
                <span className="dashboard-event-summary dashboard-event-summary-expanded">
                  <a
                    className="dashboard-table-primary dashboard-event-summary-link"
                    href={`/dashboard/events?range=${range}&inspect=event&id=${event.id}`}
                  >
                    {summarizeEvent(event)}
                  </a>
                  {event.tags && event.tags.length > 0 ? (
                    <span className="dashboard-event-links">
                      {event.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                  ) : null}
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
              key: "type",
              label: "Type",
              render: (event) => (
                <span className="dashboard-event-type">
                  {formatEventType(event.eventType)}
                </span>
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
              key: "traceRun",
              label: "Trace / Run",
              render: (event) => <EventTraceRun event={event} range={range} />,
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
    </DashboardRouteShell>
  );
}

function EventTraceRun(props: { event: DashboardEvent; range: string }) {
  if (!props.event.traceId && !props.event.runId) {
    return <span className="dashboard-table-secondary">None</span>;
  }

  return (
    <span className="dashboard-event-links dashboard-event-trace-run">
      {props.event.traceId ? (
        <a
          href={`/dashboard/events?range=${props.range}&inspect=trace&id=${props.event.traceId}`}
          title={props.event.traceId}
        >
          trace{" "}
          {formatReferenceLabel(props.event.traceId, { dropPrefix: "trace" })}
        </a>
      ) : null}
      {props.event.runId ? (
        <span title={props.event.runId}>
          run {formatReferenceLabel(props.event.runId, { dropPrefix: "run" })}
        </span>
      ) : null}
    </span>
  );
}

function formatEventCount(count: number, hasMore: boolean) {
  return `${count.toLocaleString()}${hasMore ? "+" : ""} ${
    count === 1 ? "event" : "events"
  }`;
}
