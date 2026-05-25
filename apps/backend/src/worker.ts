import {
  claimIngestionOutbox,
  createProjectUpdatedMessage,
  DEFAULT_PROJECT_CACHE_DOMAINS,
  invalidateProjectReadCaches,
  processClaim,
  REDIS_CHANNELS,
  sweepAgentHealth,
  type IngestionSignalSubscription,
} from "@openstat/ingestion";

import { env } from "./config/env.js";
import { database, ingestionSignalClient } from "./context.js";

const workerId = `worker_${crypto.randomUUID()}`;
let shuttingDown = false;
let pendingWakeup = false;
let wakeupResolver: (() => void) | undefined;

process.on("SIGINT", () => {
  shuttingDown = true;
  wakeWorker();
});
process.on("SIGTERM", () => {
  shuttingDown = true;
  wakeWorker();
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
        await client.publish(
          REDIS_CHANNELS.projectUpdated,
          JSON.stringify(message),
        );
      } catch (error) {
        console.warn(
          {
            error,
            projectId,
            workerId,
          },
          "Redis project update publish failed; cache TTLs remain active",
        );
      }

      try {
        const invalidated = await invalidateProjectReadCaches({
          client,
          domains: message.domains,
          projectId,
        });

        console.info(
          {
            deleted: invalidated.deleted,
            projectId,
            workerId,
          },
          "Invalidated Redis project read caches",
        );
      } catch (error) {
        console.warn(
          {
            error,
            projectId,
            workerId,
          },
          "Redis project cache invalidation failed; TTL fallback remains active",
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
      projectId?: unknown;
      type?: unknown;
    };

    if (parsed.type !== "ingestion.outbox.created") {
      return undefined;
    }

    return {
      batchId: typeof parsed.batchId === "string" ? parsed.batchId : undefined,
      count: typeof parsed.count === "number" ? parsed.count : undefined,
      projectId:
        typeof parsed.projectId === "string" ? parsed.projectId : undefined,
    };
  } catch {
    return undefined;
  }
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
