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
import { DashboardEventsPagination } from "./dashboard-events-pagination";

type EventsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

const EVENTS_PAGE_SIZE = 50;

export default async function EventsPage(props: EventsPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const cursor = parseEventCursor(getFirstParam(searchParams?.cursor));
  const cursorStack = parseEventCursorStack(
    getFirstParam(searchParams?.cursorStack),
  );
  const eventScope = parseEventScope(getFirstParam(searchParams?.eventScope));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const [data, eventData] = await Promise.all([
    getDashboardData(range),
    getDashboardEvents(range, {
      cursor,
      includeRange: eventScope !== "latest",
      limit: EVENTS_PAGE_SIZE,
    }),
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
  const activeEventScope =
    eventScope ?? (eventData.fallbackRange ? "latest" : undefined);
  const currentHref = buildEventsHref({
    cursor,
    cursorStack,
    eventScope: activeEventScope,
    range,
  });
  const currentPage = cursor ? cursorStack.length + 2 : 1;
  const previousCursor = cursorStack[cursorStack.length - 1];
  const previousHref = cursor
    ? buildEventsHref({
        cursor: previousCursor,
        cursorStack: cursorStack.slice(0, -1),
        eventScope: previousCursor ? activeEventScope : undefined,
        range,
      })
    : undefined;
  const nextCursor = eventData.pagination?.nextCursor ?? undefined;
  const nextHref = nextCursor
    ? buildEventsHref({
        cursor: nextCursor,
        cursorStack: cursor ? [...cursorStack, cursor] : cursorStack,
        eventScope: activeEventScope,
        range,
      })
    : undefined;
  const pageStart = (currentPage - 1) * EVENTS_PAGE_SIZE + 1;
  const pageEnd = pageStart + Math.max(eventData.events.length - 1, 0);

  return (
    <DashboardRouteShell
      closeHref={currentHref}
      data={{ ...data, errors }}
      inspector={inspector}
      range={range}
      title="Events"
    >
      <DashboardPanel
        actions={
          eventData.pagination?.nextCursor || eventData.fallbackRange ? (
            <span>
              {formatEventCount(
                eventData.events.length,
                Boolean(eventData.pagination?.nextCursor),
              )}
              {eventData.fallbackRange ? " latest available" : ""}
            </span>
          ) : undefined
        }
        className="dashboard-events-panel dashboard-latest-panel dashboard-events-route-panel"
        title="Stream"
        titleCount={eventData.events.length}
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
                    href={buildEventsHref({
                      cursor,
                      cursorStack,
                      eventScope: activeEventScope,
                      id: event.id,
                      inspect: "event",
                      range,
                    })}
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
              render: (event) => (
                <EventTraceRun
                  cursor={cursor}
                  cursorStack={cursorStack}
                  eventScope={activeEventScope}
                  event={event}
                  range={range}
                />
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
        <DashboardEventsPagination
          nextHref={nextHref}
          page={currentPage}
          previousHref={previousHref}
          summary={
            eventData.events.length > 0
              ? `Showing ${pageStart.toLocaleString()}-${pageEnd.toLocaleString()}`
              : `Page ${currentPage.toLocaleString()}`
          }
        />
      </DashboardPanel>
    </DashboardRouteShell>
  );
}

function EventTraceRun(props: {
  cursor?: string;
  cursorStack: string[];
  eventScope?: EventScope;
  event: DashboardEvent;
  range: string;
}) {
  if (!props.event.traceId && !props.event.runId) {
    return <span className="dashboard-table-secondary">None</span>;
  }

  return (
    <span className="dashboard-event-links dashboard-event-trace-run">
      {props.event.traceId ? (
        <a
          href={buildEventsHref({
            cursor: props.cursor,
            cursorStack: props.cursorStack,
            eventScope: props.eventScope,
            id: props.event.traceId,
            inspect: "trace",
            range: props.range,
          })}
          title={props.event.traceId}
        >
          trace{" "}
          {formatReferenceLabel(props.event.traceId, { dropPrefix: "trace" })}
        </a>
      ) : null}
      {props.event.runId ? (
        <a
          href={buildEventsHref({
            cursor: props.cursor,
            cursorStack: props.cursorStack,
            eventScope: props.eventScope,
            id: props.event.runId,
            inspect: "run",
            range: props.range,
          })}
          title={props.event.runId}
        >
          run {formatReferenceLabel(props.event.runId, { dropPrefix: "run" })}
        </a>
      ) : null}
    </span>
  );
}

type EventScope = "latest";

function parseEventScope(value: string | undefined): EventScope | undefined {
  return value === "latest" ? value : undefined;
}

function parseEventCursor(value: string | undefined) {
  const cursor = value?.trim();

  if (!cursor || cursor.length > 1024) {
    return undefined;
  }

  return cursor;
}

function parseEventCursorStack(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((cursor) => parseEventCursor(cursor))
    .filter((cursor): cursor is string => Boolean(cursor))
    .slice(-20);
}

function buildEventsHref(options: {
  cursor?: string;
  cursorStack?: string[];
  eventScope?: EventScope;
  id?: string;
  inspect?: "event" | "run" | "trace";
  range: string;
}) {
  const params = new URLSearchParams({ range: options.range });

  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  if (options.cursorStack && options.cursorStack.length > 0) {
    params.set("cursorStack", options.cursorStack.join(","));
  }

  if (options.eventScope) {
    params.set("eventScope", options.eventScope);
  }

  if (options.inspect && options.id) {
    params.set("inspect", options.inspect);
    params.set("id", options.id);
  }

  return `/dashboard/events?${params.toString()}`;
}

function formatEventCount(count: number, hasMore: boolean) {
  return `${count.toLocaleString()}${hasMore ? "+" : ""} ${
    count === 1 ? "event" : "events"
  }`;
}
