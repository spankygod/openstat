import "./sentry.js";

import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { captureException, flushSentry } from "./sentry.js";

const app = await buildApp();

try {
  await app.listen({
    host: env.host,
    port: env.port,
  });
} catch (error) {
  captureException(error, {
    server: {
      host: env.host,
      port: env.port,
    },
  });
  await flushSentry();
  app.log.error({ err: error }, "Failed to start OpenStat backend");
  process.exit(1);
}
