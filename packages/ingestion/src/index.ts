import type { ApiKeyAuthContext } from "@openstat/auth";
import { schema, type Database } from "@openstat/db";
import type { IngestEventBatchInput, IngestEventInput } from "@openstat/schemas";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

export type ReadScope = {
  membershipId?: string;
  organizationId: string;
  projectId: string;
};

export type EventSource = "sdk" | "http" | "webhook" | "otel" | "system";

export interface IngestionSignalPublisher {
  publish(channel: string, message: string): Promise<void>;
}

export class IngestionError extends Error {
  constructor(public readonly code: IngestionErrorCode, message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

export type IngestionErrorCode =
  | "EMPTY_INGESTION_BATCH"
  | "INVALID_OUTBOX_PAYLOAD"
  | "PROJECT_SCOPE_MISMATCH"
  | "PROJECT_NOT_FOUND"
  | "AGENT_NOT_FOUND";

export function createIngestionRedisClient(
  redisUrl: string | undefined,
): IngestionSignalPublisher | undefined {
  if (!redisUrl) {
    return undefined;
  }

  return {
    async publish() {
      // Redis-backed wakeups will land with the worker. For now, polling still
      // makes ingestion deterministic in local/dev deployments.
    },
  };
}

export async function acceptIngestionBatch(options: {
  db: Database["db"];
  auth: ApiKeyAuthContext;
  input: IngestEventBatchInput;
  source: EventSource;
  requestId?: string;
  publisher?: IngestionSignalPublisher;
}) {
  if (options.input.events.length === 0) {
    throw new IngestionError("EMPTY_INGESTION_BATCH", "Ingestion batch is empty.");
  }

  const projectIds = new Set(
    options.input.events
      .map((event) => event.project_id)
      .filter((projectId): projectId is string => Boolean(projectId)),
  );

  if (projectIds.size > 1 || (projectIds.size === 1 && !projectIds.has(options.auth.projectId))) {
    throw new IngestionError(
      "PROJECT_SCOPE_MISMATCH",
      "Event project_id does not match the authenticated API key project.",
    );
  }

  const [batch] = await options.db
    .insert(schema.ingestionBatches)
    .values({
      apiKeyId: options.auth.apiKeyId,
      organizationId: options.auth.organizationId,
      projectId: options.auth.projectId,
      source: options.source,
      status: "accepted",
      eventCount: options.input.events.length,
      acceptedCount: options.input.events.length,
      rejectedCount: 0,
      requestId: options.requestId,
      metadata: {},
    })
    .returning({ id: schema.ingestionBatches.id });

  if (!batch) {
    throw new Error("Failed to create ingestion batch.");
  }

  const outboxRows = await options.db
    .insert(schema.ingestionOutbox)
    .values(
      options.input.events.map((event) => ({
        organizationId: options.auth.organizationId,
        projectId: options.auth.projectId,
        batchId: batch.id,
        source: options.source,
        payload: event,
        idempotencyKey: event.id,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.ingestionOutbox.id });

  await options.publisher?.publish(
    "openstat:ingestion",
    JSON.stringify({ batchId: batch.id, projectId: options.auth.projectId }),
  );

  return {
    accepted: true as const,
    batchId: batch.id,
    projectId: options.auth.projectId,
    count: outboxRows.length,
    outboxIds: outboxRows.map((row) => row.id),
  };
}

export async function claimIngestionOutbox(options: {
  db: Database["db"];
  workerId: string;
  limit: number;
  lockTtlMs: number;
}) {
  const now = new Date();
  const lockedUntil = new Date(now.valueOf() + options.lockTtlMs);
  const rows = await options.db
    .select()
    .from(schema.ingestionOutbox)
    .where(
      and(
        inArray(schema.ingestionOutbox.status, ["pending", "retryable"]),
        or(
          isNull(schema.ingestionOutbox.lockedUntil),
          lt(schema.ingestionOutbox.lockedUntil, now),
        ),
      ),
    )
    .orderBy(asc(schema.ingestionOutbox.createdAt))
    .limit(options.limit);

  if (rows.length === 0) {
    return [];
  }

  await options.db
    .update(schema.ingestionOutbox)
    .set({
      status: "processing",
      workerId: options.workerId,
      lockedUntil,
      updatedAt: now,
    })
    .where(
      inArray(
        schema.ingestionOutbox.id,
        rows.map((row) => row.id),
      ),
    );

  return rows.map((row) => ({
    ...row,
    status: "processing" as const,
    workerId: options.workerId,
    lockedUntil,
  }));
}

export async function processClaim(options: {
  db: Database["db"];
  rows: Array<typeof schema.ingestionOutbox.$inferSelect>;
  workerId: string;
  maxAttempts: number;
}) {
  let processed = 0;
  let retryable = 0;
  let deadLettered = 0;

  for (const row of options.rows) {
    try {
      const event = parseOutboxEvent(row.payload);
      await projectEvent(options.db, row, event);
      await options.db
        .update(schema.ingestionOutbox)
        .set({
          status: "processed",
          processedAt: new Date(),
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.ingestionOutbox.id, row.id));
      processed += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= options.maxAttempts;

      await options.db
        .update(schema.ingestionOutbox)
        .set({
          attempts,
          status: exhausted ? "dead_lettered" : "retryable",
          deadLetteredAt: exhausted ? new Date() : null,
          lockedUntil: null,
          errorCode: error instanceof IngestionError ? error.code : "PROCESSING_ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown error.",
          updatedAt: new Date(),
        })
        .where(eq(schema.ingestionOutbox.id, row.id));

      if (exhausted) {
        deadLettered += 1;
      } else {
        retryable += 1;
      }
    }
  }

  await updateBatchStatuses(options.db, options.rows.map((row) => row.batchId));

  return { processed, retryable, deadLettered };
}

export async function listEvents(options: {
  db: Database["db"];
  scope: ReadScope;
  list?: WindowedList;
  filters?: {
    agentId?: string;
    eventType?: string;
    model?: string;
    q?: string;
    range?: "24h" | "7d" | "30d";
    source?: EventSource;
    status?: "all" | "errors" | "ok";
    trace?: string;
  };
}) {
  const predicates = [
    eq(schema.events.organizationId, options.scope.organizationId),
    eq(schema.events.projectId, options.scope.projectId),
  ];

  if (options.filters?.agentId) {
    predicates.push(eq(schema.events.agentId, options.filters.agentId));
  }
  if (options.filters?.eventType) {
    predicates.push(eq(schema.events.eventType, options.filters.eventType));
  }
  if (options.filters?.source) {
    predicates.push(eq(schema.events.source, options.filters.source));
  }
  if (options.filters?.trace) {
    predicates.push(eq(schema.events.traceId, options.filters.trace));
  }
  if (options.filters?.status === "errors") {
    predicates.push(eq(schema.events.eventType, "error"));
  }

  return options.db
    .select()
    .from(schema.events)
    .where(and(...predicates))
    .orderBy(desc(schema.events.createdAt), desc(schema.events.id))
    .limit(options.list?.limit ?? 50);
}

export async function listAgents(options: {
  db: Database["db"];
  scope: ReadScope;
  list?: WindowedList;
}) {
  return options.db
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.organizationId, options.scope.organizationId),
        eq(schema.agents.projectId, options.scope.projectId),
      ),
    )
    .orderBy(desc(schema.agents.lastSeenAt), desc(schema.agents.createdAt))
    .limit(options.list?.limit ?? 50);
}

export async function getAgent(options: {
  db: Database["db"];
  scope: ReadScope;
  agentId: string;
}) {
  const [agent] = await options.db
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.id, options.agentId),
        eq(schema.agents.organizationId, options.scope.organizationId),
        eq(schema.agents.projectId, options.scope.projectId),
      ),
    )
    .limit(1);

  return agent;
}

export async function getAgentTimeline(options: {
  db: Database["db"];
  scope: ReadScope;
  agentId: string;
  list?: WindowedList;
}) {
  const agent = await getAgent(options);

  if (!agent) {
    return undefined;
  }

  const events = await listEvents({
    db: options.db,
    scope: options.scope,
    list: options.list,
    filters: { agentId: options.agentId },
  });

  return { agent, events };
}

export async function getEvent(options: {
  db: Database["db"];
  scope: ReadScope;
  eventId: string;
}) {
  const [event] = await options.db
    .select()
    .from(schema.events)
    .where(
      and(
        eq(schema.events.id, options.eventId),
        eq(schema.events.organizationId, options.scope.organizationId),
        eq(schema.events.projectId, options.scope.projectId),
      ),
    )
    .limit(1);

  return event;
}

export async function getEventResources(options: {
  db: Database["db"];
  scope: ReadScope;
  eventId: string;
}) {
  const artifacts = await listEventArtifacts(options);

  return {
    eventId: options.eventId,
    logs: [],
    toolCalls: [],
    errors: [],
    artifacts,
  };
}

export async function listEventArtifacts(options: {
  db: Database["db"];
  scope: ReadScope;
  eventId: string;
}) {
  return options.db
    .select()
    .from(schema.artifacts)
    .where(
      and(
        eq(schema.artifacts.eventId, options.eventId),
        eq(schema.artifacts.projectId, options.scope.projectId),
      ),
    )
    .orderBy(desc(schema.artifacts.createdAt));
}

export async function getOverview(options: {
  db: Database["db"];
  scope: ReadScope;
}) {
  const [agentsTotal] = await options.db
    .select({ value: count() })
    .from(schema.agents)
    .where(eq(schema.agents.projectId, options.scope.projectId));
  const [eventsTotal] = await options.db
    .select({ value: count() })
    .from(schema.events)
    .where(eq(schema.events.projectId, options.scope.projectId));
  const latest = await listEvents({ db: options.db, scope: options.scope, list: { limit: 10 } });

  return {
    agents: {
      total: agentsTotal?.value ?? 0,
      byStatus: await getAgentStatusCounts(options.db, options.scope),
    },
    events: {
      total: eventsTotal?.value ?? 0,
      latest,
    },
  };
}

export async function getAnalyticsSummary(options: {
  db: Database["db"];
  scope: ReadScope;
  range: "24h" | "7d" | "30d";
}) {
  const overview = await getOverview(options);

  return {
    range: options.range,
    generatedAt: new Date(),
    totals: {
      activeApiKeys: 0,
      agents: overview.agents.total,
      apiKeys: 0,
      errors: 0,
      events: overview.events.total,
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
  };
}

export async function listIngestionBatches(options: {
  db: Database["db"];
  scope: ReadScope;
  list?: WindowedList;
  apiKeyId?: string;
}) {
  const predicates = [
    eq(schema.ingestionBatches.organizationId, options.scope.organizationId),
    eq(schema.ingestionBatches.projectId, options.scope.projectId),
  ];

  if (options.apiKeyId) {
    predicates.push(eq(schema.ingestionBatches.apiKeyId, options.apiKeyId));
  }

  return options.db
    .select()
    .from(schema.ingestionBatches)
    .where(and(...predicates))
    .orderBy(desc(schema.ingestionBatches.receivedAt))
    .limit(options.list?.limit ?? 50);
}

export async function getIngestionBatch(options: {
  db: Database["db"];
  scope: ReadScope;
  batchId: string;
}) {
  const [batch] = await options.db
    .select()
    .from(schema.ingestionBatches)
    .where(
      and(
        eq(schema.ingestionBatches.id, options.batchId),
        eq(schema.ingestionBatches.organizationId, options.scope.organizationId),
        eq(schema.ingestionBatches.projectId, options.scope.projectId),
      ),
    )
    .limit(1);

  return batch;
}

export async function listNotifications(options: {
  db: Database["db"];
  scope: ReadScope;
  list?: WindowedList;
}) {
  return options.db
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.organizationId, options.scope.organizationId),
        eq(schema.notifications.projectId, options.scope.projectId),
      ),
    )
    .orderBy(desc(schema.notifications.createdAt))
    .limit(options.list?.limit ?? 50);
}

export async function getNotification(options: {
  db: Database["db"];
  scope: ReadScope;
  notificationId: string;
}) {
  const [notification] = await options.db
    .select()
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.id, options.notificationId),
        eq(schema.notifications.organizationId, options.scope.organizationId),
        eq(schema.notifications.projectId, options.scope.projectId),
      ),
    )
    .limit(1);

  return notification;
}

export async function updateNotificationStatus(options: {
  db: Database["db"];
  scope: ReadScope;
  notificationId: string;
  status: "read" | "archived";
}) {
  const [notification] = await options.db
    .update(schema.notifications)
    .set({
      status: options.status,
      readAt: options.status === "read" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.notifications.id, options.notificationId),
        eq(schema.notifications.organizationId, options.scope.organizationId),
        eq(schema.notifications.projectId, options.scope.projectId),
      ),
    )
    .returning();

  return notification;
}

export async function markNotificationsRead(options: {
  db: Database["db"];
  scope: ReadScope;
}) {
  const updated = await options.db
    .update(schema.notifications)
    .set({ status: "read", readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.notifications.organizationId, options.scope.organizationId),
        eq(schema.notifications.projectId, options.scope.projectId),
        eq(schema.notifications.status, "unread"),
      ),
    )
    .returning({ id: schema.notifications.id });

  return updated.length;
}

export async function sweepAgentHealth(options: {
  db: Database["db"];
  defaultStaleSeconds: number;
  defaultOfflineSeconds: number;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const agents = await options.db.select().from(schema.agents);
  let stale = 0;
  let offline = 0;
  let notificationsCreated = 0;

  for (const agent of agents) {
    if (!agent.lastSeenAt) {
      continue;
    }

    const staleSeconds = agent.expectedCheckInSeconds ?? options.defaultStaleSeconds;
    const offlineSeconds = Math.max(staleSeconds * 2, options.defaultOfflineSeconds);
    const ageSeconds = Math.floor((now.valueOf() - agent.lastSeenAt.valueOf()) / 1000);
    const nextStatus =
      ageSeconds >= offlineSeconds
        ? "offline"
        : ageSeconds >= staleSeconds
          ? "stale"
          : undefined;

    if (!nextStatus || agent.status === nextStatus) {
      continue;
    }

    await options.db
      .update(schema.agents)
      .set({ status: nextStatus, updatedAt: now })
      .where(eq(schema.agents.id, agent.id));

    const [notification] = await options.db
      .insert(schema.notifications)
      .values({
        organizationId: agent.organizationId,
        projectId: agent.projectId,
        agentId: agent.id,
        type: `agent.${nextStatus}`,
        status: "unread",
        title: `${agent.name} is ${nextStatus}`,
        message: "No fresh heartbeat received in the expected interval.",
        data: {},
      })
      .returning({ id: schema.notifications.id });

    if (notification) {
      notificationsCreated += 1;
    }

    if (nextStatus === "stale") {
      stale += 1;
    } else {
      offline += 1;
    }
  }

  return { stale, offline, notificationsCreated };
}

export async function getMetricDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  metricKey: string;
  range: "24h" | "7d" | "30d";
}) {
  return undefined;
}

export async function getEventTypeDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  eventType: string;
  range: "24h" | "7d" | "30d";
}) {
  return undefined;
}

export async function getSourceDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  source: EventSource;
  range: "24h" | "7d" | "30d";
}) {
  return { source: _options.source, totals: { errors: 0, total: 0 }, eventTypes: [], agents: [], sampleEvents: [] };
}

export async function getModelDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  model: string;
  range: "24h" | "7d" | "30d";
}) {
  return undefined;
}

export async function getStatusDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  status: string;
  range: "24h" | "7d" | "30d";
}) {
  return { status: _options.status, kind: "agent", count: 0, agents: [], events: [] };
}

export async function getTraceDetail(_options: {
  db: Database["db"];
  scope: ReadScope;
  traceId: string;
}) {
  return undefined;
}

type WindowedList = {
  cursor?: string;
  limit?: number;
};

async function projectEvent(
  db: Database["db"],
  row: typeof schema.ingestionOutbox.$inferSelect,
  event: IngestEventInput,
) {
  const agent = await upsertAgent(db, row, event);
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
  const [createdEvent] = await db
    .insert(schema.events)
    .values({
      organizationId: row.organizationId,
      projectId: row.projectId,
      agentId: agent?.id,
      batchId: row.batchId,
      outboxId: row.id,
      externalEventId: event.id,
      eventType: event.type,
      source: row.source,
      timestamp,
      traceId: event.trace_id,
      spanId: event.span_id,
      runId: event.run_id,
      data: event.data ?? {},
      metadata: event.metadata ?? {},
      tags: event.tags ?? [],
    })
    .onConflictDoNothing()
    .returning();

  if (!createdEvent) {
    return;
  }

  if (event.type === "heartbeat") {
    const heartbeatStatus = normalizeAgentStatus(getString(event.data?.status));
    await db.insert(schema.heartbeats).values({
      eventId: createdEvent.id,
      agentId: agent?.id,
      status: heartbeatStatus,
    });

    if (agent) {
      await db
        .update(schema.agents)
        .set({
          status: heartbeatStatus,
          lastSeenAt: timestamp,
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, agent.id));
      await markAgentRecoveryNotificationsRead(db, agent.id);
    }
  }

  await maybeProjectLlmUsage(db, createdEvent.id, event);
  await catalogEventProperties(db, row, event);
}

async function upsertAgent(
  db: Database["db"],
  row: typeof schema.ingestionOutbox.$inferSelect,
  event: IngestEventInput,
) {
  if (!event.agent?.id) {
    return undefined;
  }

  const [agent] = await db
    .insert(schema.agents)
    .values({
      organizationId: row.organizationId,
      projectId: row.projectId,
      externalId: event.agent.id,
      name: event.agent.name ?? event.agent.id,
      status: "online",
      lastSeenAt: event.timestamp ? new Date(event.timestamp) : new Date(),
      tags: event.agent.tags ?? [],
      metadata: {},
    })
    .onConflictDoUpdate({
      target: [schema.agents.projectId, schema.agents.externalId],
      set: {
        name: event.agent.name ?? event.agent.id,
        tags: event.agent.tags ?? [],
        lastSeenAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return agent;
}

async function maybeProjectLlmUsage(
  db: Database["db"],
  eventId: string,
  event: IngestEventInput,
) {
  const data = event.data ?? {};
  const metadata = event.metadata ?? {};
  const model = getString(data.model) ?? getString(metadata.model);
  const provider = getString(metadata.provider) ?? getString(data.provider);
  const usage = isRecord(data.usage) ? data.usage : {};
  const inputTokens = getNumber(usage.input_tokens);
  const outputTokens = getNumber(usage.output_tokens);
  const latencyMs = getNumber(data.latency_ms) ?? getNumber(metadata.latency_ms);

  if (!model && !provider && inputTokens === undefined && outputTokens === undefined && latencyMs === undefined) {
    return;
  }

  await db.insert(schema.llmUsage).values({
    eventId,
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined,
    latencyMs,
    status: getString(data.status),
  });
}

async function catalogEventProperties(
  db: Database["db"],
  row: typeof schema.ingestionOutbox.$inferSelect,
  event: IngestEventInput,
) {
  const entries = [
    ...flattenPropertyTypes("data", event.data ?? {}),
    ...flattenPropertyTypes("metadata", event.metadata ?? {}),
  ];

  if (entries.length === 0) {
    return;
  }

  await db
    .insert(schema.eventPropertyCatalog)
    .values(
      entries.map((entry) => ({
        organizationId: row.organizationId,
        projectId: row.projectId,
        eventType: event.type,
        propertyPath: entry.path,
        valueType: entry.type,
        occurrences: 1,
        lastSeenAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: [
        schema.eventPropertyCatalog.projectId,
        schema.eventPropertyCatalog.eventType,
        schema.eventPropertyCatalog.propertyPath,
        schema.eventPropertyCatalog.valueType,
      ],
      set: {
        occurrences: sql`${schema.eventPropertyCatalog.occurrences} + 1`,
        lastSeenAt: new Date(),
      },
    });
}

async function updateBatchStatuses(db: Database["db"], batchIds: string[]) {
  for (const batchId of [...new Set(batchIds)]) {
    const rows = await db
      .select({ status: schema.ingestionOutbox.status })
      .from(schema.ingestionOutbox)
      .where(eq(schema.ingestionOutbox.batchId, batchId));
    const complete = rows.every((row) => row.status === "processed");

    if (complete) {
      await db
        .update(schema.ingestionBatches)
        .set({ status: "processed", processedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.ingestionBatches.id, batchId));
    }
  }
}

async function getAgentStatusCounts(db: Database["db"], scope: ReadScope) {
  const rows = await db
    .select({ status: schema.agents.status, value: count() })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.organizationId, scope.organizationId),
        eq(schema.agents.projectId, scope.projectId),
      ),
    )
    .groupBy(schema.agents.status);
  const result = { online: 0, stale: 0, offline: 0, failing: 0, unknown: 0 };

  for (const row of rows) {
    result[row.status] = row.value;
  }

  return result;
}

async function markAgentRecoveryNotificationsRead(db: Database["db"], agentId: string) {
  await db
    .update(schema.notifications)
    .set({ status: "read", readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.notifications.agentId, agentId),
        eq(schema.notifications.status, "unread"),
        inArray(schema.notifications.type, ["agent.stale", "agent.offline"]),
      ),
    );
}

function parseOutboxEvent(payload: unknown): IngestEventInput {
  if (!isRecord(payload) || typeof payload.type !== "string" || !isRecord(payload.data)) {
    throw new IngestionError("INVALID_OUTBOX_PAYLOAD", "Outbox payload is invalid.");
  }

  return payload as IngestEventInput;
}

function normalizeAgentStatus(status: string | undefined) {
  switch (status) {
    case "online":
    case "stale":
    case "offline":
    case "failing":
    case "unknown":
      return status;
    default:
      return "online";
  }
}

function flattenPropertyTypes(prefix: string, value: Record<string, unknown>) {
  const entries: Array<{ path: string; type: string }> = [];

  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    entries.push({ path, type: getValueType(child) });
    if (isRecord(child)) {
      entries.push(...flattenPropertyTypes(path, child));
    }
  }

  return entries;
}

function getValueType(value: unknown) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
