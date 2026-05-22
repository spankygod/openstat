import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export { schema };

export function createDatabase(
  databaseUrl: string,
  options: { maxConnections?: number } = {},
) {
  const client = postgres(databaseUrl, {
    max: options.maxConnections ?? 10,
  });
  const db = drizzle(client, { schema });

  return {
    client,
    db,
  };
}

export type Database = ReturnType<typeof createDatabase>;
