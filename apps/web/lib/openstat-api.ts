import { cookies } from "next/headers";

const apiUrl =
  process.env.NEXT_PUBLIC_OPENSTAT_API_URL ?? "http://localhost:4000";
const dashboardApiKey = process.env.OPENSTAT_DASHBOARD_API_KEY;

export type DashboardData = {
  overview?: DashboardOverview;
  analytics?: DashboardAnalytics;
  agents: Array<DashboardAgent>;
  runs: Array<DashboardRun>;
  trades: Array<DashboardTrade>;
  notifications: Array<DashboardNotification>;
  apiKeys: Array<DashboardApiKey>;
  errors: string[];
};

export type DashboardInspectorKind =
  | "agent"
  | "event"
  | "notification"
  | "run"
  | "trace"
  | "trade";

export type DashboardInspectorData = {
  id: string;
  kind: DashboardInspectorKind;
  title: string;
  summary: Array<{ label: string; value: string }>;
  data: unknown;
  errors: string[];
};

export type DashboardOverview = {
  agents: {
    total: number;
    byStatus: Record<string, number>;
  };
  events: {
    total: number;
    latest: Array<DashboardEvent>;
  };
};

export type DashboardRange = "24h" | "7d" | "30d";

export type DashboardAnalytics = {
  range: DashboardRange;
  generatedAt: string;
  totals: Record<string, number>;
  series: Array<DashboardAnalyticsSeriesPoint>;
  breakdowns: {
    agents: Array<DashboardAgentBreakdown>;
    eventTypes: Array<DashboardBreakdownItem>;
    models: Array<DashboardBreakdownItem>;
    sources: Array<DashboardBreakdownItem>;
    statuses: Array<DashboardBreakdownItem>;
  };
  topTraces: Array<DashboardBreakdownItem>;
};

export type DashboardAnalyticsSeriesPoint = {
  activeAgents: number;
  bucket: string;
  decisions: number;
  events: number;
  errors: number;
  failures: number;
  fills: number;
  orders: number;
  pnlSnapshots: number;
  riskRejects: number;
};

export type DashboardBreakdownItem = {
  value: string;
  count: number;
  errors?: number;
};

export type DashboardAgentBreakdown = {
  id: string;
  label: string;
  count: number;
};

export type DashboardAgent = {
  id: string;
  name: string;
  externalId?: string | null;
  status: string;
  heartbeatHealth?: {
    healthyHeartbeats: number;
    lastHeartbeatAt?: string | null;
    receivedHeartbeats: number;
    uptimePercent: number;
    window: DashboardRange;
  };
  lastSeenAt?: string | null;
};

export type DashboardEvent = {
  agentId?: string | null;
  createdAt?: string;
  data?: Record<string, unknown>;
  id: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  runId?: string | null;
  spanId?: string | null;
  source: string;
  tags?: string[];
  timestamp: string;
  traceId?: string | null;
};

export type DashboardEventsData = {
  errors: string[];
  events: DashboardEvent[];
  fallbackRange?: DashboardRange;
  pagination?: {
    nextCursor?: string | null;
  };
};

type DashboardEventsOptions = {
  cursor?: string;
  includeRange?: boolean;
  limit?: number;
};

export type DashboardRun = {
  id: string;
  endedAt?: string | null;
  externalRunId?: string | null;
  strategy?: string | null;
  status: string;
  startedAt: string;
};

export type DashboardTrade = {
  id: string;
  strategy?: string | null;
  symbol: string;
  side: string;
  status: string;
  quantity: string;
  price?: string | null;
  createdAt: string;
};

export type DashboardNotification = {
  id: string;
  type: string;
  status: string;
  title: string;
  message?: string | null;
  createdAt: string;
};

export type DashboardApiKey = {
  id: string;
  name: string;
  prefix: string;
  revokedAt?: string | null;
  createdAt: string;
};

export async function getDashboardData(
  range: DashboardRange = "7d",
): Promise<DashboardData> {
  await ensureWorkspaceInitialized();

  const [overview, analytics, agents, runs, trades, notifications, apiKeys] =
    await Promise.all([
      getJson<DashboardOverview>("/v1/overview"),
      getJson<DashboardAnalytics>(`/v1/analytics/summary?range=${range}`),
      getJson<{ agents: DashboardAgent[] }>(
        `/v1/agents?limit=12&range=${range}`,
      ),
      getJson<{ runs: DashboardRun[] }>("/v1/runs?limit=8"),
      getJson<{ trades: DashboardTrade[] }>("/v1/trades?limit=8"),
      getJson<{ notifications: DashboardNotification[] }>(
        "/v1/notifications?limit=8",
      ),
      dashboardApiKey
        ? Promise.resolve({ ok: true as const, data: { apiKeys: [] } })
        : getJson<{ apiKeys: DashboardApiKey[] }>("/v1/api-keys"),
    ]);

  return {
    overview: overview.ok ? overview.data : undefined,
    analytics: analytics.ok ? analytics.data : undefined,
    agents: agents.ok ? agents.data.agents : [],
    runs: runs.ok ? runs.data.runs : [],
    trades: trades.ok ? trades.data.trades : [],
    notifications: notifications.ok ? notifications.data.notifications : [],
    apiKeys: apiKeys.ok ? apiKeys.data.apiKeys : [],
    errors: [
      overview,
      analytics,
      agents,
      runs,
      trades,
      notifications,
      apiKeys,
    ].flatMap((result) => (result.ok ? [] : [result.error])),
  };
}

export async function getDashboardEvents(
  range: DashboardRange = "7d",
  options: DashboardEventsOptions = {},
): Promise<DashboardEventsData> {
  await ensureWorkspaceInitialized();

  const limit = options.limit ?? 50;
  const query = new URLSearchParams({
    limit: String(limit),
  });

  if (options.includeRange !== false) {
    query.set("range", range);
  }

  if (options.cursor) {
    query.set("cursor", options.cursor);
  }

  const events = await getJson<{
    events: DashboardEvent[];
    pagination?: DashboardEventsData["pagination"];
  }>(`/v1/events?${query.toString()}`);

  if (
    options.includeRange !== false &&
    !options.cursor &&
    events.ok &&
    events.data.events.length === 0
  ) {
    const latestEvents = await getJson<{
      events: DashboardEvent[];
      pagination?: DashboardEventsData["pagination"];
    }>(`/v1/events?limit=${limit}`);

    if (latestEvents.ok && latestEvents.data.events.length > 0) {
      return {
        errors: [],
        events: latestEvents.data.events,
        fallbackRange: range,
        pagination: latestEvents.data.pagination,
      };
    }

    return {
      errors: latestEvents.ok ? [] : [latestEvents.error],
      events: [],
      pagination: events.data.pagination,
    };
  }

  return {
    errors: events.ok ? [] : [events.error],
    events: events.ok ? events.data.events : [],
    pagination: events.ok ? events.data.pagination : undefined,
  };
}

export async function getDashboardInspectorData(
  kind: DashboardInspectorKind,
  id: string,
): Promise<DashboardInspectorData> {
  await ensureWorkspaceInitialized();

  const detail = await getInspectorPayload(kind, id);
  const data = detail.ok ? detail.data : undefined;

  return {
    id,
    kind,
    title: getInspectorTitle(kind, id, data),
    summary: getInspectorSummary(kind, data),
    data,
    errors: detail.ok ? [] : [detail.error],
  };
}

async function getInspectorPayload(
  kind: DashboardInspectorKind,
  id: string,
): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: string;
    }
> {
  if (kind === "event") {
    const event = await getJson<unknown>(`/v1/events/${id}`);

    if (!event.ok) {
      return event;
    }

    const eventDetail = getEventFromPayload(event.data);
    const traceId =
      typeof eventDetail?.traceId === "string"
        ? eventDetail.traceId
        : undefined;
    const runId =
      typeof eventDetail?.runId === "string" ? eventDetail.runId : undefined;
    const timelinePath = traceId
      ? `/v1/events?limit=20&trace=${encodeURIComponent(traceId)}`
      : runId
        ? `/v1/events?limit=20&run=${encodeURIComponent(runId)}`
        : undefined;
    const [resources, timeline] = await Promise.all([
      getJson<unknown>(`/v1/events/${id}/resources`),
      timelinePath
        ? getJson<{
            events: DashboardEvent[];
          }>(timelinePath)
        : Promise.resolve({
            ok: true as const,
            data: { events: eventDetail ? [eventDetail] : [] },
          }),
    ]);

    return {
      ok: true,
      data: {
        event: event.data,
        events: timeline.ok ? timeline.data.events : [],
        resources: resources.ok ? resources.data : undefined,
        resourceError: resources.ok ? undefined : resources.error,
        selectedEventId: id,
        timelineError: timeline.ok ? undefined : timeline.error,
        timelineSource: traceId ? "trace" : runId ? "run" : "event",
      },
    };
  }

  if (kind === "trace") {
    const events = await getJson<{
      events: DashboardEvent[];
    }>(`/v1/events?limit=20&trace=${encodeURIComponent(id)}`);

    if (!events.ok) {
      return events;
    }

    return {
      ok: true,
      data: {
        detail: {
          traceId: id,
        },
        events: events.data.events,
        selectedTraceId: id,
        timelineSource: "trace",
      },
    };
  }

  if (kind === "run" && !isUuid(id)) {
    const events = await getJson<{
      events: DashboardEvent[];
    }>(`/v1/events?limit=20&run=${encodeURIComponent(id)}`);

    if (!events.ok) {
      return events;
    }

    return {
      ok: true,
      data: {
        events: events.data.events,
        run: {
          externalRunId: id,
        },
        selectedRunId: id,
        timelineSource: "run",
      },
    };
  }

  const pathByKind: Record<
    Exclude<DashboardInspectorKind, "event" | "trace">,
    string
  > = {
    agent: `/v1/agents/${id}/timeline?limit=20`,
    notification: `/v1/notifications/${id}`,
    run: `/v1/runs/${id}/timeline?limit=20`,
    trade: `/v1/trades/${id}`,
  };

  return getJson<unknown>(pathByKind[kind]);
}

function getInspectorTitle(
  kind: DashboardInspectorKind,
  id: string,
  data: unknown,
) {
  const record = asRecord(data);

  if (kind === "trade") {
    const trade = asRecord(record?.trade) ?? asRecord(record?.order);
    const order = asRecord(trade?.order) ?? trade;
    const symbol = order?.symbol;
    const side = order?.side;

    if (typeof symbol === "string") {
      return `${typeof side === "string" ? side.toUpperCase() : "Trade"} ${symbol}`;
    }
  }

  if (kind === "run") {
    const run = asRecord(record?.run);
    const strategy = run?.strategy ?? run?.externalRunId;

    if (typeof strategy === "string") {
      return strategy;
    }
  }

  if (kind === "agent") {
    const agent = asRecord(record?.agent);

    if (typeof agent?.name === "string") {
      return agent.name;
    }
  }

  if (kind === "notification") {
    const notification = asRecord(record?.notification);

    if (typeof notification?.title === "string") {
      return notification.title;
    }
  }

  if (kind === "event") {
    const eventContainer = asRecord(record?.event);
    const event = asRecord(eventContainer?.event) ?? eventContainer;

    if (typeof event?.eventType === "string") {
      return event.eventType;
    }
  }

  return `${kind} ${id.slice(0, 8)}`;
}

function getInspectorSummary(kind: DashboardInspectorKind, data: unknown) {
  const record = asRecord(data);
  const entries: Array<{ label: string; value: string }> = [];

  function push(label: string, value: unknown) {
    if (value === undefined || value === null || value === "") {
      return;
    }

    entries.push({ label, value: String(value) });
  }

  if (kind === "run") {
    const run = asRecord(record?.run);
    push("Status", run?.status);
    push("Strategy", run?.strategy);
    push("External run", run?.externalRunId);
    push("Started", run?.startedAt);
  } else if (kind === "trade") {
    const trade = asRecord(record?.trade) ?? record;
    const order = asRecord(trade?.order) ?? trade;
    push("Symbol", order?.symbol);
    push("Side", order?.side);
    push("Status", order?.status);
    push("Quantity", order?.quantity);
    push("Price", order?.price);
  } else if (kind === "agent") {
    const agent = asRecord(record?.agent);
    push("Status", agent?.status);
    push("External id", agent?.externalId);
    push("Last seen", agent?.lastSeenAt);
  } else if (kind === "notification") {
    const notification = asRecord(record?.notification);
    push("Type", notification?.type);
    push("Status", notification?.status);
    push("Created", notification?.createdAt);
  } else if (kind === "event") {
    const eventContainer = asRecord(record?.event);
    const event = asRecord(eventContainer?.event) ?? eventContainer;
    push("Type", event?.eventType);
    push("Source", event?.source);
    push("Trace", event?.traceId);
    push("Timestamp", event?.timestamp);
  } else if (kind === "trace") {
    const detail = asRecord(record?.detail) ?? record;
    push("Trace", idFromDetail(detail));
  }

  return entries.slice(0, 6);
}

function idFromDetail(detail: Record<string, unknown> | undefined) {
  return detail?.traceId ?? detail?.id;
}

function getEventFromPayload(value: unknown): DashboardEvent | undefined {
  const record = asRecord(value);
  const event = asRecord(record?.event) ?? record;

  if (typeof event?.id !== "string" || typeof event.eventType !== "string") {
    return undefined;
  }

  return event as DashboardEvent;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

async function ensureWorkspaceInitialized() {
  if (dashboardApiKey) {
    return;
  }

  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader) {
    return;
  }

  try {
    await fetch(`${apiUrl}/v1/workspace/init`, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
      },
      method: "POST",
    });
  } catch {
    // Dashboard reads below will surface the actual auth/API state.
  }
}

async function getJson<T>(path: string): Promise<
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: {
        ...(dashboardApiKey
          ? { authorization: `Bearer ${dashboardApiKey}` }
          : {}),
        ...(!dashboardApiKey && cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${path} returned ${response.status}`,
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: `${path} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
