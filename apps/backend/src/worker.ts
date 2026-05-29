import "./sentry.js";

import {
  claimIngestionOutbox,
  createProjectUpdatedMessage,
  DEFAULT_PROJECT_CACHE_DOMAINS,
  invalidateProjectReadCaches,
  processClaim,
  REDIS_CHANNELS,
  sweepRetention,
  sweepAgentHealth,
  type IngestionSignalSubscription,
} from "@openstat/ingestion";

import { env } from "./config/env.js";
import { database, ingestionSignalClient } from "./context.js";
import {
  recordProjectInvalidation,
  recordProjectInvalidationError,
  recordProjectUpdatePublish,
  recordProjectUpdatePublishError,
  recordWakeupInvalidMessage,
  recordWakeupMessage,
} from "./redis-telemetry.js";
import { captureException, flushSentry } from "./sentry.js";

const workerId = `worker_${crypto.randomUUID()}`;
let shuttingDown = false;
let pendingWakeup = false;
let wakeupResolver: (() => void) | undefined;
let lastRetentionSweepAt = 0;

process.on("SIGINT", () => {
  shuttingDown = true;
  wakeWorker();
});
process.on("SIGTERM", () => {
  shuttingDown = true;
  wakeWorker();
});
process.on("uncaughtException", (error) => {
  captureException(error, {
    worker: {
      id: workerId,
    },
  });
  void flushSentry().finally(() => {
    console.error({ error, workerId }, "OpenStat ingestion worker crashed");
    process.exit(1);
  });
});
process.on("unhandledRejection", (error) => {
  captureException(error, {
    worker: {
      id: workerId,
    },
  });
});

console.info({ workerId }, "OpenStat ingestion worker started");

const signalSubscription = await subscribeToRedisWakeups();

while (!shuttingDown) {
  await runWorkerPass();

  if (!shuttingDown) {
    await waitForNextPoll(env.ingestionWorkerPollMs);
  }
}

await signalSubscription?.close();
await ingestionSignalClient?.close();
await database.client.end();
console.info({ workerId }, "OpenStat ingestion worker stopped");

async function runWorkerPass() {
  const rows = await claimIngestionOutbox({
    db: database.db,
    workerId,
    limit: env.ingestionWorkerBatchSize,
    lockTtlMs: env.ingestionLockTtlSeconds * 1_000,
  });

  if (rows.length > 0) {
    const result = await processClaim({
      db: database.db,
      rows,
      workerId,
      maxAttempts: env.ingestionWorkerMaxAttempts,
    });

    console.info({ workerId, ...result }, "Processed ingestion outbox rows");

    if (result.processed > 0) {
      await publishProjectUpdatesAndInvalidateCaches(rows);
    }
  }

  await sweepAgentHealth({
    db: database.db,
    defaultStaleSeconds: env.defaultAgentStaleSeconds,
    defaultOfflineSeconds: env.defaultAgentOfflineSeconds,
  });

  await runRetentionSweepIfDue();
}

async function runRetentionSweepIfDue() {
  if (!env.retentionSweepEnabled) {
    return;
  }

  const now = Date.now();

  if (now - lastRetentionSweepAt < env.retentionSweepIntervalMs) {
    return;
  }

  lastRetentionSweepAt = now;

  try {
    const result = await sweepRetention({
      db: database.db,
      derivedRetentionDays: env.derivedRetentionDays,
      rawRetentionDays: env.rawRetentionDays,
    });

    console.info({ workerId, ...result }, "Swept retained telemetry");
  } catch (error) {
    captureException(error, {
      worker: {
        id: workerId,
        task: "retention_sweep",
      },
    });
    console.warn({ error, workerId }, "Retention sweep failed");
  }
}

async function publishProjectUpdatesAndInvalidateCaches(
  rows: Awaited<ReturnType<typeof claimIngestionOutbox>>,
) {
  if (!ingestionSignalClient) {
    return;
  }

  const client = ingestionSignalClient;
  const projectIds = new Set(rows.map((row) => row.projectId));

  await Promise.all(
    [...projectIds].map(async (projectId) => {
      const message = createProjectUpdatedMessage({
        domains: [...DEFAULT_PROJECT_CACHE_DOMAINS],
        projectId,
      });

      try {
        const invalidated = await invalidateProjectReadCaches({
          client,
          domains: message.domains,
          projectId,
        });
        recordProjectInvalidation(invalidated.deleted);

        console.info(
          {
            deleted: invalidated.deleted,
            projectId,
            workerId,
          },
          "Invalidated Redis project read caches",
        );
      } catch (error) {
        recordProjectInvalidationError();
        console.warn(
          {
            error,
            projectId,
            workerId,
          },
          "Redis project cache invalidation failed; TTL fallback remains active",
        );
      }

      try {
        await client.publish(
          REDIS_CHANNELS.projectUpdated,
          JSON.stringify(message),
        );
        recordProjectUpdatePublish();
      } catch (error) {
        recordProjectUpdatePublishError();
        console.warn(
          {
            error,
            projectId,
            workerId,
          },
          "Redis project update publish failed; cache TTLs remain active",
        );
      }
    }),
  );
}

async function subscribeToRedisWakeups(): Promise<
  IngestionSignalSubscription | undefined
> {
  if (!ingestionSignalClient) {
    return undefined;
  }

  try {
    return await ingestionSignalClient.subscribe(
      REDIS_CHANNELS.ingestion,
      (message) => {
        const signal = parseWakeupMessage(message);

        if (!signal) {
          recordWakeupInvalidMessage();
        } else {
          recordWakeupMessage(signal.latencyMs);
        }

        console.info(
          {
            workerId,
            batchId: signal?.batchId,
            count: signal?.count,
            projectId: signal?.projectId,
          },
          "Received Redis ingestion wake-up signal",
        );
        wakeWorker();
      },
    );
  } catch (error) {
    console.warn(
      {
        error,
        workerId,
      },
      "Redis ingestion wake-up subscription failed; polling remains active",
    );
    return undefined;
  }
}

function parseWakeupMessage(message: string) {
  try {
    const parsed = JSON.parse(message) as {
      batchId?: unknown;
      count?: unknown;
      createdAt?: unknown;
      projectId?: unknown;
      type?: unknown;
    };

    if (parsed.type !== "ingestion.outbox.created") {
      return undefined;
    }

    return {
      batchId: typeof parsed.batchId === "string" ? parsed.batchId : undefined,
      count: typeof parsed.count === "number" ? parsed.count : undefined,
      latencyMs:
        typeof parsed.createdAt === "string"
          ? getLatencyMs(parsed.createdAt)
          : undefined,
      projectId:
        typeof parsed.projectId === "string" ? parsed.projectId : undefined,
    };
  } catch {
    return undefined;
  }
}

function getLatencyMs(createdAt: string) {
  const timestamp = new Date(createdAt).valueOf();

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return Math.max(0, Date.now() - timestamp);
}

function wakeWorker() {
  pendingWakeup = true;
  wakeupResolver?.();
  wakeupResolver = undefined;
}

function waitForNextPoll(ms: number) {
  if (pendingWakeup) {
    pendingWakeup = false;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      wakeupResolver = undefined;
      resolve();
    }, ms);

    wakeupResolver = () => {
      clearTimeout(timeout);
      pendingWakeup = false;
      resolve();
    };
  });
}
