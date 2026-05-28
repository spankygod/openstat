import { sweepRetention } from "@openstat/ingestion";

import { env } from "../config/env.js";
import { database } from "../context.js";

try {
  const result = await sweepRetention({
    db: database.db,
    derivedRetentionDays: env.derivedRetentionDays,
    rawRetentionDays: env.rawRetentionDays,
  });

  console.info(result, "Retention sweep completed");
} finally {
  await database.client.end();
}
