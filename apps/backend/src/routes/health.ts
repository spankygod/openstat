import type { FastifyInstance } from "fastify";

import { database } from "../context.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "openstat-backend",
  }));

  app.get("/ready", async (request, reply) => {
    try {
      await database.client`select 1`;

      return reply.send({
        status: "ready",
        database: "ok",
      });
    } catch (error) {
      request.log.error({ err: error }, "Readiness check failed");

      return reply.status(503).send({
        status: "not_ready",
        database: "error",
      });
    }
  });
}
