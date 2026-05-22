import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const agentStatus = pgEnum("agent_status", [
  "online",
  "stale",
  "offline",
  "failing",
  "unknown",
]);

export const agentMode = pgEnum("agent_mode", ["long_running", "scheduled"]);

export const eventSource = pgEnum("event_source", [
  "sdk",
  "http",
  "webhook",
  "otel",
  "system",
]);

export const ingestionBatchStatus = pgEnum("ingestion_batch_status", [
  "accepted",
  "processing",
  "processed",
  "partially_processed",
  "failed",
]);

export const ingestionOutboxStatus = pgEnum("ingestion_outbox_status", [
  "pending",
  "processing",
  "processed",
  "retryable",
  "dead_lettered",
]);

export const notificationStatus = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);

export const tradingSide = pgEnum("trading_side", ["buy", "sell"]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "submitted",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected",
  "failed",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("projects_organization_slug_idx").on(
      table.organizationId,
      table.slug,
    ),
    index("projects_organization_default_idx").on(
      table.organizationId,
      table.isDefault,
    ),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_organization_user_idx").on(
      table.organizationId,
      table.userId,
    ),
    index("memberships_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    secretHash: text("secret_hash").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("api_keys_prefix_idx").on(table.prefix),
    index("api_keys_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    name: text("name").notNull(),
    status: agentStatus("status").notNull().default("unknown"),
    mode: agentMode("mode").notNull().default("long_running"),
    expectedCheckInSeconds: integer("expected_check_in_seconds"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("agents_project_external_id_idx").on(
      table.projectId,
      table.externalId,
    ),
    index("agents_project_status_idx").on(table.projectId, table.status),
    index("agents_project_last_seen_idx").on(table.projectId, table.lastSeenAt),
  ],
);

export const ingestionBatches = pgTable(
  "ingestion_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    source: eventSource("source").notNull(),
    status: ingestionBatchStatus("status").notNull().default("accepted"),
    eventCount: integer("event_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    requestId: text("request_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("ingestion_batches_project_received_idx").on(
      table.projectId,
      table.receivedAt,
    ),
    index("ingestion_batches_api_key_idx").on(table.apiKeyId),
  ],
);

export const ingestionOutbox = pgTable(
  "ingestion_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => ingestionBatches.id, { onDelete: "cascade" }),
    status: ingestionOutboxStatus("status").notNull().default("pending"),
    source: eventSource("source").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key"),
    attempts: integer("attempts").notNull().default(0),
    workerId: text("worker_id"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ingestion_outbox_project_idempotency_idx")
      .on(table.projectId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    index("ingestion_outbox_status_locked_idx").on(
      table.status,
      table.lockedUntil,
    ),
    index("ingestion_outbox_batch_idx").on(table.batchId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    batchId: uuid("batch_id").references(() => ingestionBatches.id, {
      onDelete: "set null",
    }),
    outboxId: uuid("outbox_id").references(() => ingestionOutbox.id, {
      onDelete: "set null",
    }),
    externalEventId: text("external_event_id"),
    eventType: text("event_type").notNull(),
    source: eventSource("source").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    runId: text("run_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("events_project_external_event_idx")
      .on(table.projectId, table.externalEventId)
      .where(sql`${table.externalEventId} IS NOT NULL`),
    index("events_project_created_idx").on(table.projectId, table.createdAt),
    index("events_project_type_created_idx").on(
      table.projectId,
      table.eventType,
      table.createdAt,
    ),
    index("events_project_agent_created_idx").on(
      table.projectId,
      table.agentId,
      table.createdAt,
    ),
    index("events_project_trace_idx").on(table.projectId, table.traceId),
    index("events_project_run_idx").on(table.projectId, table.runId),
  ],
);

export const heartbeats = pgTable("heartbeats", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  status: agentStatus("status").notNull().default("online"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const llmUsage = pgTable(
  "llm_usage",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => events.id, { onDelete: "cascade" }),
    provider: text("provider"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    latencyMs: integer("latency_ms"),
    status: text("status"),
  },
  (table) => [index("llm_usage_model_idx").on(table.model)],
);

export const eventPropertyCatalog = pgTable(
  "event_property_catalog",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    propertyPath: text("property_path").notNull(),
    valueType: text("value_type").notNull(),
    occurrences: integer("occurrences").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.projectId,
        table.eventType,
        table.propertyPath,
        table.valueType,
      ],
    }),
    index("event_property_catalog_project_event_idx").on(
      table.projectId,
      table.eventType,
    ),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    externalRunId: text("external_run_id"),
    strategy: text("strategy"),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("agent_runs_project_external_idx")
      .on(table.projectId, table.externalRunId)
      .where(sql`${table.externalRunId} IS NOT NULL`),
    index("agent_runs_project_started_idx").on(table.projectId, table.startedAt),
  ],
);

export const tradingDecisions = pgTable(
  "trading_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    runId: uuid("run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    strategy: text("strategy"),
    symbol: text("symbol"),
    action: text("action").notNull(),
    confidence: integer("confidence"),
    rationaleSummary: text("rationale_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("trading_decisions_project_decided_idx").on(
      table.projectId,
      table.decidedAt,
    ),
    index("trading_decisions_project_symbol_idx").on(table.projectId, table.symbol),
  ],
);

export const riskChecks = pgTable(
  "risk_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    decisionId: uuid("decision_id").references(() => tradingDecisions.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    result: text("result").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("risk_checks_project_checked_idx").on(table.projectId, table.checkedAt)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    decisionId: uuid("decision_id").references(() => tradingDecisions.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalOrderId: text("external_order_id"),
    strategy: text("strategy"),
    symbol: text("symbol").notNull(),
    venue: text("venue"),
    side: tradingSide("side").notNull(),
    orderType: text("order_type").notNull(),
    quantity: text("quantity").notNull(),
    price: text("price"),
    status: orderStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_project_external_idx")
      .on(table.projectId, table.externalOrderId)
      .where(sql`${table.externalOrderId} IS NOT NULL`),
    index("orders_project_symbol_created_idx").on(
      table.projectId,
      table.symbol,
      table.createdAt,
    ),
  ],
);

export const fills = pgTable(
  "fills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalFillId: text("external_fill_id"),
    symbol: text("symbol").notNull(),
    venue: text("venue"),
    side: tradingSide("side").notNull(),
    quantity: text("quantity").notNull(),
    price: text("price").notNull(),
    fee: text("fee"),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("fills_project_external_idx")
      .on(table.projectId, table.externalFillId)
      .where(sql`${table.externalFillId} IS NOT NULL`),
    index("fills_project_symbol_filled_idx").on(
      table.projectId,
      table.symbol,
      table.filledAt,
    ),
  ],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    strategy: text("strategy"),
    symbol: text("symbol").notNull(),
    quantity: text("quantity").notNull(),
    averagePrice: text("average_price"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("positions_project_strategy_symbol_idx").on(
      table.projectId,
      table.strategy,
      table.symbol,
    ),
  ],
);

export const pnlSnapshots = pgTable(
  "pnl_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    strategy: text("strategy"),
    symbol: text("symbol"),
    realizedPnl: text("realized_pnl"),
    unrealizedPnl: text("unrealized_pnl"),
    equity: text("equity"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("pnl_snapshots_project_snapshot_idx").on(
      table.projectId,
      table.snapshotAt,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    status: notificationStatus("status").notNull().default("unread"),
    title: text("title").notNull(),
    message: text("message"),
    data: jsonb("data").$type<Record<string, unknown> | null>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("notifications_project_status_created_idx").on(
      table.projectId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const dashboardPreferences = pgTable(
  "dashboard_preferences",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    inspectorCollapsed: boolean("inspector_collapsed").notNull().default(false),
    inspectorWidth: integer("inspector_width").notNull().default(420),
    defaultRange: text("default_range").notNull().default("24h"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.membershipId, table.projectId],
    }),
  ],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    checksum: text("checksum"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("artifacts_event_idx").on(table.eventId)],
);

export const otelSpans = pgTable(
  "otel_spans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    parentSpanId: text("parent_span_id"),
    name: text("name").notNull(),
    kind: text("kind"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    resource: jsonb("resource").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("otel_spans_project_trace_span_idx").on(
      table.projectId,
      table.traceId,
      table.spanId,
    ),
    index("otel_spans_project_started_idx").on(table.projectId, table.startedAt),
  ],
);

export const otelLogs = pgTable(
  "otel_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    severityText: text("severity_text"),
    body: jsonb("body").$type<unknown>(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("otel_logs_project_observed_idx").on(table.projectId, table.observedAt),
    index("otel_logs_project_trace_idx").on(table.projectId, table.traceId),
  ],
);

export const otelMetrics = pgTable(
  "otel_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit"),
    kind: text("kind").notNull(),
    value: text("value"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("otel_metrics_project_name_recorded_idx").on(
      table.projectId,
      table.name,
      table.recordedAt,
    ),
  ],
);
