import type { FastifyInstance } from "fastify";

import { database, ingestionSignalClient } from "../context.js";
import { getRedisTelemetrySnapshot } from "../redis-telemetry.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "openstat-backend",
  }));

  app.get("/ready", async (request, reply) => {
    try {
      await database.client`select 1`;
      const redis = await getRedisReadinessStatus();

      return reply.send({
        status: "ready",
        database: "ok",
        redis,
        telemetry: {
          redis: getRedisTelemetrySnapshot(),
        },
      });
    } catch (error) {
      request.log.error({ err: error }, "Readiness check failed");

      return reply.status(503).send({
        status: "not_ready",
        database: "error",
        redis: "unknown",
      });
    }
  });
}

async function getRedisReadinessStatus() {
  if (!ingestionSignalClient) {
    return "disabled";
  }

  try {
    return (await ingestionSignalClient.ping()) ? "ok" : "error";
  } catch {
    return "error";
  }
}
