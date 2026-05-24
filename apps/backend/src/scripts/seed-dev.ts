import { generateApiKey } from "@openstat/auth";
import { createDatabase, schema } from "@openstat/db";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";

const database = createDatabase(env.databaseUrl);

const seedEmail = env.demoEmail;
const seedUserName = "OpenStat Demo";
const seedSlug =
  seedEmail
    .split("@")[0]
    ?.replace(/[^a-z0-9]+/giu, "-")
    .toLowerCase() ?? "openstat";
const seedMarker = "openstat-demo";
const demoDays = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const DEV_ORG = {
  name: "OpenStat Demo",
  slug: `${seedSlug}-workspace`,
};

const DEV_PROJECT = {
  name: "Agent Operations",
  slug: "agent-operations",
};

const DEV_API_KEY_NAME = "Demo ingestion key";

const agentSeeds = [
  {
    externalId: "customer-support-v2",
    name: "Customer Support Agent",
    status: "online",
    tags: ["support", "production"],
  },
  {
    externalId: "data-ingest-v1",
    name: "Data Ingestion Agent",
    status: "online",
    tags: ["pipeline", "etl"],
  },
  {
    externalId: "email-triage-v1",
    name: "Email Triage Agent",
    status: "stale",
    tags: ["ops", "inbox"],
  },
  {
    externalId: "order-processor-v2",
    name: "Order Processing Agent",
    status: "failing",
    tags: ["commerce", "critical"],
  },
  {
    externalId: "analytics-collector-v1",
    name: "Analytics Collector",
    status: "offline",
    tags: ["analytics"],
  },
  {
    externalId: "research-scout-v1",
    name: "Research Scout",
    status: "unknown",
    tags: ["research"],
  },
  {
    externalId: "momentum-trader-v1",
    name: "Momentum Trading Agent",
    status: "online",
    tags: ["trading", "momentum"],
  },
  {
    externalId: "risk-guardian-v1",
    name: "Risk Guardian",
    status: "online",
    tags: ["trading", "risk"],
  },
] as const;

const modelSeeds = [
  {
    model: "gpt-4o",
    agentExternalId: "customer-support-v2",
    dailyInvocations: 7,
    latencyMs: [812, 724, 930, 641, 788, 856],
    inputTokens: [920, 1140, 860, 1280],
    outputTokens: [210, 340, 180, 420],
    errorEvery: 23,
  },
  {
    model: "claude-3-5-sonnet",
    agentExternalId: "data-ingest-v1",
    dailyInvocations: 6,
    latencyMs: [623, 690, 558, 712, 665],
    inputTokens: [1420, 1680, 1190, 1510],
    outputTokens: [290, 260, 330, 310],
    errorEvery: 0,
  },
  {
    model: "gpt-4o-mini",
    agentExternalId: "email-triage-v1",
    dailyInvocations: 8,
    latencyMs: [412, 388, 455, 436, 501],
    inputTokens: [320, 410, 365, 470],
    outputTokens: [92, 118, 84, 136],
    errorEvery: 31,
  },
  {
    model: "llama-3-70b",
    agentExternalId: "order-processor-v2",
    dailyInvocations: 5,
    latencyMs: [1210, 1188, 1324, 1406, 1270],
    inputTokens: [760, 840, 940, 1010],
    outputTokens: [190, 210, 245, 260],
    errorEvery: 11,
  },
  {
    model: "mistral-large",
    agentExternalId: "research-scout-v1",
    dailyInvocations: 4,
    latencyMs: [732, 780, 801, 755],
    inputTokens: [1880, 2040, 2210, 1730],
    outputTokens: [520, 610, 570, 460],
    errorEvery: 0,
  },
] as const;

const tradingStrategies = [
  {
    strategy: "nyse-open-momentum",
    agentExternalId: "momentum-trader-v1",
    symbols: ["AAPL", "NVDA", "MSFT", "AMD"],
  },
  {
    strategy: "crypto-volatility-reversion",
    agentExternalId: "momentum-trader-v1",
    symbols: ["BTC-USD", "ETH-USD", "SOL-USD"],
  },
  {
    strategy: "risk-overlay",
    agentExternalId: "risk-guardian-v1",
    symbols: ["SPY", "QQQ", "TSLA"],
  },
] as const;

async function main() {
  const user = await ensureUser();
  const workspace = await ensureWorkspaceForUser(user.id);

  const apiKey = await ensureApiKey({
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
    userId: user.id,
  });

  await clearDemoData(workspace.project.id);
  const agents = await seedAgents({
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });
  const batches = await seedIngestionBatches({
    apiKeyId: apiKey.id,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });

  const eventSummary = await seedEvents({
    agents,
    batches,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });
  const tradingSummary = await seedTradingData({
    agents,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });
  const notificationCount = await seedNotifications({
    agents,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });

  console.log("Seed complete.");
  console.log(`User: ${user.email} (${user.id})`);
  console.log(
    `Organization: ${workspace.organization.name} (${workspace.organization.id})`,
  );
  console.log(`Project: ${workspace.project.name} (${workspace.project.id})`);
  console.log(
    `Demo range: ${demoDays} days, ${agents.size} agents, ${batches.length} batches, ${eventSummary.events} events, ${eventSummary.llmRows} LLM usage rows, ${tradingSummary.runs} runs, ${tradingSummary.orders} orders, ${tradingSummary.fills} fills, ${notificationCount} notifications.`,
  );
  if (apiKey.created) {
    console.log("API key, shown once:");
    console.log(apiKey.key);
  } else {
    console.log(`API key already exists: ${apiKey.prefix}`);
  }
}

async function ensureUser() {
  const [existingUser] = await database.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, seedEmail))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  const [user] = await database.db
    .insert(schema.user)
    .values({
      id: `user_${randomUUID()}`,
      name: seedUserName,
      email: seedEmail,
      emailVerified: true,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create seed user.");
  }

  return user;
}

async function ensureWorkspaceForUser(userId: string) {
  const organization = await ensureOrganization();
  const project = await ensureDefaultProject(organization.id);

  await ensureMembership({
    organizationId: organization.id,
    userId,
  });

  return {
    organization,
    project,
  };
}

async function ensureOrganization() {
  const [existingOrganization] = await database.db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, DEV_ORG.slug))
    .limit(1);

  if (existingOrganization) {
    const [organization] = await database.db
      .update(schema.organizations)
      .set({
        name: DEV_ORG.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, existingOrganization.id))
      .returning();

    return organization ?? existingOrganization;
  }

  const [organization] = await database.db
    .insert(schema.organizations)
    .values(DEV_ORG)
    .returning();

  if (!organization) {
    throw new Error("Failed to create dev organization.");
  }

  return organization;
}

async function ensureDefaultProject(organizationId: string) {
  const [existingProject] = await database.db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.organizationId, organizationId),
        eq(schema.projects.isDefault, true),
      ),
    )
    .limit(1);

  if (existingProject) {
    return existingProject;
  }

  const [project] = await database.db
    .insert(schema.projects)
    .values({
      organizationId,
      ...DEV_PROJECT,
      isDefault: true,
    })
    .returning();

  if (!project) {
    throw new Error("Failed to create dev project.");
  }

  return project;
}

async function ensureMembership(options: {
  organizationId: string;
  userId: string;
}) {
  const [existingMembership] = await database.db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.organizationId, options.organizationId),
        eq(schema.memberships.userId, options.userId),
      ),
    )
    .limit(1);

  if (existingMembership) {
    return existingMembership;
  }

  const [membership] = await database.db
    .insert(schema.memberships)
    .values({
      organizationId: options.organizationId,
      userId: options.userId,
      role: "owner",
    })
    .returning();

  if (!membership) {
    throw new Error("Failed to create seed membership.");
  }

  return membership;
}

async function ensureApiKey(options: {
  organizationId: string;
  projectId: string;
  userId: string;
}) {
  const [existingApiKey] = await database.db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.organizationId, options.organizationId),
        eq(schema.apiKeys.projectId, options.projectId),
        eq(schema.apiKeys.name, DEV_API_KEY_NAME),
      ),
    )
    .limit(1);

  if (existingApiKey) {
    return {
      created: false,
      id: existingApiKey.id,
      key: undefined,
      prefix: existingApiKey.prefix,
    };
  }

  const apiKey = generateApiKey();
  const [createdApiKey] = await database.db
    .insert(schema.apiKeys)
    .values({
      organizationId: options.organizationId,
      projectId: options.projectId,
      name: DEV_API_KEY_NAME,
      prefix: apiKey.prefix,
      secretHash: apiKey.secretHash,
      createdByUserId: options.userId,
    })
    .returning({ id: schema.apiKeys.id });

  if (!createdApiKey) {
    throw new Error("Failed to create demo API key.");
  }

  return {
    created: true,
    id: createdApiKey.id,
    key: apiKey.key,
    prefix: apiKey.prefix,
  };
}

async function clearDemoData(projectId: string) {
  await database.db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.projectId, projectId),
        sql`${schema.notifications.data}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.artifacts)
    .where(
      and(
        eq(schema.artifacts.projectId, projectId),
        sql`${schema.artifacts.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.otelLogs)
    .where(
      and(
        eq(schema.otelLogs.projectId, projectId),
        sql`${schema.otelLogs.attributes}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.otelMetrics)
    .where(
      and(
        eq(schema.otelMetrics.projectId, projectId),
        sql`${schema.otelMetrics.attributes}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.otelSpans)
    .where(
      and(
        eq(schema.otelSpans.projectId, projectId),
        sql`${schema.otelSpans.attributes}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.fills)
    .where(
      and(
        eq(schema.fills.projectId, projectId),
        sql`${schema.fills.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.orders)
    .where(
      and(
        eq(schema.orders.projectId, projectId),
        sql`${schema.orders.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.riskChecks)
    .where(
      and(
        eq(schema.riskChecks.projectId, projectId),
        sql`${schema.riskChecks.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.tradingDecisions)
    .where(
      and(
        eq(schema.tradingDecisions.projectId, projectId),
        sql`${schema.tradingDecisions.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.projectId, projectId),
        sql`${schema.agentRuns.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.positions)
    .where(
      and(
        eq(schema.positions.projectId, projectId),
        sql`${schema.positions.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.pnlSnapshots)
    .where(
      and(
        eq(schema.pnlSnapshots.projectId, projectId),
        sql`${schema.pnlSnapshots.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.ingestionBatches)
    .where(
      and(
        eq(schema.ingestionBatches.projectId, projectId),
        sql`${schema.ingestionBatches.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.events)
    .where(
      and(
        eq(schema.events.projectId, projectId),
        sql`${schema.events.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
  await database.db
    .delete(schema.eventPropertyCatalog)
    .where(eq(schema.eventPropertyCatalog.projectId, projectId));
}

async function seedAgents(options: {
  organizationId: string;
  projectId: string;
}) {
  const now = new Date();
  const agents = new Map<string, { id: string; name: string }>();

  for (const [index, agentSeed] of agentSeeds.entries()) {
    const [agent] = await database.db
      .insert(schema.agents)
      .values({
        organizationId: options.organizationId,
        projectId: options.projectId,
        externalId: agentSeed.externalId,
        name: agentSeed.name,
        status: agentSeed.status,
        mode: index % 2 === 0 ? "long_running" : "scheduled",
        expectedCheckInSeconds: index % 3 === 0 ? 120 : 300,
        lastSeenAt: new Date(now.valueOf() - index * 17 * 60 * 1000),
        tags: [...agentSeed.tags],
        metadata: {
          seed: seedMarker,
          owner: seedEmail,
          version: `v${index + 1}`,
        },
      })
      .onConflictDoUpdate({
        target: [schema.agents.projectId, schema.agents.externalId],
        set: {
          name: agentSeed.name,
          status: agentSeed.status,
          tags: [...agentSeed.tags],
          lastSeenAt: new Date(now.valueOf() - index * 17 * 60 * 1000),
          metadata: {
            seed: seedMarker,
            owner: seedEmail,
            version: `v${index + 1}`,
          },
          updatedAt: now,
        },
      })
      .returning({
        id: schema.agents.id,
        name: schema.agents.name,
      });

    if (!agent) {
      throw new Error(`Failed to seed agent ${agentSeed.externalId}.`);
    }

    agents.set(agentSeed.externalId, agent);
  }

  return agents;
}

async function seedIngestionBatches(options: {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
}) {
  const rows: Array<typeof schema.ingestionBatches.$inferInsert> = [];

  for (let day = demoDays - 1; day >= 0; day -= 1) {
    const receivedAt = atDay(day, 9, 10);
    const rejectedCount = day % 10 === 0 ? 2 : day % 7 === 0 ? 1 : 0;
    const eventCount = 44 + (day % 6) * 3;

    rows.push({
      apiKeyId: options.apiKeyId,
      organizationId: options.organizationId,
      projectId: options.projectId,
      source: day % 5 === 0 ? "http" : "sdk",
      status: rejectedCount > 0 ? "partially_processed" : "processed",
      eventCount,
      acceptedCount: eventCount - rejectedCount,
      rejectedCount,
      requestId: `seed-request-${day}`,
      receivedAt,
      processedAt: new Date(receivedAt.valueOf() + 18_000),
      metadata: {
        seed: seedMarker,
        day,
        environment: "demo",
      },
      createdAt: receivedAt,
      updatedAt: new Date(receivedAt.valueOf() + 18_000),
    });
  }

  return database.db
    .insert(schema.ingestionBatches)
    .values(rows)
    .returning({
      day: sql<number>`(${schema.ingestionBatches.metadata}->>'day')::int`,
      id: schema.ingestionBatches.id,
    });
}

async function seedEvents(options: {
  agents: Map<string, { id: string; name: string }>;
  batches: Array<{ day: number; id: string }>;
  organizationId: string;
  projectId: string;
}) {
  const batchByDay = new Map(
    options.batches.map((batch) => [batch.day, batch.id]),
  );
  const events: Array<typeof schema.events.$inferInsert> = [];

  for (let day = demoDays - 1; day >= 0; day -= 1) {
    for (const [modelIndex, modelSeed] of modelSeeds.entries()) {
      const agent = options.agents.get(modelSeed.agentExternalId);

      if (!agent) {
        continue;
      }

      for (let index = 0; index < modelSeed.dailyInvocations; index += 1) {
        const sequence = day * 100 + modelIndex * 10 + index;
        const timestamp = atDay(day, 10 + modelIndex * 2, 5 + index * 6);
        const latencyMs =
          pick(modelSeed.latencyMs, day + index) + (day % 6) * 12;
        const inputTokens = pick(modelSeed.inputTokens, day + index) + day * 7;
        const outputTokens =
          pick(modelSeed.outputTokens, day + index) + (index % 3) * 18;
        const isError =
          modelSeed.errorEvery > 0 && sequence % modelSeed.errorEvery === 0;
        const provider = getProvider(modelSeed.model);

        events.push({
          organizationId: options.organizationId,
          projectId: options.projectId,
          agentId: agent.id,
          batchId: batchByDay.get(day),
          externalEventId: `seed-model-${modelSeed.model}-${day}-${index}`,
          eventType: isError ? "error" : "completion",
          source: day % 5 === 0 ? "http" : "sdk",
          timestamp,
          traceId: `trace-${modelSeed.model}-${day}-${Math.floor(index / 2)}`,
          spanId: `span-${modelSeed.model}-${day}-${index}`,
          runId: `run-${modelSeed.model}-${day}`,
          data: {
            seed: seedMarker,
            status: isError ? "failed" : "ok",
            code: isError ? "MODEL_TIMEOUT" : undefined,
            latency_ms: latencyMs,
            model: modelSeed.model,
            provider,
            summary: `${agent.name} used ${modelSeed.model}`,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            },
          },
          metadata: {
            seed: seedMarker,
            model: modelSeed.model,
            latency_ms: latencyMs,
            provider,
            demo_day: day,
          },
          tags: ["demo", "model", provider],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    for (const [index, agentSeed] of agentSeeds.entries()) {
      const agent = options.agents.get(agentSeed.externalId);

      if (!agent) {
        continue;
      }

      const timestamp = atDay(day, 8 + (index % 6) * 2, 2 + index * 3);
      const status =
        day === 0
          ? agentSeed.status
          : day % 13 === 0 && index % 3 === 0
            ? "stale"
            : day % 17 === 0 && index % 4 === 0
              ? "offline"
              : "online";

      events.push({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        batchId: batchByDay.get(day),
        externalEventId: `seed-heartbeat-${agentSeed.externalId}-${day}`,
        eventType: "heartbeat",
        source: "sdk",
        timestamp,
        traceId: `trace-heartbeat-${agentSeed.externalId}-${day}`,
        spanId: `span-heartbeat-${agentSeed.externalId}-${day}`,
        runId: `heartbeat-${agentSeed.externalId}-${day}`,
        data: {
          seed: seedMarker,
          status,
          summary: `${agentSeed.name} heartbeat`,
        },
        metadata: {
          seed: seedMarker,
          runtime: index % 2 === 0 ? "node" : "python",
          demo_day: day,
        },
        tags: ["demo", "heartbeat"],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  const createdEvents = await insertReturningInChunks(events, 500, (chunk) =>
    database.db.insert(schema.events).values(chunk).returning({
      agentId: schema.events.agentId,
      data: schema.events.data,
      eventType: schema.events.eventType,
      id: schema.events.id,
      metadata: schema.events.metadata,
      timestamp: schema.events.timestamp,
    }),
  );

  const llmRows: Array<typeof schema.llmUsage.$inferInsert> = [];
  const heartbeatRows: Array<typeof schema.heartbeats.$inferInsert> = [];

  for (const event of createdEvents) {
    if (event.eventType === "heartbeat") {
      heartbeatRows.push({
        eventId: event.id,
        agentId: event.agentId,
        status: getAgentStatus(event.data.status),
        receivedAt: event.timestamp,
      });
      continue;
    }

    const usage = isRecord(event.data.usage) ? event.data.usage : {};
    const inputTokens = getNumber(usage.input_tokens);
    const outputTokens = getNumber(usage.output_tokens);

    llmRows.push({
      eventId: event.id,
      provider: getString(event.metadata.provider),
      model: getString(event.metadata.model),
      inputTokens,
      outputTokens,
      totalTokens:
        inputTokens !== undefined && outputTokens !== undefined
          ? inputTokens + outputTokens
          : undefined,
      latencyMs: getNumber(event.metadata.latency_ms),
      status: getString(event.data.status),
    });
  }

  if (llmRows.length > 0) {
    await insertInChunks(llmRows, 500, (chunk) =>
      database.db.insert(schema.llmUsage).values(chunk),
    );
  }
  if (heartbeatRows.length > 0) {
    await insertInChunks(heartbeatRows, 500, (chunk) =>
      database.db.insert(schema.heartbeats).values(chunk),
    );
  }

  return {
    events: createdEvents.length,
    llmRows: llmRows.length,
  };
}

async function seedTradingData(options: {
  agents: Map<string, { id: string; name: string }>;
  organizationId: string;
  projectId: string;
}) {
  let runs = 0;
  let orders = 0;
  let fills = 0;

  for (let day = demoDays - 1; day >= 0; day -= 1) {
    for (const [strategyIndex, strategySeed] of tradingStrategies.entries()) {
      const agent = options.agents.get(strategySeed.agentExternalId);

      if (!agent) {
        continue;
      }

      const symbol = pick(strategySeed.symbols, day);
      const startedAt = atDay(day, 9 + strategyIndex * 2, 30);
      const externalRunId = `seed-trade-run-${strategySeed.strategy}-${day}`;
      const side = (day + strategyIndex) % 2 === 0 ? "buy" : "sell";
      const action = side === "buy" ? "enter_long" : "trim_position";
      const riskRejected = (day + strategyIndex) % 9 === 0;
      const quantity = 10 + ((day + strategyIndex) % 8) * 5;
      const price = getDemoPrice(symbol, day, strategyIndex);
      const metadata = {
        seed: seedMarker,
        demo_day: day,
        market_session: strategyIndex === 1 ? "24h" : "regular",
      };
      const [run] = await database.db
        .insert(schema.agentRuns)
        .values({
          organizationId: options.organizationId,
          projectId: options.projectId,
          agentId: agent.id,
          externalRunId,
          strategy: strategySeed.strategy,
          status: riskRejected ? "completed_with_rejection" : "completed",
          startedAt,
          endedAt: new Date(startedAt.valueOf() + 34 * 60 * 1000),
          metadata,
          createdAt: startedAt,
          updatedAt: new Date(startedAt.valueOf() + 34 * 60 * 1000),
        })
        .returning({ id: schema.agentRuns.id });

      if (!run) {
        throw new Error(`Failed to create demo run ${externalRunId}.`);
      }

      runs += 1;

      const decisionEvent = await insertEvent({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        externalEventId: `seed-decision-${strategySeed.strategy}-${day}`,
        eventType: "decision",
        source: "sdk",
        timestamp: startedAt,
        traceId: `trace-trade-${strategySeed.strategy}-${day}`,
        spanId: `span-decision-${strategySeed.strategy}-${day}`,
        runId: externalRunId,
        data: {
          seed: seedMarker,
          action,
          confidence: 68 + ((day + strategyIndex) % 24),
          rationale_summary: `${symbol} signal aligned with ${strategySeed.strategy}.`,
          strategy: strategySeed.strategy,
          symbol,
        },
        metadata,
        tags: ["demo", "trading", "decision"],
        createdAt: startedAt,
        updatedAt: startedAt,
      });
      const [decision] = await database.db
        .insert(schema.tradingDecisions)
        .values({
          eventId: decisionEvent.id,
          runId: run.id,
          organizationId: options.organizationId,
          projectId: options.projectId,
          agentId: agent.id,
          strategy: strategySeed.strategy,
          symbol,
          action,
          confidence: 68 + ((day + strategyIndex) % 24),
          rationaleSummary: `${symbol} signal aligned with ${strategySeed.strategy}.`,
          metadata,
          decidedAt: startedAt,
        })
        .returning({ id: schema.tradingDecisions.id });

      if (!decision) {
        throw new Error(`Failed to create demo decision ${externalRunId}.`);
      }

      const checkedAt = new Date(startedAt.valueOf() + 4 * 60 * 1000);
      const riskEvent = await insertEvent({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        externalEventId: `seed-risk-${strategySeed.strategy}-${day}`,
        eventType: "risk_check",
        source: "sdk",
        timestamp: checkedAt,
        traceId: `trace-trade-${strategySeed.strategy}-${day}`,
        spanId: `span-risk-${strategySeed.strategy}-${day}`,
        runId: externalRunId,
        data: {
          seed: seedMarker,
          result: riskRejected ? "rejected" : "approved",
          reason: riskRejected
            ? "Position size exceeds volatility budget."
            : "Within risk envelope.",
          strategy: strategySeed.strategy,
          symbol,
        },
        metadata,
        tags: ["demo", "trading", "risk"],
        createdAt: checkedAt,
        updatedAt: checkedAt,
      });
      await database.db.insert(schema.riskChecks).values({
        eventId: riskEvent.id,
        decisionId: decision.id,
        projectId: options.projectId,
        result: riskRejected ? "rejected" : "approved",
        reason: riskRejected
          ? "Position size exceeds volatility budget."
          : "Within risk envelope.",
        metadata,
        checkedAt,
      });

      if (riskRejected) {
        continue;
      }

      const submittedAt = new Date(startedAt.valueOf() + 8 * 60 * 1000);
      const orderEvent = await insertEvent({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        externalEventId: `seed-order-${strategySeed.strategy}-${day}`,
        eventType: "order",
        source: "sdk",
        timestamp: submittedAt,
        traceId: `trace-trade-${strategySeed.strategy}-${day}`,
        spanId: `span-order-${strategySeed.strategy}-${day}`,
        runId: externalRunId,
        data: {
          seed: seedMarker,
          order_id: `seed-order-${strategySeed.strategy}-${day}`,
          order_type: "limit",
          price: price.toFixed(2),
          quantity: quantity.toString(),
          side,
          status: day % 14 === 0 ? "partially_filled" : "filled",
          strategy: strategySeed.strategy,
          symbol,
          venue: getVenue(symbol),
        },
        metadata,
        tags: ["demo", "trading", "order"],
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });
      const [order] = await database.db
        .insert(schema.orders)
        .values({
          eventId: orderEvent.id,
          decisionId: decision.id,
          projectId: options.projectId,
          externalOrderId: `seed-order-${strategySeed.strategy}-${day}`,
          strategy: strategySeed.strategy,
          symbol,
          venue: getVenue(symbol),
          side,
          orderType: "limit",
          quantity: quantity.toString(),
          price: price.toFixed(2),
          status: day % 14 === 0 ? "partially_filled" : "filled",
          submittedAt,
          metadata,
          createdAt: submittedAt,
          updatedAt: submittedAt,
        })
        .returning({ id: schema.orders.id });

      if (!order) {
        throw new Error(`Failed to create demo order ${externalRunId}.`);
      }

      orders += 1;

      const filledAt = new Date(startedAt.valueOf() + 12 * 60 * 1000);
      const fillQuantity = day % 14 === 0 ? quantity / 2 : quantity;
      const fillEvent = await insertEvent({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        externalEventId: `seed-fill-${strategySeed.strategy}-${day}`,
        eventType: "fill",
        source: "sdk",
        timestamp: filledAt,
        traceId: `trace-trade-${strategySeed.strategy}-${day}`,
        spanId: `span-fill-${strategySeed.strategy}-${day}`,
        runId: externalRunId,
        data: {
          seed: seedMarker,
          fill_id: `seed-fill-${strategySeed.strategy}-${day}`,
          order_id: `seed-order-${strategySeed.strategy}-${day}`,
          price: (price + (side === "buy" ? 0.04 : -0.03)).toFixed(2),
          quantity: fillQuantity.toString(),
          side,
          strategy: strategySeed.strategy,
          symbol,
          venue: getVenue(symbol),
        },
        metadata,
        tags: ["demo", "trading", "fill"],
        createdAt: filledAt,
        updatedAt: filledAt,
      });
      await database.db.insert(schema.fills).values({
        eventId: fillEvent.id,
        orderId: order.id,
        projectId: options.projectId,
        externalFillId: `seed-fill-${strategySeed.strategy}-${day}`,
        symbol,
        venue: getVenue(symbol),
        side,
        quantity: fillQuantity.toString(),
        price: (price + (side === "buy" ? 0.04 : -0.03)).toFixed(2),
        fee: (fillQuantity * price * 0.0008).toFixed(2),
        filledAt,
        metadata,
      });
      fills += 1;

      await database.db
        .insert(schema.positions)
        .values({
          projectId: options.projectId,
          strategy: strategySeed.strategy,
          symbol,
          quantity: (side === "buy" ? fillQuantity : -fillQuantity).toString(),
          averagePrice: price.toFixed(2),
          metadata,
          createdAt: filledAt,
          updatedAt: filledAt,
        })
        .onConflictDoUpdate({
          target: [
            schema.positions.projectId,
            schema.positions.strategy,
            schema.positions.symbol,
          ],
          set: {
            quantity: (side === "buy"
              ? fillQuantity
              : -fillQuantity
            ).toString(),
            averagePrice: price.toFixed(2),
            metadata,
            updatedAt: filledAt,
          },
        });
    }

    for (const strategySeed of tradingStrategies) {
      await database.db.insert(schema.pnlSnapshots).values({
        projectId: options.projectId,
        strategy: strategySeed.strategy,
        symbol: null,
        realizedPnl: (
          4200 -
          day * 47 +
          strategySeed.strategy.length * 12
        ).toFixed(2),
        unrealizedPnl: (680 - day * 19).toFixed(2),
        equity: (100_000 + (demoDays - day) * 1380).toFixed(2),
        snapshotAt: atDay(day, 16, 5),
        metadata: {
          seed: seedMarker,
          demo_day: day,
          cadence: "daily-close",
        },
      });
    }
  }

  return { fills, orders, runs };
}

async function seedNotifications(options: {
  agents: Map<string, { id: string; name: string }>;
  organizationId: string;
  projectId: string;
}) {
  const orderProcessor = options.agents.get("order-processor-v2");
  const emailTriage = options.agents.get("email-triage-v1");
  const analytics = options.agents.get("analytics-collector-v1");
  const riskGuardian = options.agents.get("risk-guardian-v1");
  const momentumTrader = options.agents.get("momentum-trader-v1");
  const notifications: Array<typeof schema.notifications.$inferInsert> = [
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: orderProcessor?.id,
      type: "agent.error_rate",
      status: "unread",
      title: "Error rate is above 1% for Order Processing Agent",
      message: "llama-3-70b returned failed completions during checkout flow.",
      data: {
        seed: seedMarker,
        severity: "high",
        errorRate: "8.4%",
      },
      createdAt: atDay(0, 11, 48),
      updatedAt: atDay(0, 11, 48),
    },
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: emailTriage?.id,
      type: "agent.stale",
      status: "unread",
      title: "Email Triage Agent has stale check-ins",
      message: "No fresh heartbeat received in the expected interval.",
      data: {
        seed: seedMarker,
        severity: "medium",
      },
      createdAt: atDay(0, 12, 15),
      updatedAt: atDay(0, 12, 15),
    },
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: riskGuardian?.id,
      type: "risk.rejections",
      status: "unread",
      title: "Risk rejections are elevated",
      message: "Volatility guard rejected several oversized orders this week.",
      data: {
        seed: seedMarker,
        severity: "high",
      },
      createdAt: atDay(1, 15, 12),
      updatedAt: atDay(1, 15, 12),
    },
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: momentumTrader?.id,
      type: "trading.pnl_drawdown",
      status: "read",
      title: "Momentum strategy recovered from drawdown",
      message: "Realized PnL recovered above the 7-day moving average.",
      data: {
        seed: seedMarker,
        severity: "low",
      },
      readAt: atDay(2, 17, 20),
      createdAt: atDay(2, 16, 40),
      updatedAt: atDay(2, 17, 20),
    },
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: analytics?.id,
      type: "agent.offline",
      status: "read",
      title: "Analytics Collector went offline",
      message: "The collector missed its scheduled backfill window.",
      data: {
        seed: seedMarker,
        severity: "low",
      },
      readAt: atDay(4, 10, 18),
      createdAt: atDay(4, 9, 55),
      updatedAt: atDay(4, 10, 18),
    },
  ];

  await database.db.insert(schema.notifications).values(notifications);

  return notifications.length;
}

async function insertEvent(values: typeof schema.events.$inferInsert) {
  const [event] = await database.db
    .insert(schema.events)
    .values(values)
    .returning({
      id: schema.events.id,
    });

  if (!event) {
    throw new Error(`Failed to create demo event ${values.externalEventId}.`);
  }

  return event;
}

async function insertInChunks<T>(
  rows: T[],
  size: number,
  insert: (rows: T[]) => Promise<unknown>,
) {
  for (let index = 0; index < rows.length; index += size) {
    await insert(rows.slice(index, index + size));
  }
}

async function insertReturningInChunks<T, R>(
  rows: T[],
  size: number,
  insert: (rows: T[]) => Promise<R[]>,
) {
  const created: R[] = [];

  for (let index = 0; index < rows.length; index += size) {
    created.push(...(await insert(rows.slice(index, index + size))));
  }

  return created;
}

function atDay(day: number, hour: number, minute: number) {
  const date = new Date(Date.now() - day * millisecondsPerDay);

  date.setHours(hour, minute, (day * 17 + minute) % 60, 0);

  return date;
}

function getProvider(model: string) {
  if (model.startsWith("gpt")) {
    return "openai";
  }

  if (model.startsWith("claude")) {
    return "anthropic";
  }

  if (model.startsWith("llama")) {
    return "meta";
  }

  return "mistral";
}

function getVenue(symbol: string) {
  return symbol.endsWith("-USD") ? "coinbase" : "paper-broker";
}

function getDemoPrice(symbol: string, day: number, index: number) {
  const basePrices: Record<string, number> = {
    AAPL: 190,
    AMD: 155,
    "BTC-USD": 68_000,
    "ETH-USD": 3_600,
    MSFT: 420,
    NVDA: 880,
    QQQ: 440,
    SOL: 162,
    "SOL-USD": 162,
    SPY: 510,
    TSLA: 178,
  };

  return (basePrices[symbol] ?? 100) + (demoDays - day) * 0.9 + index * 1.7;
}

function pick<T>(values: readonly T[], index: number) {
  const value = values[index % values.length];

  if (value === undefined) {
    throw new Error("Demo seed was configured with an empty value list.");
  }

  return value;
}

function getAgentStatus(value: unknown) {
  switch (value) {
    case "online":
    case "stale":
    case "offline":
    case "failing":
    case "unknown":
      return value;
    default:
      return "online";
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

try {
  await main();
} finally {
  await database.client.end();
}
