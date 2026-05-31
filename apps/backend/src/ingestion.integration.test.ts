import { generateApiKey } from "@openstat/auth";
import { createDatabase, schema } from "@openstat/db";
import {
  acceptIngestionBatch,
  claimIngestionOutbox,
  getAnalyticsSummary,
  getOverview,
  listEvents,
  listNotifications,
  processClaim,
  sweepAgentHealth,
} from "@openstat/ingestion";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const integrationDatabaseUrl = process.env.OPENSTAT_INTEGRATION_DATABASE_URL;
const describeIntegration = integrationDatabaseUrl ? describe : describe.skip;

describeIntegration("ingestion outbox integration", () => {
  const insertedOrganizationIds: string[] = [];
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      return;
    }

    database = createDatabase(integrationDatabaseUrl, { maxConnections: 4 });
  });

  afterEach(async () => {
    for (const organizationId of insertedOrganizationIds.splice(0)) {
      await database.db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, organizationId));
    }
  });

  afterAll(async () => {
    await database?.client.end();
  });

  it("accepts, claims, processes, projects, and reads an event", async () => {
    const fixture = await createFixture(database);
    insertedOrganizationIds.push(fixture.organizationId);

    const publishedSignals: Array<{ channel: string; message: string }> = [];
    const accepted = await acceptIngestionBatch({
      db: database.db,
      auth: {
        apiKeyId: fixture.apiKeyId,
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      input: {
        events: [
          {
            id: `event_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-integration",
              name: "Integration Agent",
              tags: ["integration"],
            },
            type: "heartbeat",
            data: {
              latency_ms: 128,
              model: "gpt-4o-mini",
              status: "online",
              usage: {
                input_tokens: 12,
                output_tokens: 8,
              },
            },
            trace_id: "trace_integration",
            span_id: "span_integration",
            run_id: "run_integration",
            tags: ["heartbeat"],
            metadata: {
              provider: "openai",
              runtime: "vitest",
            },
          },
        ],
      },
      source: "http",
      requestId: "request_integration",
      publisher: {
        async publish(channel, message) {
          publishedSignals.push({ channel, message });
        },
      },
    });

    expect(accepted.accepted).toBe(true);
    expect(accepted.count).toBe(1);
    expect(accepted.outboxIds).toHaveLength(1);
    expect(publishedSignals).toHaveLength(1);

    const [pendingOutbox] = await database.db
      .select({
        id: schema.ingestionOutbox.id,
        status: schema.ingestionOutbox.status,
      })
      .from(schema.ingestionOutbox)
      .where(eq(schema.ingestionOutbox.id, accepted.outboxIds[0] ?? ""));

    expect(pendingOutbox?.status).toBe("pending");

    const claimed = await claimIngestionOutbox({
      db: database.db,
      workerId: "worker_integration",
      limit: 10,
      lockTtlMs: 60_000,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe(accepted.outboxIds[0]);

    const processed = await processClaim({
      db: database.db,
      rows: claimed,
      workerId: "worker_integration",
      maxAttempts: 3,
    });

    expect(processed).toEqual({
      processed: 1,
      retryable: 0,
      deadLettered: 0,
    });

    const [processedOutbox] = await database.db
      .select({
        status: schema.ingestionOutbox.status,
        processedAt: schema.ingestionOutbox.processedAt,
      })
      .from(schema.ingestionOutbox)
      .where(eq(schema.ingestionOutbox.id, accepted.outboxIds[0] ?? ""));

    expect(processedOutbox?.status).toBe("processed");
    expect(processedOutbox?.processedAt).toBeInstanceOf(Date);

    const [batch] = await database.db
      .select({
        status: schema.ingestionBatches.status,
        processedAt: schema.ingestionBatches.processedAt,
      })
      .from(schema.ingestionBatches)
      .where(eq(schema.ingestionBatches.id, accepted.batchId));

    expect(batch?.status).toBe("processed");
    expect(batch?.processedAt).toBeInstanceOf(Date);

    const [event] = await database.db
      .select({
        id: schema.events.id,
        outboxId: schema.events.outboxId,
        eventType: schema.events.eventType,
        traceId: schema.events.traceId,
        spanId: schema.events.spanId,
        runId: schema.events.runId,
      })
      .from(schema.events)
      .where(eq(schema.events.outboxId, accepted.outboxIds[0] ?? ""));

    expect(event).toEqual(
      expect.objectContaining({
        outboxId: accepted.outboxIds[0],
        eventType: "heartbeat",
        traceId: "trace_integration",
        spanId: "span_integration",
        runId: "run_integration",
      }),
    );

    const [heartbeat] = await database.db
      .select({
        eventId: schema.heartbeats.eventId,
      })
      .from(schema.heartbeats)
      .where(eq(schema.heartbeats.eventId, event?.id ?? ""));

    expect(heartbeat?.eventId).toBe(event?.id);

    const catalogRows = await database.db
      .select({
        propertyPath: schema.eventPropertyCatalog.propertyPath,
        valueType: schema.eventPropertyCatalog.valueType,
        occurrences: schema.eventPropertyCatalog.occurrences,
      })
      .from(schema.eventPropertyCatalog)
      .where(
        and(
          eq(schema.eventPropertyCatalog.organizationId, fixture.organizationId),
          eq(schema.eventPropertyCatalog.projectId, fixture.projectId),
          eq(schema.eventPropertyCatalog.eventType, "heartbeat"),
          inArray(schema.eventPropertyCatalog.propertyPath, [
            "data.status",
            "data.model",
            "metadata.runtime",
          ]),
        ),
      );

    expect(catalogRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrences: 1,
          propertyPath: "data.status",
          valueType: "string",
        }),
        expect.objectContaining({
          occurrences: 1,
          propertyPath: "data.model",
          valueType: "string",
        }),
        expect.objectContaining({
          occurrences: 1,
          propertyPath: "metadata.runtime",
          valueType: "string",
        }),
      ]),
    );

    const [llmUsage] = await database.db
      .select({
        eventId: schema.llmUsage.eventId,
        inputTokens: schema.llmUsage.inputTokens,
        latencyMs: schema.llmUsage.latencyMs,
        model: schema.llmUsage.model,
        outputTokens: schema.llmUsage.outputTokens,
        provider: schema.llmUsage.provider,
        status: schema.llmUsage.status,
      })
      .from(schema.llmUsage)
      .where(eq(schema.llmUsage.eventId, event?.id ?? ""));

    expect(llmUsage).toEqual({
      eventId: event?.id,
      inputTokens: 12,
      latencyMs: 128,
      model: "gpt-4o-mini",
      outputTokens: 8,
      provider: "openai",
      status: "online",
    });

    const events = await listEvents({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(event?.id);

    const overview = await getOverview({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
    });

    expect(overview.agents.total).toBe(1);
    expect(overview.events.total).toBe(1);
    expect(overview.events.latest[0]?.id).toBe(event?.id);
  });

  it("creates one unread failing notification for repeated agent failures", async () => {
    const fixture = await createFixture(database);
    insertedOrganizationIds.push(fixture.organizationId);

    const firstAccepted = await acceptIngestionBatch({
      db: database.db,
      auth: {
        apiKeyId: fixture.apiKeyId,
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      input: {
        events: [createFailureEvent("first")],
      },
      source: "http",
      requestId: "request_failure_first",
    });
    const secondAccepted = await acceptIngestionBatch({
      db: database.db,
      auth: {
        apiKeyId: fixture.apiKeyId,
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      input: {
        events: [createFailureEvent("second")],
      },
      source: "http",
      requestId: "request_failure_second",
    });

    const claimed = await claimIngestionOutbox({
      db: database.db,
      workerId: "worker_failure",
      limit: 10,
      lockTtlMs: 60_000,
    });

    expect(claimed.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        firstAccepted.outboxIds[0],
        secondAccepted.outboxIds[0],
      ]),
    );

    await processClaim({
      db: database.db,
      rows: claimed,
      workerId: "worker_failure",
      maxAttempts: 3,
    });

    const notifications = await listNotifications({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual(
      expect.objectContaining({
        type: "agent.failing",
        status: "unread",
        title: "Failing Integration Agent is failing",
      }),
    );
  });

  it("projects native trading events into decision, order, fill, position, and PnL tables", async () => {
    const fixture = await createFixture(database);
    insertedOrganizationIds.push(fixture.organizationId);
    const timestamp = Date.parse("2026-05-13T12:30:00.000Z");

    await acceptIngestionBatch({
      db: database.db,
      auth: {
        apiKeyId: fixture.apiKeyId,
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      input: {
        events: [
          {
            id: `event_decision_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-trader-integration",
              name: "Trader Integration Agent",
            },
            type: "decision",
            run_id: "run_trading_integration",
            timestamp,
            data: {
              strategy: "breakout",
              symbol: "BTC-USD",
              venue: "paper",
              action: "enter_long",
              confidence: 84,
              rationale_summary: "Momentum and risk budget aligned.",
            },
            metadata: {
              market: "crypto",
            },
          },
          {
            id: `event_order_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-trader-integration",
              name: "Trader Integration Agent",
            },
            type: "order",
            run_id: "run_trading_integration",
            timestamp: timestamp + 1_000,
            data: {
              order_id: "order_integration_1",
              strategy: "breakout",
              symbol: "BTC-USD",
              venue: "paper",
              side: "buy",
              order_type: "limit",
              quantity: "0.10",
              price: "62500.00",
              status: "submitted",
            },
          },
          {
            id: `event_fill_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-trader-integration",
              name: "Trader Integration Agent",
            },
            type: "fill",
            run_id: "run_trading_integration",
            timestamp: timestamp + 2_000,
            data: {
              fill_id: "fill_integration_1",
              order_id: "order_integration_1",
              strategy: "breakout",
              symbol: "BTC-USD",
              venue: "paper",
              side: "buy",
              quantity: "0.10",
              price: "62495.50",
              fee: "1.25",
            },
          },
          {
            id: `event_position_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-trader-integration",
              name: "Trader Integration Agent",
            },
            type: "position",
            timestamp: timestamp + 3_000,
            data: {
              strategy: "breakout",
              symbol: "BTC-USD",
              venue: "paper",
              quantity: "0.10",
              average_price: "62495.50",
            },
          },
          {
            id: `event_pnl_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "agent-trader-integration",
              name: "Trader Integration Agent",
            },
            type: "pnl_snapshot",
            timestamp: timestamp + 4_000,
            data: {
              strategy: "breakout",
              symbol: "BTC-USD",
              realized_pnl: "0",
              unrealized_pnl: "41.20",
              equity: "10041.20",
            },
          },
        ],
      },
      source: "http",
      requestId: "request_trading_projection",
    });

    const claimed = await claimIngestionOutbox({
      db: database.db,
      workerId: "worker_trading",
      limit: 10,
      lockTtlMs: 60_000,
    });

    const processed = await processClaim({
      db: database.db,
      rows: claimed,
      workerId: "worker_trading",
      maxAttempts: 3,
    });

    expect(processed).toEqual({
      processed: 5,
      retryable: 0,
      deadLettered: 0,
    });

    const [run] = await database.db
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.projectId, fixture.projectId))
      .limit(1);
    const [decision] = await database.db
      .select()
      .from(schema.tradingDecisions)
      .where(eq(schema.tradingDecisions.projectId, fixture.projectId))
      .limit(1);
    const [order] = await database.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.projectId, fixture.projectId))
      .limit(1);
    const [fill] = await database.db
      .select()
      .from(schema.fills)
      .where(eq(schema.fills.projectId, fixture.projectId))
      .limit(1);
    const [position] = await database.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.projectId, fixture.projectId))
      .limit(1);
    const [pnlSnapshot] = await database.db
      .select()
      .from(schema.pnlSnapshots)
      .where(eq(schema.pnlSnapshots.projectId, fixture.projectId))
      .limit(1);

    expect(run).toEqual(
      expect.objectContaining({
        externalRunId: "run_trading_integration",
        strategy: "breakout",
      }),
    );
    expect(decision).toEqual(
      expect.objectContaining({
        action: "enter_long",
        confidence: 84,
        symbol: "BTC-USD",
      }),
    );
    expect(order).toEqual(
      expect.objectContaining({
        externalOrderId: "order_integration_1",
        side: "buy",
        status: "submitted",
      }),
    );
    expect(fill).toEqual(
      expect.objectContaining({
        externalFillId: "fill_integration_1",
        quantity: "0.10",
        price: "62495.50",
      }),
    );
    expect(position).toEqual(
      expect.objectContaining({
        symbol: "BTC-USD",
        quantity: "0.10",
        averagePrice: "62495.50",
      }),
    );
    expect(pnlSnapshot).toEqual(
      expect.objectContaining({
        realizedPnl: "0",
        unrealizedPnl: "41.20",
        equity: "10041.20",
      }),
    );
    const analytics = await getAnalyticsSummary({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      range: "30d",
    });

    expect(analytics.totals).toMatchObject({
      pnlRealized: 0,
      pnlTotal: 41.2,
      pnlUnrealized: 41.2,
    });
  });

  it("transitions stale and offline agents with deduped notifications", async () => {
    const fixture = await createFixture(database);
    insertedOrganizationIds.push(fixture.organizationId);
    const now = new Date("2026-05-13T12:00:00.000Z");

    const [staleAgent, offlineAgent] = await database.db
      .insert(schema.agents)
      .values([
        {
          organizationId: fixture.organizationId,
          projectId: fixture.projectId,
          externalId: "stale-health-agent",
          name: "Stale Health Agent",
          status: "online",
          expectedCheckInSeconds: 60,
          lastSeenAt: new Date(now.valueOf() - 70_000),
          metadata: {},
          tags: [],
        },
        {
          organizationId: fixture.organizationId,
          projectId: fixture.projectId,
          externalId: "offline-health-agent",
          name: "Offline Health Agent",
          status: "stale",
          expectedCheckInSeconds: 60,
          lastSeenAt: new Date(now.valueOf() - 130_000),
          metadata: {},
          tags: [],
        },
      ])
      .returning({
        id: schema.agents.id,
        externalId: schema.agents.externalId,
      });

    const firstSweep = await sweepAgentHealth({
      db: database.db,
      defaultStaleSeconds: 180,
      defaultOfflineSeconds: 600,
      now,
    });
    const secondSweep = await sweepAgentHealth({
      db: database.db,
      defaultStaleSeconds: 180,
      defaultOfflineSeconds: 600,
      now,
    });

    expect(firstSweep).toEqual({
      stale: 1,
      offline: 1,
      notificationsCreated: 2,
    });
    expect(secondSweep).toEqual({
      stale: 0,
      offline: 0,
      notificationsCreated: 0,
    });

    const agents = await database.db
      .select({
        externalId: schema.agents.externalId,
        status: schema.agents.status,
      })
      .from(schema.agents)
      .where(
        inArray(schema.agents.id, [
          staleAgent?.id ?? "",
          offlineAgent?.id ?? "",
        ]),
      );

    expect(agents).toEqual(
      expect.arrayContaining([
        { externalId: "stale-health-agent", status: "stale" },
        { externalId: "offline-health-agent", status: "offline" },
      ]),
    );

    const notifications = await listNotifications({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
    });

    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: staleAgent?.id,
          type: "agent.stale",
          status: "unread",
          title: "Stale Health Agent is stale",
        }),
        expect.objectContaining({
          agentId: offlineAgent?.id,
          type: "agent.offline",
          status: "unread",
          title: "Offline Health Agent is offline",
        }),
      ]),
    );

    await acceptIngestionBatch({
      db: database.db,
      auth: {
        apiKeyId: fixture.apiKeyId,
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
      input: {
        events: [
          {
            id: `event_recovery_${crypto.randomUUID()}`,
            schema_version: 1,
            agent: {
              id: "stale-health-agent",
              name: "Stale Health Agent",
            },
            type: "heartbeat",
            data: {
              status: "online",
            },
          },
        ],
      },
      source: "http",
      requestId: "request_health_recovery",
    });

    const recoveryRows = await claimIngestionOutbox({
      db: database.db,
      workerId: "worker_health_recovery",
      limit: 10,
      lockTtlMs: 60_000,
    });

    await processClaim({
      db: database.db,
      rows: recoveryRows,
      workerId: "worker_health_recovery",
      maxAttempts: 3,
    });

    const recoveredNotifications = await listNotifications({
      db: database.db,
      scope: {
        organizationId: fixture.organizationId,
        projectId: fixture.projectId,
      },
    });
    const staleNotification = recoveredNotifications.find(
      (notification) => notification.agentId === staleAgent?.id,
    );
    const [recoveredAgent] = await database.db
      .select({ status: schema.agents.status })
      .from(schema.agents)
      .where(eq(schema.agents.id, staleAgent?.id ?? ""))
      .limit(1);

    expect(staleNotification?.status).toBe("read");
    expect(staleNotification?.readAt).toBeInstanceOf(Date);
    expect(recoveredAgent?.status).toBe("online");
  });
});

function createFailureEvent(label: string) {
  return {
    id: `event_${label}_${crypto.randomUUID()}`,
    schema_version: 1 as const,
    agent: {
      id: "agent-failure-integration",
      name: "Failing Integration Agent",
    },
    type: "error" as const,
    data: {
      code: "WORKER_FAILURE",
      message: `${label} failure`,
    },
    tags: ["failure"],
    metadata: {
      runtime: "vitest",
    },
  };
}

async function createFixture(database: ReturnType<typeof createDatabase>) {
  const slug = `integration-${crypto.randomUUID()}`;
  const [organization] = await database.db
    .insert(schema.organizations)
    .values({
      name: "Integration Organization",
      slug,
    })
    .returning({ id: schema.organizations.id });

  if (!organization) {
    throw new Error("Failed to create integration organization.");
  }

  const [project] = await database.db
    .insert(schema.projects)
    .values({
      organizationId: organization.id,
      name: "Integration Project",
      slug: "default",
      isDefault: true,
    })
    .returning({ id: schema.projects.id });

  if (!project) {
    throw new Error("Failed to create integration project.");
  }

  const apiKey = generateApiKey();
  const [createdApiKey] = await database.db
    .insert(schema.apiKeys)
    .values({
      organizationId: organization.id,
      projectId: project.id,
      name: "Integration API key",
      prefix: apiKey.prefix,
      secretHash: apiKey.secretHash,
    })
    .returning({ id: schema.apiKeys.id });

  if (!createdApiKey) {
    throw new Error("Failed to create integration API key.");
  }

  return {
    organizationId: organization.id,
    projectId: project.id,
    apiKeyId: createdApiKey.id,
  };
}
