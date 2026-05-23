import { schema, type Database } from "@openstat/db";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";

import type { ReadScope } from "./index.js";

type AnalyticsRange = "24h" | "7d" | "30d";
type SeriesCountKey =
  | "decisions"
  | "fills"
  | "orders"
  | "pnlSnapshots"
  | "riskRejects";

type MutableSeriesBucket = {
  activeAgentIds: Set<string>;
  activeAgents: number;
  bucket: string;
  decisions: number;
  errors: number;
  events: number;
  failures: number;
  fills: number;
  orders: number;
  pnlSnapshots: number;
  riskRejects: number;
};

export async function getDecisionToTradeSeries(options: {
  db: Database["db"];
  scope: ReadScope;
  range: AnalyticsRange;
  rangeStart: Date;
}) {
  const bucketCount =
    options.range === "24h" ? 24 : options.range === "7d" ? 7 : 30;
  const bucketMs =
    options.range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const bucketStart = getSeriesBucketStart(
    options.range,
    bucketCount,
    bucketMs,
  );
  const buckets = createSeriesBuckets(bucketStart, bucketCount, bucketMs);

  await addEventSeriesCounts({ ...options, bucketMs, bucketStart, buckets });
  await addActiveAgentCounts({ ...options, bucketMs, bucketStart, buckets });
  await addMetricSeriesCounts({ ...options, bucketMs, bucketStart, buckets });

  return buckets.map(({ activeAgentIds, ...bucket }) => ({
    ...bucket,
    activeAgents: activeAgentIds.size,
  }));
}

function createSeriesBuckets(
  bucketStart: Date,
  bucketCount: number,
  bucketMs: number,
) {
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucket = new Date(bucketStart.valueOf() + index * bucketMs);

    return {
      activeAgentIds: new Set<string>(),
      activeAgents: 0,
      bucket: bucket.toISOString(),
      decisions: 0,
      errors: 0,
      events: 0,
      failures: 0,
      fills: 0,
      orders: 0,
      pnlSnapshots: 0,
      riskRejects: 0,
    };
  });
}

async function addEventSeriesCounts(options: {
  buckets: MutableSeriesBucket[];
  bucketMs: number;
  bucketStart: Date;
  db: Database["db"];
  range: AnalyticsRange;
  rangeStart: Date;
  scope: ReadScope;
}) {
  const events = await options.db
    .select({
      agentId: schema.events.agentId,
      eventType: schema.events.eventType,
      timestamp: schema.events.timestamp,
    })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.organizationId, options.scope.organizationId),
        eq(schema.events.projectId, options.scope.projectId),
        gte(schema.events.timestamp, options.rangeStart),
        inArray(schema.events.eventType, [
          "decision",
          "risk_check",
          "order",
          "fill",
          "error",
        ]),
      ),
    );

  for (const event of events) {
    const bucket = options.buckets[getBucketIndex(event.timestamp, options)];

    if (!bucket) {
      continue;
    }

    if (event.eventType === "error") {
      bucket.errors += 1;
      bucket.failures += 1;
    } else {
      bucket.events += 1;
    }

    if (event.agentId) {
      bucket.activeAgentIds.add(event.agentId);
    }
  }
}

async function addActiveAgentCounts(options: {
  buckets: MutableSeriesBucket[];
  bucketMs: number;
  bucketStart: Date;
  db: Database["db"];
  range: AnalyticsRange;
  rangeStart: Date;
  scope: ReadScope;
}) {
  const activeAgentEvents = await options.db
    .select({
      agentId: schema.events.agentId,
      timestamp: schema.events.timestamp,
    })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.organizationId, options.scope.organizationId),
        eq(schema.events.projectId, options.scope.projectId),
        gte(schema.events.timestamp, options.rangeStart),
        isNotNull(schema.events.agentId),
      ),
    );

  for (const event of activeAgentEvents) {
    if (!event.agentId) {
      continue;
    }

    const bucket = options.buckets[getBucketIndex(event.timestamp, options)];

    if (bucket) {
      bucket.activeAgentIds.add(event.agentId);
    }
  }
}

async function addMetricSeriesCounts(options: {
  buckets: MutableSeriesBucket[];
  bucketMs: number;
  bucketStart: Date;
  db: Database["db"];
  range: AnalyticsRange;
  rangeStart: Date;
  scope: ReadScope;
}) {
  addSeriesCounts({
    ...options,
    rows: await options.db
      .select({ timestamp: schema.tradingDecisions.decidedAt })
      .from(schema.tradingDecisions)
      .where(
        and(
          eq(
            schema.tradingDecisions.organizationId,
            options.scope.organizationId,
          ),
          eq(schema.tradingDecisions.projectId, options.scope.projectId),
          gte(schema.tradingDecisions.decidedAt, options.rangeStart),
        ),
      ),
    key: "decisions",
  });
  addSeriesCounts({
    ...options,
    rows: await options.db
      .select({ timestamp: schema.orders.createdAt })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.projectId, options.scope.projectId),
          gte(schema.orders.createdAt, options.rangeStart),
        ),
      ),
    key: "orders",
  });
  addSeriesCounts({
    ...options,
    rows: await options.db
      .select({ timestamp: schema.fills.filledAt })
      .from(schema.fills)
      .where(
        and(
          eq(schema.fills.projectId, options.scope.projectId),
          gte(schema.fills.filledAt, options.rangeStart),
        ),
      ),
    key: "fills",
  });
  addSeriesCounts({
    ...options,
    rows: await options.db
      .select({ timestamp: schema.riskChecks.checkedAt })
      .from(schema.riskChecks)
      .where(
        and(
          eq(schema.riskChecks.projectId, options.scope.projectId),
          eq(schema.riskChecks.result, "rejected"),
          gte(schema.riskChecks.checkedAt, options.rangeStart),
        ),
      ),
    key: "riskRejects",
  });
  addSeriesCounts({
    ...options,
    rows: await options.db
      .select({ timestamp: schema.pnlSnapshots.snapshotAt })
      .from(schema.pnlSnapshots)
      .where(
        and(
          eq(schema.pnlSnapshots.projectId, options.scope.projectId),
          gte(schema.pnlSnapshots.snapshotAt, options.rangeStart),
        ),
      ),
    key: "pnlSnapshots",
  });
}

function addSeriesCounts(options: {
  buckets: MutableSeriesBucket[];
  bucketMs: number;
  bucketStart: Date;
  key: SeriesCountKey;
  range: AnalyticsRange;
  rows: Array<{ timestamp: Date }>;
}) {
  for (const row of options.rows) {
    const bucket = options.buckets[getBucketIndex(row.timestamp, options)];

    if (bucket) {
      bucket[options.key] += 1;
    }
  }
}

function getBucketIndex(
  timestamp: Date,
  options: { bucketMs: number; bucketStart: Date; range: AnalyticsRange },
) {
  return Math.floor(
    (floorBucket(timestamp, options.range).valueOf() -
      options.bucketStart.valueOf()) /
      options.bucketMs,
  );
}

function floorBucket(date: Date, range: AnalyticsRange) {
  const bucket = new Date(date);

  if (range === "24h") {
    bucket.setMinutes(0, 0, 0);
  } else {
    bucket.setHours(0, 0, 0, 0);
  }

  return bucket;
}

function getSeriesBucketStart(
  range: AnalyticsRange,
  bucketCount: number,
  bucketMs: number,
) {
  return new Date(
    floorBucket(new Date(), range).valueOf() - (bucketCount - 1) * bucketMs,
  );
}
