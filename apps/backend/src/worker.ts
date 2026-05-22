import {
  claimIngestionOutbox,
  processClaim,
  sweepAgentHealth,
} from "@openstat/ingestion";

import { env } from "./config/env.js";
import { database } from "./context.js";

const workerId = `worker_${crypto.randomUUID()}`;
let shuttingDown = false;

process.on("SIGINT", () => {
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

console.info({ workerId }, "OpenStat ingestion worker started");

while (!shuttingDown) {
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
  }

  await sweepAgentHealth({
    db: database.db,
    defaultStaleSeconds: env.defaultAgentStaleSeconds,
    defaultOfflineSeconds: env.defaultAgentOfflineSeconds,
  });

  await sleep(env.ingestionWorkerPollMs);
}

await database.client.end();
console.info({ workerId }, "OpenStat ingestion worker stopped");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
