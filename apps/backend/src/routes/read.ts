import { schema } from "@openstat/db";
import {
  getAgent,
  getAgentTimeline,
  getAnalyticsSummary,
  getEventTypeDetail,
  getEvent,
  getEventResources,
  getIngestionBatch,
  getMetricDetail,
  getModelDetail,
  getNotification,
  getOverview,
  getSourceDetail,
  getStatusDetail,
  getTraceDetail,
  listEventArtifacts,
  listIngestionBatches,
  listAgents,
  listEvents,
  listNotifications,
  markNotificationsRead,
  updateNotificationStatus,
} from "@openstat/ingestion";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSessionScope, resolveReadScope } from "../auth-scope.js";
import { database } from "../context.js";
import {
  agentTimelineResponseSchema,
  analyticsSummaryQueryStringSchema,
  analyticsDetailResponseSchema,
  analyticsSummaryResponseSchema,
  bearerSecurity,
  dashboardPreferencesResponseSchema,
  eventListQueryStringSchema,
  errorResponseSchema,
  getAgentResponseSchema,
  getEventResponseSchema,
  getIngestionBatchResponseSchema,
  listAgentsResponseSchema,
  listEventsResponseSchema,
  listIngestionBatchesResponseSchema,
  listArtifactsResponseSchema,
  listNotificationsResponseSchema,
  listQueryStringSchema,
  markNotificationsReadResponseSchema,
  overviewResponseSchema,
  sessionCookieSecurity,
  updateNotificationBodySchema,
  updateDashboardPreferencesBodySchema,
  updateNotificationResponseSchema,
} from "../openapi/schemas.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

const eventListQuerySchema = listQuerySchema.extend({
  agent: z.uuid().optional(),
  eventType: z.string().min(1).max(128).optional(),
  model: z.string().min(1).max(160).optional(),
  q: z.string().min(1).max(240).optional(),
  range: z.enum(["24h", "7d", "30d"]).optional(),
  source: z.enum(["sdk", "http", "webhook", "otel", "system"]).optional(),
  status: z.enum(["all", "errors", "ok"]).optional(),
  trace: z.string().min(1).max(160).optional(),
});

const analyticsSummaryQuerySchema = z.object({
  range: z.enum(["24h", "7d", "30d"]).optional(),
});

const metricParamsSchema = z.object({
  metricKey: z.string().min(1).max(160),
});

const eventTypeParamsSchema = z.object({
  eventType: z.string().min(1).max(160),
});

const sourceParamsSchema = z.object({
  source: z.enum(["sdk", "http", "webhook", "otel", "system"]),
});

const modelParamsSchema = z.object({
  model: z.string().min(1).max(160),
});

const statusParamsSchema = z.object({
  status: z.enum([
    "online",
    "stale",
    "offline",
    "failing",
    "unknown",
    "error",
    "ok",
  ]),
});

const traceParamsSchema = z.object({
  traceId: z.string().min(1).max(160),
});

const ingestionBatchListQuerySchema = listQuerySchema.extend({
  apiKeyId: z.uuid().optional(),
});

const ingestionBatchParamsSchema = z.object({
  batchId: z.uuid(),
});

const agentParamsSchema = z.object({
  agentId: z.uuid(),
});

const eventParamsSchema = z.object({
  eventId: z.uuid(),
});

const notificationParamsSchema = z.object({
  notificationId: z.uuid(),
});

const updateNotificationSchema = z.object({
  status: z.enum(["read", "archived"]),
});

const updateDashboardPreferencesSchema = z.object({
  inspectorCollapsed: z.boolean().optional(),
  inspectorWidth: z.coerce.number().int().min(340).max(560).optional(),
  defaultRange: z.enum(["24h", "7d", "30d"]).optional(),
});

const defaultDashboardPreferences = {
  inspectorCollapsed: false,
  inspectorWidth: 420,
  defaultRange: "24h" as const,
};

export async function registerReadRoutes(app: FastifyInstance) {
  app.get(
    "/v1/overview",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get dashboard overview counts and latest events",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        response: {
          200: overviewResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);

      return getOverview({
        db: database.db,
        scope,
      });
    },
  );

  app.get(
    "/v1/analytics/summary",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get dashboard analytics summary",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsSummaryResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);

      return getAnalyticsSummary({
        db: database.db,
        scope,
        range: query.range ?? "24h",
      });
    },
  );

  app.get(
    "/v1/dashboard/preferences",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get dashboard preferences for the current user",
        security: sessionCookieSecurity,
        response: {
          200: dashboardPreferencesResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await requireSessionScope(request);

      if (!scope.membershipId) {
        return { preferences: defaultDashboardPreferences };
      }

      const [preferences] = await database.db
        .select({
          inspectorCollapsed: schema.dashboardPreferences.inspectorCollapsed,
          inspectorWidth: schema.dashboardPreferences.inspectorWidth,
          defaultRange: schema.dashboardPreferences.defaultRange,
        })
        .from(schema.dashboardPreferences)
        .where(
          and(
            eq(schema.dashboardPreferences.organizationId, scope.organizationId),
            eq(schema.dashboardPreferences.membershipId, scope.membershipId),
            eq(schema.dashboardPreferences.projectId, scope.projectId),
          ),
        )
        .limit(1);

      return {
        preferences: preferences ?? defaultDashboardPreferences,
      };
    },
  );

  app.patch(
    "/v1/dashboard/preferences",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Update dashboard preferences for the current user",
        security: sessionCookieSecurity,
        body: updateDashboardPreferencesBodySchema,
        response: {
          200: dashboardPreferencesResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await requireSessionScope(request);
      const input = updateDashboardPreferencesSchema.parse(request.body ?? {});

      if (!scope.membershipId) {
        return { preferences: defaultDashboardPreferences };
      }

      const [preferences] = await database.db
        .insert(schema.dashboardPreferences)
        .values({
          organizationId: scope.organizationId,
          membershipId: scope.membershipId,
          projectId: scope.projectId,
          inspectorCollapsed:
            input.inspectorCollapsed ??
            defaultDashboardPreferences.inspectorCollapsed,
          inspectorWidth:
            input.inspectorWidth ?? defaultDashboardPreferences.inspectorWidth,
          defaultRange: input.defaultRange ?? defaultDashboardPreferences.defaultRange,
        })
        .onConflictDoUpdate({
          target: [
            schema.dashboardPreferences.organizationId,
            schema.dashboardPreferences.membershipId,
            schema.dashboardPreferences.projectId,
          ],
          set: {
            ...input,
            updatedAt: new Date(),
          },
        })
        .returning({
          inspectorCollapsed: schema.dashboardPreferences.inspectorCollapsed,
          inspectorWidth: schema.dashboardPreferences.inspectorWidth,
          defaultRange: schema.dashboardPreferences.defaultRange,
        });

      return {
        preferences: preferences ?? defaultDashboardPreferences,
      };
    },
  );

  app.get(
    "/v1/analytics/metrics/:metricKey",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one analytics metric detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);
      const params = metricParamsSchema.parse(request.params);
      const detail = await getMetricDetail({
        db: database.db,
        scope,
        metricKey: params.metricKey,
        range: query.range ?? "24h",
      });

      if (!detail) {
        return reply.status(404).send({
          error: {
            code: "METRIC_NOT_FOUND",
            message: "Metric was not found.",
            requestId: request.id,
          },
        });
      }

      return { detail };
    },
  );

  app.get(
    "/v1/analytics/event-types/:eventType",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one event type detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);
      const params = eventTypeParamsSchema.parse(request.params);
      const detail = await getEventTypeDetail({
        db: database.db,
        scope,
        eventType: params.eventType,
        range: query.range ?? "24h",
      });

      if (!detail) {
        return reply.status(404).send({
          error: {
            code: "EVENT_TYPE_NOT_FOUND",
            message: "Event type was not found.",
            requestId: request.id,
          },
        });
      }

      return { detail };
    },
  );

  app.get(
    "/v1/analytics/sources/:source",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one event source detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);
      const params = sourceParamsSchema.parse(request.params);
      const detail = await getSourceDetail({
        db: database.db,
        scope,
        source: params.source,
        range: query.range ?? "24h",
      });

      return { detail };
    },
  );

  app.get(
    "/v1/analytics/models/:model",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one model detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);
      const params = modelParamsSchema.parse(request.params);
      const detail = await getModelDetail({
        db: database.db,
        scope,
        model: params.model,
        range: query.range ?? "24h",
      });

      if (!detail) {
        return reply.status(404).send({
          error: {
            code: "MODEL_NOT_FOUND",
            message: "Model was not found.",
            requestId: request.id,
          },
        });
      }

      return { detail };
    },
  );

  app.get(
    "/v1/analytics/status/:status",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one status detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: analyticsSummaryQueryStringSchema,
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const query = analyticsSummaryQuerySchema.parse(request.query);
      const params = statusParamsSchema.parse(request.params);
      const detail = await getStatusDetail({
        db: database.db,
        scope,
        status: params.status,
        range: query.range ?? "24h",
      });

      return { detail };
    },
  );

  app.get(
    "/v1/analytics/traces/:traceId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one trace detail",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = traceParamsSchema.parse(request.params);
      const detail = await getTraceDetail({
        db: database.db,
        scope,
        traceId: params.traceId,
      });

      if (!detail) {
        return reply.status(404).send({
          error: {
            code: "TRACE_NOT_FOUND",
            message: "Trace was not found.",
            requestId: request.id,
          },
        });
      }

      return { detail };
    },
  );

  app.get(
    "/v1/agents",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List agents for the current project",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: listQueryStringSchema,
        response: {
          200: listAgentsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const list = listQuerySchema.parse(request.query);
      const agents = await listAgents({
        db: database.db,
        scope,
        list: toWindowedList(list),
      });
      const page = paginate(agents, list.limit, (agent) => ({
        createdAt: agent.lastSeenAt ?? agent.createdAt,
        id: agent.id,
      }));

      return {
        agents: page.items,
        pagination: page.pagination,
      };
    },
  );

  app.get(
    "/v1/agents/:agentId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one agent",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["agentId"],
          properties: {
            agentId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: getAgentResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = agentParamsSchema.parse(request.params);
      const agent = await getAgent({
        db: database.db,
        scope,
        agentId: params.agentId,
      });

      if (!agent) {
        return reply.status(404).send({
          error: {
            code: "AGENT_NOT_FOUND",
            message: "Agent was not found.",
            requestId: request.id,
          },
        });
      }

      return { agent };
    },
  );

  app.get(
    "/v1/agents/:agentId/timeline",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List one agent timeline",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["agentId"],
          properties: {
            agentId: { type: "string", format: "uuid" },
          },
        },
        querystring: listQueryStringSchema,
        response: {
          200: agentTimelineResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = agentParamsSchema.parse(request.params);
      const list = listQuerySchema.parse(request.query);
      const timeline = await getAgentTimeline({
        db: database.db,
        scope,
        agentId: params.agentId,
        list: toWindowedList(list),
      });

      if (!timeline) {
        return reply.status(404).send({
          error: {
            code: "AGENT_NOT_FOUND",
            message: "Agent was not found.",
            requestId: request.id,
          },
        });
      }

      const page = paginate(timeline.events, list.limit, (event) => ({
        createdAt: event.createdAt,
        id: event.id,
      }));

      return {
        agent: timeline.agent,
        events: page.items,
        pagination: page.pagination,
      };
    },
  );

  app.get(
    "/v1/events",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List events for the current project",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: eventListQueryStringSchema,
        response: {
          200: listEventsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const query = eventListQuerySchema.parse(request.query);
      const events = await listEvents({
        db: database.db,
        scope,
        list: toWindowedList(query),
        filters: {
          agentId: query.agent,
          eventType: query.eventType,
          model: query.model,
          q: query.q,
          range: query.range,
          source: query.source,
          status: query.status,
          trace: query.trace,
        },
      });
      const page = paginate(events, query.limit, (event) => ({
        createdAt: event.createdAt,
        id: event.id,
      }));

      return {
        events: page.items,
        pagination: page.pagination,
      };
    },
  );

  app.get(
    "/v1/events/:eventId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one event",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: getEventResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = eventParamsSchema.parse(request.params);
      const event = await getEvent({
        db: database.db,
        scope,
        eventId: params.eventId,
      });

      if (!event) {
        return reply.status(404).send({
          error: {
            code: "EVENT_NOT_FOUND",
            message: "Event was not found.",
            requestId: request.id,
          },
        });
      }

      return { event };
    },
  );

  app.get(
    "/v1/events/:eventId/artifacts",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List artifacts for one event",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: listArtifactsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const params = eventParamsSchema.parse(request.params);
      const artifacts = await listEventArtifacts({
        db: database.db,
        scope,
        eventId: params.eventId,
      });

      return { artifacts };
    },
  );

  app.get(
    "/v1/events/:eventId/resources",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get child resources for one event",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: analyticsDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const params = eventParamsSchema.parse(request.params);
      const resources = await getEventResources({
        db: database.db,
        scope,
        eventId: params.eventId,
      });

      return { resources };
    },
  );

  app.get(
    "/v1/ingestion-batches",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List ingestion batches for the current project",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: {
          type: "object",
          properties: {
            ...listQueryStringSchema.properties,
            apiKeyId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: listIngestionBatchesResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const query = ingestionBatchListQuerySchema.parse(request.query);
      const batches = await listIngestionBatches({
        db: database.db,
        scope,
        list: toWindowedList(query),
        apiKeyId: query.apiKeyId,
      });
      const page = paginate(batches, query.limit, (batch) => ({
        createdAt: batch.receivedAt,
        id: batch.id,
      }));

      return {
        batches: page.items,
        pagination: page.pagination,
      };
    },
  );

  app.get(
    "/v1/ingestion-batches/:batchId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one ingestion batch",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["batchId"],
          properties: {
            batchId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: getIngestionBatchResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = ingestionBatchParamsSchema.parse(request.params);
      const batch = await getIngestionBatch({
        db: database.db,
        scope,
        batchId: params.batchId,
      });

      if (!batch) {
        return reply.status(404).send({
          error: {
            code: "INGESTION_BATCH_NOT_FOUND",
            message: "Ingestion batch was not found.",
            requestId: request.id,
          },
        });
      }

      return { batch };
    },
  );

  app.get(
    "/v1/notifications",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "List notifications for the current project",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        querystring: listQueryStringSchema,
        response: {
          200: listNotificationsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await resolveReadScope(request);
      const list = listQuerySchema.parse(request.query);
      const notifications = await listNotifications({
        db: database.db,
        scope,
        list: toWindowedList(list),
      });
      const page = paginate(notifications, list.limit, (notification) => ({
        createdAt: notification.createdAt,
        id: notification.id,
      }));

      return {
        notifications: page.items,
        pagination: page.pagination,
      };
    },
  );

  app.get(
    "/v1/notifications/:notificationId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Get one notification",
        security: [...sessionCookieSecurity, ...bearerSecurity],
        params: {
          type: "object",
          required: ["notificationId"],
          properties: {
            notificationId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: updateNotificationResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await resolveReadScope(request);
      const params = notificationParamsSchema.parse(request.params);
      const notification = await getNotification({
        db: database.db,
        scope,
        notificationId: params.notificationId,
      });

      if (!notification) {
        return reply.status(404).send({
          error: {
            code: "NOTIFICATION_NOT_FOUND",
            message: "Notification was not found.",
            requestId: request.id,
          },
        });
      }

      return { notification };
    },
  );

  app.patch(
    "/v1/notifications/:notificationId",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Update a notification status",
        security: sessionCookieSecurity,
        params: {
          type: "object",
          required: ["notificationId"],
          properties: {
            notificationId: { type: "string", format: "uuid" },
          },
        },
        body: updateNotificationBodySchema,
        response: {
          200: updateNotificationResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await requireSessionScope(request);
      const params = notificationParamsSchema.parse(request.params);
      const input = updateNotificationSchema.parse(request.body);
      const notification = await updateNotificationStatus({
        db: database.db,
        scope,
        notificationId: params.notificationId,
        status: input.status,
      });

      if (!notification) {
        return reply.status(404).send({
          error: {
            code: "NOTIFICATION_NOT_FOUND",
            message: "Notification was not found.",
            requestId: request.id,
          },
        });
      }

      return { notification };
    },
  );

  app.post(
    "/v1/notifications/mark-read",
    {
      schema: {
        tags: ["Monitoring"],
        summary: "Mark all notifications read",
        security: sessionCookieSecurity,
        response: {
          200: markNotificationsReadResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await requireSessionScope(request);
      const updated = await markNotificationsRead({
        db: database.db,
        scope,
      });

      return { updated };
    },
  );
}

function toWindowedList(list: ListQuery) {
  const limit = list.limit ?? 50;

  return {
    cursor: list.cursor,
    limit: limit + 1,
  };
}

function paginate<T>(
  items: T[],
  requestedLimit: number | undefined,
  getCursor: (item: T) => { createdAt: Date | string; id: string },
) {
  const limit = requestedLimit ?? 50;
  const pageItems = items.slice(0, limit);
  const nextItem = items[limit];

  return {
    items: pageItems,
    pagination: {
      nextCursor: nextItem ? encodeCursor(getCursor(nextItem)) : null,
    },
  };
}

function encodeCursor(cursor: { createdAt: Date | string; id: string }) {
  return Buffer.from(
    JSON.stringify({
      createdAt: new Date(cursor.createdAt).toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

type ListQuery = z.infer<typeof listQuerySchema>;
