import { acceptIngestionBatch } from "@openstat/ingestion";
import {
  ingestEventBatchInputSchema,
  ingestEventInputSchema,
} from "@openstat/schemas/ingestion";
import type { FastifyInstance } from "fastify";

import { authenticateIngestionScope } from "../auth-scope.js";
import { database, ingestionSignalPublisher } from "../context.js";
import {
  bearerSecurity,
  errorResponseSchema,
  heartbeatBodySchema,
  ingestBatchAcceptedSchema,
  ingestBatchBodySchema,
  ingestEventAcceptedSchema,
  ingestEventBodySchema,
} from "../openapi/schemas.js";

const agentAuthDescription = [
  "Agent and LLM usage:",
  "- Read the ingestion key from `OPENSTAT_API_KEY` or your agent platform's secret store.",
  "- Send `Authorization: Bearer ${OPENSTAT_API_KEY}` on every request.",
  "- Send JSON with `Content-Type: application/json`.",
  "- Do not place the API key in the JSON body and do not use an `x-api-key` header.",
].join("\n");

export async function registerIngestionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/ingest/events",
    {
      schema: {
        tags: ["Agents", "Ingestion"],
        summary: "Ingest one agent event",
        description: [
          "Canonical API-first endpoint. SDK helper methods eventually call this event model.",
          "",
          agentAuthDescription,
          "",
          "Example:",
          "```sh",
          'curl -X POST "$OPENSTAT_ENDPOINT/v1/ingest/events" \\',
          '  -H "Authorization: Bearer $OPENSTAT_API_KEY" \\',
          '  -H "Content-Type: application/json" \\',
          '  -d \'{"type":"decision","agent":{"name":"trading-agent"},"data":{"action":"watch","symbol":"BTC-USD"}}\'',
          "```",
        ].join("\n"),
        security: bearerSecurity,
        body: ingestEventBodySchema,
        response: {
          202: ingestEventAcceptedSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const auth = await authenticateIngestionScope(
        request.headers.authorization,
      );
      const input = ingestEventInputSchema.parse(request.body);
      const result = await acceptIngestionBatch({
        db: database.db,
        auth,
        input: { events: [input] },
        source: "http",
        publisher: ingestionSignalPublisher,
        requestId: request.id,
      });

      return reply.status(202).send(result);
    },
  );

  app.post(
    "/v1/ingest/batch",
    {
      schema: {
        tags: ["Agents", "Ingestion"],
        summary: "Ingest a batch of agent events",
        description: [
          "Accepts 1 to 100 agent events in one request.",
          "",
          agentAuthDescription,
        ].join("\n"),
        security: bearerSecurity,
        body: ingestBatchBodySchema,
        response: {
          202: ingestBatchAcceptedSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const auth = await authenticateIngestionScope(
        request.headers.authorization,
      );
      const input = ingestEventBatchInputSchema.parse(request.body);

      const result = await acceptIngestionBatch({
        db: database.db,
        auth,
        input,
        source: "http",
        publisher: ingestionSignalPublisher,
        requestId: request.id,
      });

      return reply.status(202).send(result);
    },
  );

  app.post(
    "/v1/ingest/heartbeat",
    {
      schema: {
        tags: ["Agents", "Ingestion"],
        summary: "Ingest an agent heartbeat",
        description: [
          "Convenience endpoint for status monitoring. Internally stored as a normal `heartbeat` event.",
          "",
          agentAuthDescription,
          "",
          "Example:",
          "```sh",
          'curl -X POST "$OPENSTAT_ENDPOINT/v1/ingest/heartbeat" \\',
          '  -H "Authorization: Bearer $OPENSTAT_API_KEY" \\',
          '  -H "Content-Type: application/json" \\',
          '  -d \'{"agent":{"name":"trading-agent"},"data":{"status":"online"}}\'',
          "```",
        ].join("\n"),
        security: bearerSecurity,
        body: heartbeatBodySchema,
        response: {
          202: ingestEventAcceptedSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const auth = await authenticateIngestionScope(
        request.headers.authorization,
      );
      const body =
        request.body && typeof request.body === "object" ? request.body : {};

      const input = ingestEventInputSchema.parse({
        ...body,
        type: "heartbeat",
        data: "data" in body ? body.data : {},
      });
      const result = await acceptIngestionBatch({
        db: database.db,
        auth,
        input: { events: [input] },
        source: "http",
        publisher: ingestionSignalPublisher,
        requestId: request.id,
      });

      return reply.status(202).send(result);
    },
  );
}
