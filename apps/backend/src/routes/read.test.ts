import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthScopeError } from "../auth-scope.js";
import { registerErrorHandler } from "../plugins/errors.js";
import { registerReadRoutes } from "./read.js";

const state = vi.hoisted(() => ({
  db: {},
  getAgent: vi.fn(),
  getAgentTimeline: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  getEventTypeDetail: vi.fn(),
  getEvent: vi.fn(),
  getEventResources: vi.fn(),
  getIngestionBatch: vi.fn(),
  getMetricDetail: vi.fn(),
  getModelDetail: vi.fn(),
  getNotification: vi.fn(),
  getOverview: vi.fn(),
  getSourceDetail: vi.fn(),
  getStatusDetail: vi.fn(),
  getTraceDetail: vi.fn(),
  listAgents: vi.fn(),
  listEvents: vi.fn(),
  listEventArtifacts: vi.fn(),
  listIngestionBatches: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  requireSessionScope: vi.fn(),
  resolveReadScope: vi.fn(),
  updateNotificationStatus: vi.fn(),
}));

vi.mock("../context.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  database: {
    db: state.db,
  },
}));

vi.mock("../auth-scope.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth-scope.js")>();

  return {
    ...actual,
    requireSessionScope: state.requireSessionScope,
    resolveReadScope: state.resolveReadScope,
  };
});

vi.mock("@openstat/ingestion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstat/ingestion")>();

  return {
    ...actual,
    getAgent: state.getAgent,
    getAgentTimeline: state.getAgentTimeline,
    getAnalyticsSummary: state.getAnalyticsSummary,
    getEventTypeDetail: state.getEventTypeDetail,
    getEvent: state.getEvent,
    getEventResources: state.getEventResources,
    getIngestionBatch: state.getIngestionBatch,
    getMetricDetail: state.getMetricDetail,
    getModelDetail: state.getModelDetail,
    getNotification: state.getNotification,
    getOverview: state.getOverview,
    getSourceDetail: state.getSourceDetail,
    getStatusDetail: state.getStatusDetail,
    getTraceDetail: state.getTraceDetail,
    listAgents: state.listAgents,
    listEvents: state.listEvents,
    listEventArtifacts: state.listEventArtifacts,
    listIngestionBatches: state.listIngestionBatches,
    listNotifications: state.listNotifications,
    markNotificationsRead: state.markNotificationsRead,
    updateNotificationStatus: state.updateNotificationStatus,
  };
});

const scope = {
  organizationId: "org_test",
  projectId: "project_test",
};

const agent = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "agent",
  externalId: "agent-local",
  status: "online",
  mode: "long_running",
  tags: [],
  lastSeenAt: new Date("2026-05-11T00:00:00.000Z"),
  metadata: {},
  createdAt: new Date("2026-05-10T00:00:00.000Z"),
  updatedAt: new Date("2026-05-11T00:00:00.000Z"),
};

const secondAgent = {
  ...agent,
  id: "00000000-0000-4000-8000-000000000002",
  name: "agent-two",
  externalId: "agent-two",
  lastSeenAt: new Date("2026-05-10T23:00:00.000Z"),
};

const event = {
  id: "00000000-0000-4000-8000-000000000101",
  agentId: agent.id,
  eventType: "heartbeat",
  source: "http",
  timestamp: new Date("2026-05-11T00:00:00.000Z"),
  traceId: null,
  spanId: null,
  runId: null,
  data: {},
  metadata: {},
  tags: [],
  createdAt: new Date("2026-05-11T00:00:00.000Z"),
};

const notification = {
  id: "00000000-0000-4000-8000-000000000201",
  projectId: "00000000-0000-4000-8000-000000000301",
  agentId: agent.id,
  type: "agent.offline",
  status: "unread",
  title: "Agent offline",
  message: "agent has stopped sending heartbeats",
  data: {},
  readAt: null,
  createdAt: new Date("2026-05-11T00:00:00.000Z"),
  updatedAt: new Date("2026-05-11T00:00:00.000Z"),
};

const ingestionBatch = {
  id: "00000000-0000-4000-8000-000000000401",
  apiKeyId: "00000000-0000-4000-8000-000000000501",
  source: "http",
  status: "processed",
  eventCount: 2,
  acceptedCount: 2,
  rejectedCount: 0,
  requestId: "request_test",
  receivedAt: new Date("2026-05-11T00:00:00.000Z"),
  processedAt: new Date("2026-05-11T00:00:01.000Z"),
  failedAt: null,
  errorCode: null,
  errorMessage: null,
  metadata: {},
  createdAt: new Date("2026-05-11T00:00:00.000Z"),
  updatedAt: new Date("2026-05-11T00:00:01.000Z"),
};

const artifact = {
  id: "00000000-0000-4000-8000-000000000601",
  projectId: scope.projectId,
  agentId: agent.id,
  eventId: event.id,
  objectKey: "events/output.json",
  contentType: "application/json",
  sizeBytes: 128,
  checksum: "sha256:test",
  metadata: {},
  createdAt: new Date("2026-05-11T00:00:00.000Z"),
};

describe("read routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireSessionScope.mockResolvedValue(scope);
    state.resolveReadScope.mockResolvedValue(scope);
    state.listAgents.mockResolvedValue([agent]);
    state.listEvents.mockResolvedValue([]);
    state.listEventArtifacts.mockResolvedValue([]);
    state.listIngestionBatches.mockResolvedValue([]);
    state.listNotifications.mockResolvedValue([]);
    state.markNotificationsRead.mockResolvedValue(0);
    state.getAgent.mockResolvedValue(null);
    state.getAgentTimeline.mockResolvedValue(null);
    state.getEvent.mockResolvedValue(null);
    state.getEventResources.mockResolvedValue({
      eventId: event.id,
      logs: [],
      toolCalls: [],
      errors: [],
      artifacts: [],
    });
    state.getEventTypeDetail.mockResolvedValue(null);
    state.getIngestionBatch.mockResolvedValue(null);
    state.getMetricDetail.mockResolvedValue(null);
    state.getModelDetail.mockResolvedValue(null);
    state.getNotification.mockResolvedValue(null);
    state.getSourceDetail.mockResolvedValue({
      source: "sdk",
      totals: { errors: 0, total: 0 },
      eventTypes: [],
      agents: [],
      sampleEvents: [],
    });
    state.getStatusDetail.mockResolvedValue({
      status: "online",
      kind: "agent",
      count: 0,
      agents: [],
      events: [],
    });
    state.getTraceDetail.mockResolvedValue(null);
    state.getAnalyticsSummary.mockResolvedValue({
      range: "24h",
      generatedAt: new Date("2026-05-11T00:00:00.000Z"),
      totals: {
        activeApiKeys: 1,
        agents: 1,
        apiKeys: 1,
        errors: 0,
        events: 0,
        failedIngestionBatches: 0,
        ingestionBatches: 0,
        notifications: 0,
        unreadNotifications: 0,
      },
      series: [],
      breakdowns: {
        agents: [],
        eventTypes: [],
        models: [],
        sources: [],
        statuses: [],
      },
      topTraces: [],
    });
    state.getOverview.mockResolvedValue({
      agents: {
        total: 1,
        byStatus: {
          online: 1,
          stale: 0,
          offline: 0,
          failing: 0,
          unknown: 0,
        },
      },
      events: {
        total: 0,
        latest: [],
      },
    });
  });

  it("returns analytics summary for the resolved project scope", async () => {
    state.getAnalyticsSummary.mockResolvedValue({
      range: "7d",
      generatedAt: new Date("2026-05-11T00:00:00.000Z"),
      totals: {
        activeApiKeys: 1,
        agents: 1,
        apiKeys: 1,
        errors: 0,
        events: 2,
        failedIngestionBatches: 0,
        ingestionBatches: 1,
        notifications: 0,
        unreadNotifications: 0,
      },
      series: [],
      breakdowns: {
        agents: [],
        eventTypes: [],
        models: [],
        sources: [],
        statuses: [],
      },
      topTraces: [],
    });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/summary?range=7d",
    });

    const body = response.json<{
      range: string;
      totals: { agents: number; events: number };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.getAnalyticsSummary).toHaveBeenCalledWith({
      db: state.db,
      scope,
      range: "7d",
    });
    expect(body.range).toBe("7d");
    expect(body.totals.agents).toBe(1);

    await app.close();
  });

  it("returns one metric detail for the resolved project scope", async () => {
    state.getMetricDetail.mockResolvedValue({
      metric: { key: "events", value: 12, range: "30d" },
      series: [],
      breakdowns: {},
      relatedEvents: [],
    });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/metrics/events?range=30d",
    });

    expect(response.statusCode).toBe(200);
    expect(state.getMetricDetail).toHaveBeenCalledWith({
      db: state.db,
      scope,
      metricKey: "events",
      range: "30d",
    });

    await app.close();
  });

  it("returns a stable error code when a metric is not found", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/metrics/not-real",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("METRIC_NOT_FOUND");

    await app.close();
  });

  it("returns event type detail for the resolved project scope", async () => {
    state.getEventTypeDetail.mockResolvedValue({
      eventType: "completion",
      totals: { errors: 1, total: 4 },
      sources: [],
      agents: [],
      properties: [],
      sampleEvents: [],
    });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/event-types/completion?range=7d",
    });

    expect(response.statusCode).toBe(200);
    expect(state.getEventTypeDetail).toHaveBeenCalledWith({
      db: state.db,
      scope,
      eventType: "completion",
      range: "7d",
    });

    await app.close();
  });

  it("returns a stable error code when an event type is not found", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/event-types/not-real",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("EVENT_TYPE_NOT_FOUND");

    await app.close();
  });

  it("returns source detail and validates invalid sources", async () => {
    const app = await createApp();
    const validResponse = await app.inject({
      method: "GET",
      url: "/v1/analytics/sources/sdk?range=30d",
    });
    const invalidResponse = await app.inject({
      method: "GET",
      url: "/v1/analytics/sources/not-real",
    });

    expect(validResponse.statusCode).toBe(200);
    expect(state.getSourceDetail).toHaveBeenCalledWith({
      db: state.db,
      scope,
      source: "sdk",
      range: "30d",
    });
    expect(invalidResponse.statusCode).toBe(400);

    await app.close();
  });

  it("returns a stable error code when a model is not found", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/models/not-real",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("MODEL_NOT_FOUND");

    await app.close();
  });

  it("returns status detail for the resolved project scope", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/status/online?range=7d",
    });

    expect(response.statusCode).toBe(200);
    expect(state.getStatusDetail).toHaveBeenCalledWith({
      db: state.db,
      scope,
      status: "online",
      range: "7d",
    });

    await app.close();
  });

  it("returns a stable error code when a trace is not found", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/traces/trace_missing",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("TRACE_NOT_FOUND");

    await app.close();
  });

  it("passes resolved tenant scope into paginated agent list queries", async () => {
    state.listAgents.mockResolvedValue([agent, secondAgent]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/agents?limit=1",
      headers: {
        authorization: "Bearer ostat_public_secret",
      },
    });

    const body = response.json<{
      agents: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.resolveReadScope).toHaveBeenCalledOnce();
    expect(state.listAgents).toHaveBeenCalledWith({
      db: state.db,
      scope,
      list: {
        limit: 2,
      },
    });
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]?.id).toBe(agent.id);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));

    await app.close();
  });

  it("returns a stable error code when read scope is denied", async () => {
    state.resolveReadScope.mockRejectedValue(
      new AuthScopeError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "User does not have access to an organization.",
      ),
    );

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/events",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(403);
    expect(body.error.code).toBe("ORGANIZATION_ACCESS_DENIED");
    expect(state.listEvents).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns not found for agents outside the resolved project", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/agents/00000000-0000-4000-8000-000000000123",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(state.getAgent).toHaveBeenCalledWith({
      db: state.db,
      scope,
      agentId: "00000000-0000-4000-8000-000000000123",
    });
    expect(body.error.code).toBe("AGENT_NOT_FOUND");

    await app.close();
  });

  it("returns pagination metadata for event lists", async () => {
    state.listEvents.mockResolvedValue([
      event,
      {
        ...event,
        id: "00000000-0000-4000-8000-000000000102",
        createdAt: new Date("2026-05-10T23:59:00.000Z"),
      },
    ]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/events?limit=1",
    });

    const body = response.json<{
      events: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.listEvents).toHaveBeenCalledWith({
      db: state.db,
      scope,
      list: {
        limit: 2,
      },
      filters: {
        agentId: undefined,
        eventType: undefined,
        model: undefined,
        q: undefined,
        range: undefined,
        source: undefined,
        status: undefined,
        trace: undefined,
      },
    });
    expect(body.events).toHaveLength(1);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));

    await app.close();
  });

  it("passes server-side event filters into event list queries", async () => {
    state.listEvents.mockResolvedValue([event]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url:
        `/v1/events?limit=10&agent=${agent.id}` +
        "&eventType=completion&model=gpt-4o-mini&q=latency" +
        "&range=7d&source=sdk&status=errors&trace=trace_123",
    });

    expect(response.statusCode).toBe(200);
    expect(state.listEvents).toHaveBeenCalledWith({
      db: state.db,
      scope,
      list: {
        limit: 11,
      },
      filters: {
        agentId: agent.id,
        eventType: "completion",
        model: "gpt-4o-mini",
        q: "latency",
        range: "7d",
        source: "sdk",
        status: "errors",
        trace: "trace_123",
      },
    });

    await app.close();
  });

  it("returns one event inside the resolved project", async () => {
    state.getEvent.mockResolvedValue(event);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/v1/events/${event.id}`,
    });

    const body = response.json<{ event: { id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(state.getEvent).toHaveBeenCalledWith({
      db: state.db,
      scope,
      eventId: event.id,
    });
    expect(body.event.id).toBe(event.id);

    await app.close();
  });

  it("returns a stable error code when an event is out of scope", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/events/00000000-0000-4000-8000-000000000199",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("EVENT_NOT_FOUND");

    await app.close();
  });

  it("returns artifacts for one event inside the resolved project", async () => {
    state.listEventArtifacts.mockResolvedValue([artifact]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/v1/events/${event.id}/artifacts`,
    });

    const body = response.json<{ artifacts: Array<{ id: string }> }>();

    expect(response.statusCode).toBe(200);
    expect(state.listEventArtifacts).toHaveBeenCalledWith({
      db: state.db,
      scope,
      eventId: event.id,
    });
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0]?.id).toBe(artifact.id);

    await app.close();
  });

  it("returns child resources for one event inside the resolved project", async () => {
    state.getEventResources.mockResolvedValue({
      eventId: event.id,
      logs: [{ id: "log_1" }],
      toolCalls: [{ id: "tool_1" }],
      errors: [{ id: "error_1" }],
      artifacts: [artifact],
    });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/v1/events/${event.id}/resources`,
    });

    const body = response.json<{
      resources: { eventId: string; logs: unknown[]; artifacts: unknown[] };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.getEventResources).toHaveBeenCalledWith({
      db: state.db,
      scope,
      eventId: event.id,
    });
    expect(body.resources.eventId).toBe(event.id);
    expect(body.resources.logs).toHaveLength(1);
    expect(body.resources.artifacts).toHaveLength(1);

    await app.close();
  });

  it("returns pagination metadata for ingestion batch lists", async () => {
    state.listIngestionBatches.mockResolvedValue([
      ingestionBatch,
      {
        ...ingestionBatch,
        id: "00000000-0000-4000-8000-000000000402",
        receivedAt: new Date("2026-05-10T23:59:00.000Z"),
      },
    ]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url:
        "/v1/ingestion-batches?limit=1" +
        "&apiKeyId=00000000-0000-4000-8000-000000000501",
    });

    const body = response.json<{
      batches: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.listIngestionBatches).toHaveBeenCalledWith({
      db: state.db,
      scope,
      list: {
        limit: 2,
      },
      apiKeyId: "00000000-0000-4000-8000-000000000501",
    });
    expect(body.batches).toHaveLength(1);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));

    await app.close();
  });

  it("returns one ingestion batch inside the resolved project", async () => {
    state.getIngestionBatch.mockResolvedValue(ingestionBatch);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/v1/ingestion-batches/${ingestionBatch.id}`,
    });

    const body = response.json<{ batch: { id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(state.getIngestionBatch).toHaveBeenCalledWith({
      db: state.db,
      scope,
      batchId: ingestionBatch.id,
    });
    expect(body.batch.id).toBe(ingestionBatch.id);

    await app.close();
  });

  it("returns a stable error code when an ingestion batch is out of scope", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/ingestion-batches/00000000-0000-4000-8000-000000000499",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("INGESTION_BATCH_NOT_FOUND");

    await app.close();
  });

  it("returns pagination metadata for notification lists", async () => {
    state.listNotifications.mockResolvedValue([
      notification,
      {
        ...notification,
        id: "00000000-0000-4000-8000-000000000202",
        createdAt: new Date("2026-05-10T23:59:00.000Z"),
      },
    ]);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/notifications?limit=1",
    });

    const body = response.json<{
      notifications: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.listNotifications).toHaveBeenCalledWith({
      db: state.db,
      scope,
      list: {
        limit: 2,
      },
    });
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]?.id).toBe(notification.id);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));

    await app.close();
  });

  it("returns one notification inside the resolved project", async () => {
    state.getNotification.mockResolvedValue(notification);

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/v1/notifications/${notification.id}`,
    });

    const body = response.json<{ notification: { id: string } }>();

    expect(response.statusCode).toBe(200);
    expect(state.getNotification).toHaveBeenCalledWith({
      db: state.db,
      scope,
      notificationId: notification.id,
    });
    expect(body.notification.id).toBe(notification.id);

    await app.close();
  });

  it("returns a stable error code when a notification is out of scope", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/notifications/00000000-0000-4000-8000-000000000299",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("NOTIFICATION_NOT_FOUND");

    await app.close();
  });

  it("updates one notification inside the current session scope", async () => {
    state.updateNotificationStatus.mockResolvedValue({
      ...notification,
      status: "read",
      readAt: new Date("2026-05-11T00:01:00.000Z"),
      updatedAt: new Date("2026-05-11T00:01:00.000Z"),
    });

    const app = await createApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/notifications/00000000-0000-4000-8000-000000000201",
      payload: {
        status: "read",
      },
    });

    const body = response.json<{
      notification: { id: string; status: string; readAt: string | null };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.requireSessionScope).toHaveBeenCalledOnce();
    expect(state.updateNotificationStatus).toHaveBeenCalledWith({
      db: state.db,
      scope,
      notificationId: "00000000-0000-4000-8000-000000000201",
      status: "read",
    });
    expect(body.notification.id).toBe(notification.id);
    expect(body.notification.status).toBe("read");
    expect(body.notification.readAt).toEqual(expect.any(String));

    await app.close();
  });

  it("returns a stable error code when a notification update is out of scope", async () => {
    state.updateNotificationStatus.mockResolvedValue(undefined);

    const app = await createApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/notifications/00000000-0000-4000-8000-000000000201",
      payload: {
        status: "archived",
      },
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("NOTIFICATION_NOT_FOUND");

    await app.close();
  });

  it("marks all unread notifications read inside the current session scope", async () => {
    state.markNotificationsRead.mockResolvedValue(3);

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/notifications/mark-read",
    });

    const body = response.json<{ updated: number }>();

    expect(response.statusCode).toBe(200);
    expect(state.requireSessionScope).toHaveBeenCalledOnce();
    expect(state.markNotificationsRead).toHaveBeenCalledWith({
      db: state.db,
      scope,
    });
    expect(body.updated).toBe(3);

    await app.close();
  });
});

async function createApp() {
  const app = Fastify({ logger: false });

  await registerErrorHandler(app);
  await registerReadRoutes(app);

  return app;
}
