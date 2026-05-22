import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

try {
  await app.listen({
    host: env.host,
    port: env.port,
  });
} catch (error) {
  app.log.error({ err: error }, "Failed to start OpenStat backend");
  process.exit(1);
}
