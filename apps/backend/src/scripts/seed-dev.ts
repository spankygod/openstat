import { generateApiKey } from "@openstat/auth";
import { createDatabase, schema } from "@openstat/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";

const database = createDatabase(env.databaseUrl);

const seedEmail = "demo@openstat.local";
const seedUserName = "OpenStat Demo";
const seedSlug = seedEmail
  .split("@")[0]
  ?.replace(/[^a-z0-9]+/giu, "-")
  .toLowerCase() ?? "openstat";
const seedMarker = "openstat-demo";

const DEV_ORG = {
  name: "OpenStat",
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
] as const;

const modelSeeds = [
  {
    model: "gpt-4o",
    agentExternalId: "customer-support-v2",
    invocations: 5,
    latencyMs: [812, 724, 930, 641, 788],
    errorEvery: 0,
  },
  {
    model: "claude-3-5-sonnet",
    agentExternalId: "data-ingest-v1",
    invocations: 4,
    latencyMs: [623, 690, 558, 712],
    errorEvery: 0,
  },
  {
    model: "gpt-4o-mini",
    agentExternalId: "email-triage-v1",
    invocations: 4,
    latencyMs: [412, 388, 455, 436],
    errorEvery: 0,
  },
  {
    model: "llama-3-70b",
    agentExternalId: "order-processor-v2",
    invocations: 3,
    latencyMs: [1210, 1188, 1324],
    errorEvery: 3,
  },
  {
    model: "mistral-large",
    agentExternalId: "research-scout-v1",
    invocations: 2,
    latencyMs: [732, 780],
    errorEvery: 0,
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

  await seedEvents({
    agents,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });

  await seedNotifications({
    agents,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
  });

  console.log("Seed complete.");
  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Organization: ${workspace.organization.name} (${workspace.organization.id})`);
  console.log(`Project: ${workspace.project.name} (${workspace.project.id})`);
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
  const [existingMembership] = await database.db
    .select({
      organizationId: schema.memberships.organizationId,
    })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .orderBy(asc(schema.memberships.createdAt))
    .limit(1);

  if (existingMembership) {
    const [organization] = await database.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, existingMembership.organizationId))
      .limit(1);

    if (!organization) {
      throw new Error("Seed membership points to a missing organization.");
    }

    const project = await ensureDefaultProject(organization.id);

    return {
      organization,
      project,
    };
  }

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
    return existingOrganization;
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
      key: undefined,
      prefix: existingApiKey.prefix,
    };
  }

  const apiKey = generateApiKey();

  await database.db.insert(schema.apiKeys).values({
    organizationId: options.organizationId,
    projectId: options.projectId,
    name: DEV_API_KEY_NAME,
    prefix: apiKey.prefix,
    secretHash: apiKey.secretHash,
    createdByUserId: options.userId,
  });

  return {
    created: true,
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
    .delete(schema.events)
    .where(
      and(
        eq(schema.events.projectId, projectId),
        sql`${schema.events.metadata}->>'seed' = ${seedMarker}`,
      ),
    );
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
        expectedCheckInSeconds: 180,
        lastSeenAt: new Date(now.valueOf() - index * 11 * 60 * 1000),
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

async function seedEvents(options: {
  agents: Map<string, { id: string; name: string }>;
  organizationId: string;
  projectId: string;
}) {
  const now = Date.now();
  const events: Array<typeof schema.events.$inferInsert> = [];

  for (const [modelIndex, modelSeed] of modelSeeds.entries()) {
    const agent = options.agents.get(modelSeed.agentExternalId);

    if (!agent) {
      continue;
    }

    for (let index = 0; index < modelSeed.invocations; index += 1) {
      const timestamp = new Date(now - (modelIndex * 5 + index) * 7 * 60 * 1000);
      const isError =
        modelSeed.errorEvery > 0 && (index + 1) % modelSeed.errorEvery === 0;

      events.push({
        organizationId: options.organizationId,
        projectId: options.projectId,
        agentId: agent.id,
        externalEventId: `seed-model-${modelSeed.model}-${index}`,
        eventType: isError ? "error" : "completion",
        source: "sdk",
        timestamp,
        traceId: `trace-${modelSeed.model}-${index}`,
        spanId: `span-${modelSeed.model}-${index}`,
        runId: `run-${modelSeed.model}`,
        data: {
          seed: seedMarker,
          status: isError ? "failed" : "ok",
          latency_ms: modelSeed.latencyMs[index % modelSeed.latencyMs.length],
          summary: `${agent.name} used ${modelSeed.model}`,
        },
        metadata: {
          seed: seedMarker,
          model: modelSeed.model,
          latency_ms: modelSeed.latencyMs[index % modelSeed.latencyMs.length],
          provider: getProvider(modelSeed.model),
        },
        tags: ["demo", "model"],
        createdAt: timestamp,
      });
    }
  }

  for (const [index, agentSeed] of agentSeeds.entries()) {
    const agent = options.agents.get(agentSeed.externalId);

    if (!agent) {
      continue;
    }

    const timestamp = new Date(now - (index + 25) * 9 * 60 * 1000);

    events.push({
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: agent.id,
      externalEventId: `seed-heartbeat-${agentSeed.externalId}`,
      eventType: "heartbeat",
      source: "sdk",
      timestamp,
      data: {
        seed: seedMarker,
        status: agentSeed.status,
        summary: `${agentSeed.name} heartbeat`,
      },
      metadata: {
        seed: seedMarker,
        runtime: "node",
      },
      tags: ["demo", "heartbeat"],
      createdAt: timestamp,
    });
  }

  if (events.length > 0) {
    await database.db.insert(schema.events).values(events);
  }
}

async function seedNotifications(options: {
  agents: Map<string, { id: string; name: string }>;
  organizationId: string;
  projectId: string;
}) {
  const orderProcessor = options.agents.get("order-processor-v2");
  const emailTriage = options.agents.get("email-triage-v1");
  const analytics = options.agents.get("analytics-collector-v1");

  await database.db.insert(schema.notifications).values([
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
        errorRate: "33.3%",
      },
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
    },
    {
      organizationId: options.organizationId,
      projectId: options.projectId,
      agentId: analytics?.id,
      type: "agent.offline",
      status: "read",
      title: "Analytics Collector went offline",
      message: "The collector has not reported telemetry recently.",
      data: {
        seed: seedMarker,
        severity: "low",
      },
      readAt: new Date(),
    },
  ]);
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

try {
  await main();
} finally {
  await database.client.end();
}
