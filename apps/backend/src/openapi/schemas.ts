export const bearerSecurity = [{ bearerAuth: [] }] as const;
export const sessionCookieSecurity = [{ sessionCookie: [] }] as const;

export const errorResponseSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "requestId"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
        details: { type: "object", additionalProperties: true },
      },
    },
  },
} as const;

export const agentInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      description: "Optional stable agent id from the caller's system.",
    },
    name: {
      type: "string",
      description: "Human-readable agent name.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const ingestEventBodySchema = {
  type: "object",
  required: ["type", "data"],
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 160,
      description: "Optional sender-provided event id for idempotency.",
    },
    schema_version: {
      type: "integer",
      const: 1,
      default: 1,
    },
    agent: agentInputSchema,
    project_id: {
      type: "string",
      format: "uuid",
      description:
        "Optional project override. Defaults to the project attached to the API key.",
    },
    type: {
      type: "string",
      minLength: 1,
      maxLength: 128,
    },
    data: {
      type: "object",
      additionalProperties: true,
    },
    timestamp: {
      type: "integer",
      description:
        "Unix timestamp in milliseconds. Defaults to server receipt time.",
    },
    trace_id: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    span_id: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    run_id: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    tags: {
      type: "array",
      maxItems: 50,
      items: { type: "string", minLength: 1, maxLength: 64 },
    },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

export const ingestBatchBodySchema = {
  type: "object",
  required: ["events"],
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: ingestEventBodySchema,
    },
  },
} as const;

export const heartbeatBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 160 },
    schema_version: { type: "integer", const: 1, default: 1 },
    agent: agentInputSchema,
    project_id: { type: "string", format: "uuid" },
    data: {
      type: "object",
      additionalProperties: true,
      default: {},
    },
    timestamp: { type: "integer" },
    trace_id: { type: "string", minLength: 1, maxLength: 160 },
    span_id: { type: "string", minLength: 1, maxLength: 160 },
    run_id: { type: "string", minLength: 1, maxLength: 160 },
    tags: {
      type: "array",
      maxItems: 50,
      items: { type: "string", minLength: 1, maxLength: 64 },
    },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

export const ingestEventAcceptedSchema = {
  type: "object",
  required: ["accepted", "batchId", "projectId", "count", "outboxIds"],
  properties: {
    accepted: { type: "boolean", const: true },
    batchId: { type: "string", format: "uuid" },
    projectId: { type: "string", format: "uuid" },
    count: { type: "integer" },
    outboxIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
  },
} as const;

export const ingestBatchAcceptedSchema = {
  ...ingestEventAcceptedSchema,
} as const;

export const apiKeySchema = {
  type: "object",
  required: ["id", "name", "prefix", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    prefix: { type: "string" },
    lastUsedAt: { type: ["string", "null"], format: "date-time" },
    revokedAt: { type: ["string", "null"], format: "date-time" },
    expiresAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

export const listApiKeysResponseSchema = {
  type: "object",
  required: ["apiKeys"],
  properties: {
    apiKeys: {
      type: "array",
      items: apiKeySchema,
    },
  },
} as const;

export const getApiKeyResponseSchema = {
  type: "object",
  required: ["apiKey"],
  properties: {
    apiKey: apiKeySchema,
  },
} as const;

export const createApiKeyBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      default: "Ingestion key",
    },
  },
} as const;

export const createApiKeyResponseSchema = {
  type: "object",
  required: ["apiKey", "key"],
  properties: {
    apiKey: apiKeySchema,
    key: {
      type: "string",
      description: "Plaintext API key. Displayed once.",
    },
  },
} as const;

export const revokeApiKeyResponseSchema = {
  type: "object",
  required: ["apiKey"],
  properties: {
    apiKey: {
      type: "object",
      required: ["id", "revokedAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        revokedAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const;

export const rotateApiKeyResponseSchema = {
  type: "object",
  required: ["apiKey", "key", "rotatedApiKey"],
  properties: {
    apiKey: apiKeySchema,
    key: {
      type: "string",
      description: "Plaintext replacement API key. Displayed once.",
    },
    rotatedApiKey: {
      type: "object",
      required: ["id", "revokedAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        revokedAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const;

export const listQueryStringSchema = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 50,
    },
    cursor: {
      type: "string",
      description: "Opaque cursor from the previous response.",
    },
  },
} as const;

export const eventListQueryStringSchema = {
  type: "object",
  properties: {
    ...listQueryStringSchema.properties,
    agent: {
      type: "string",
      format: "uuid",
    },
    eventType: {
      type: "string",
      minLength: 1,
      maxLength: 128,
    },
    model: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    q: {
      type: "string",
      minLength: 1,
      maxLength: 240,
    },
    range: {
      type: "string",
      enum: ["24h", "7d", "30d"],
    },
    source: {
      type: "string",
      enum: ["sdk", "http", "webhook", "otel", "system"],
    },
    status: {
      type: "string",
      enum: ["all", "errors", "ok"],
    },
    trace: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
  },
} as const;

export const paginationSchema = {
  type: "object",
  required: ["nextCursor"],
  properties: {
    nextCursor: {
      type: ["string", "null"],
      description:
        "Cursor for the next page, or null when there is no next page.",
    },
  },
} as const;

export const agentStatusCountsSchema = {
  type: "object",
  required: ["online", "stale", "offline", "failing", "unknown"],
  properties: {
    online: { type: "integer" },
    stale: { type: "integer" },
    offline: { type: "integer" },
    failing: { type: "integer" },
    unknown: { type: "integer" },
  },
} as const;

export const agentSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "externalId",
    "status",
    "mode",
    "tags",
    "lastSeenAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    externalId: { type: ["string", "null"] },
    status: {
      type: "string",
      enum: ["online", "stale", "offline", "failing", "unknown"],
    },
    mode: { type: "string", enum: ["long_running", "scheduled"] },
    tags: { type: "array", items: { type: "string" } },
    heartbeatHealth: {
      type: "object",
      required: [
        "healthyHeartbeats",
        "lastHeartbeatAt",
        "receivedHeartbeats",
        "uptimePercent",
        "window",
      ],
      properties: {
        healthyHeartbeats: { type: "integer" },
        lastHeartbeatAt: { type: ["string", "null"], format: "date-time" },
        receivedHeartbeats: { type: "integer" },
        uptimePercent: { type: "integer" },
        window: { type: "string", enum: ["24h", "7d", "30d"] },
      },
    },
    lastSeenAt: { type: ["string", "null"], format: "date-time" },
    metadata: { type: "object", additionalProperties: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const eventSchema = {
  type: "object",
  required: [
    "id",
    "agentId",
    "eventType",
    "source",
    "timestamp",
    "traceId",
    "spanId",
    "runId",
    "data",
    "metadata",
    "tags",
    "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    agentId: { type: "string", format: "uuid" },
    eventType: { type: "string" },
    source: {
      type: "string",
      enum: ["sdk", "http", "webhook", "otel", "system"],
    },
    timestamp: { type: "string", format: "date-time" },
    traceId: { type: ["string", "null"] },
    spanId: { type: ["string", "null"] },
    runId: { type: ["string", "null"] },
    data: { type: "object", additionalProperties: true },
    metadata: { type: "object", additionalProperties: true },
    tags: { type: "array", items: { type: "string" } },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

export const notificationSchema = {
  type: "object",
  required: [
    "id",
    "projectId",
    "agentId",
    "type",
    "status",
    "title",
    "message",
    "data",
    "readAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: ["string", "null"], format: "uuid" },
    agentId: { type: ["string", "null"], format: "uuid" },
    type: { type: "string" },
    status: {
      type: "string",
      enum: ["unread", "read", "archived"],
    },
    title: { type: "string" },
    message: { type: ["string", "null"] },
    data: { type: ["object", "null"], additionalProperties: true },
    readAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const updateNotificationBodySchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["read", "archived"],
    },
  },
} as const;

export const updateNotificationResponseSchema = {
  type: "object",
  required: ["notification"],
  properties: {
    notification: notificationSchema,
  },
} as const;

export const markNotificationsReadResponseSchema = {
  type: "object",
  required: ["updated"],
  properties: {
    updated: { type: "integer" },
  },
} as const;

export const overviewResponseSchema = {
  type: "object",
  required: ["agents", "events"],
  properties: {
    agents: {
      type: "object",
      required: ["total", "byStatus"],
      properties: {
        total: { type: "integer" },
        byStatus: agentStatusCountsSchema,
      },
    },
    events: {
      type: "object",
      required: ["total", "latest"],
      properties: {
        total: { type: "integer" },
        latest: {
          type: "array",
          items: eventSchema,
        },
      },
    },
  },
} as const;

export const analyticsSummaryQueryStringSchema = {
  type: "object",
  properties: {
    range: {
      type: "string",
      enum: ["24h", "7d", "30d"],
    },
  },
} as const;

const analyticsBreakdownItemSchema = {
  type: "object",
  required: ["value", "count"],
  properties: {
    value: { type: "string" },
    count: { type: "integer" },
    errors: { type: "integer" },
  },
} as const;

export const analyticsSummaryResponseSchema = {
  type: "object",
  required: [
    "range",
    "generatedAt",
    "totals",
    "series",
    "breakdowns",
    "topTraces",
  ],
  properties: {
    range: { type: "string", enum: ["24h", "7d", "30d"] },
    generatedAt: { type: "string", format: "date-time" },
    totals: {
      type: "object",
      required: [
        "activeApiKeys",
        "agents",
        "apiKeys",
        "decisions",
        "errors",
        "events",
        "failures",
        "failedIngestionBatches",
        "fills",
        "ingestionBatches",
        "notifications",
        "orders",
        "pnlSnapshots",
        "riskRejects",
        "unreadNotifications",
      ],
      properties: {
        activeApiKeys: { type: "integer" },
        agents: { type: "integer" },
        apiKeys: { type: "integer" },
        decisions: { type: "integer" },
        errors: { type: "integer" },
        events: { type: "integer" },
        failures: { type: "integer" },
        failedIngestionBatches: { type: "integer" },
        fills: { type: "integer" },
        ingestionBatches: { type: "integer" },
        notifications: { type: "integer" },
        orders: { type: "integer" },
        pnlSnapshots: { type: "integer" },
        riskRejects: { type: "integer" },
        unreadNotifications: { type: "integer" },
      },
    },
    series: {
      type: "array",
      items: {
        type: "object",
        required: ["bucket", "events", "errors"],
        properties: {
          bucket: { type: "string", format: "date-time" },
          events: { type: "integer" },
          errors: { type: "integer" },
        },
      },
    },
    breakdowns: {
      type: "object",
      required: ["agents", "eventTypes", "models", "sources", "statuses"],
      properties: {
        agents: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "count"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              count: { type: "integer" },
            },
          },
        },
        eventTypes: { type: "array", items: analyticsBreakdownItemSchema },
        models: { type: "array", items: analyticsBreakdownItemSchema },
        sources: { type: "array", items: analyticsBreakdownItemSchema },
        statuses: { type: "array", items: analyticsBreakdownItemSchema },
      },
    },
    topTraces: {
      type: "array",
      items: analyticsBreakdownItemSchema,
    },
  },
} as const;

export const analyticsDetailResponseSchema = {
  type: "object",
  additionalProperties: true,
} as const;

export const dashboardPreferencesSchema = {
  type: "object",
  required: ["inspectorCollapsed", "inspectorWidth", "defaultRange"],
  properties: {
    inspectorCollapsed: { type: "boolean" },
    inspectorWidth: { type: "integer" },
    defaultRange: { type: "string", enum: ["24h", "7d", "30d"] },
  },
} as const;

export const dashboardPreferencesResponseSchema = {
  type: "object",
  required: ["preferences"],
  properties: {
    preferences: dashboardPreferencesSchema,
  },
} as const;

export const updateDashboardPreferencesBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    inspectorCollapsed: { type: "boolean" },
    inspectorWidth: { type: "integer", minimum: 340, maximum: 560 },
    defaultRange: { type: "string", enum: ["24h", "7d", "30d"] },
  },
} as const;

export const listAgentsResponseSchema = {
  type: "object",
  required: ["agents", "pagination"],
  properties: {
    agents: {
      type: "array",
      items: agentSchema,
    },
    pagination: paginationSchema,
  },
} as const;

export const getAgentResponseSchema = {
  type: "object",
  required: ["agent"],
  properties: {
    agent: agentSchema,
  },
} as const;

export const listEventsResponseSchema = {
  type: "object",
  required: ["events", "pagination"],
  properties: {
    events: {
      type: "array",
      items: eventSchema,
    },
    pagination: paginationSchema,
  },
} as const;

export const getEventResponseSchema = {
  type: "object",
  required: ["event"],
  properties: {
    event: eventSchema,
  },
} as const;

export const ingestionBatchSchema = {
  type: "object",
  required: [
    "id",
    "apiKeyId",
    "source",
    "status",
    "eventCount",
    "acceptedCount",
    "rejectedCount",
    "requestId",
    "receivedAt",
    "processedAt",
    "failedAt",
    "errorCode",
    "errorMessage",
    "metadata",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    apiKeyId: { type: ["string", "null"], format: "uuid" },
    source: {
      type: "string",
      enum: ["sdk", "http", "webhook", "otel", "system"],
    },
    status: {
      type: "string",
      enum: [
        "accepted",
        "processing",
        "processed",
        "partially_processed",
        "failed",
      ],
    },
    eventCount: { type: "integer" },
    acceptedCount: { type: "integer" },
    rejectedCount: { type: "integer" },
    requestId: { type: ["string", "null"] },
    receivedAt: { type: "string", format: "date-time" },
    processedAt: { type: ["string", "null"], format: "date-time" },
    failedAt: { type: ["string", "null"], format: "date-time" },
    errorCode: { type: ["string", "null"] },
    errorMessage: { type: ["string", "null"] },
    metadata: { type: "object", additionalProperties: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const listIngestionBatchesResponseSchema = {
  type: "object",
  required: ["batches", "pagination"],
  properties: {
    batches: {
      type: "array",
      items: ingestionBatchSchema,
    },
    pagination: paginationSchema,
  },
} as const;

export const getIngestionBatchResponseSchema = {
  type: "object",
  required: ["batch"],
  properties: {
    batch: ingestionBatchSchema,
  },
} as const;

export const artifactSchema = {
  type: "object",
  required: [
    "id",
    "projectId",
    "agentId",
    "eventId",
    "objectKey",
    "contentType",
    "sizeBytes",
    "checksum",
    "metadata",
    "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: ["string", "null"], format: "uuid" },
    agentId: { type: ["string", "null"], format: "uuid" },
    eventId: { type: ["string", "null"], format: "uuid" },
    objectKey: { type: "string" },
    contentType: { type: ["string", "null"] },
    sizeBytes: { type: ["integer", "null"] },
    checksum: { type: ["string", "null"] },
    metadata: { type: "object", additionalProperties: true },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

export const listArtifactsResponseSchema = {
  type: "object",
  required: ["artifacts"],
  properties: {
    artifacts: {
      type: "array",
      items: artifactSchema,
    },
  },
} as const;

export const listNotificationsResponseSchema = {
  type: "object",
  required: ["notifications", "pagination"],
  properties: {
    notifications: {
      type: "array",
      items: notificationSchema,
    },
    pagination: paginationSchema,
  },
} as const;

export const agentTimelineResponseSchema = {
  type: "object",
  required: ["agent", "events", "pagination"],
  properties: {
    agent: agentSchema,
    events: {
      type: "array",
      items: eventSchema,
    },
    pagination: paginationSchema,
  },
} as const;
