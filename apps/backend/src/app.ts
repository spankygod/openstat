import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { ingestionSignalClient } from "./context.js";
import { registerErrorHandler } from "./plugins/errors.js";
import { startProjectRefreshSubscription } from "./project-refresh-events.js";
import {
  createRedisRateLimitStore,
  getIngestionRateLimitKey,
} from "./redis-rate-limit-store.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerApiKeyRoutes } from "./routes/api-keys.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIngestionRoutes } from "./routes/ingestion.js";
import { registerOtlpRoutes } from "./routes/otlp.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWorkspaceInfoRoutes } from "./routes/workspace-info.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import { normalizeOpenApiDocumentForGitBook } from "./openapi/normalize.js";

export async function buildApp() {
  const app = Fastify({
    bodyLimit: env.ingestionMaxBodyBytes,
    logger: {
      level: env.logLevel,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['set-cookie']",
      ],
    },
  });

  await registerErrorHandler(app);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "validator.swagger.io"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  });

  await app.register(cors, {
    origin: [env.appWebUrl],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-OpenStat-Organization-Id",
      "X-OpenStat-Project-Id",
    ],
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    keyGenerator: (request) =>
      getIngestionRateLimitKey(request.headers.authorization, request.ip),
    max: env.ingestionRateLimitMax,
    skipOnError: Boolean(ingestionSignalClient),
    store: ingestionSignalClient
      ? createRedisRateLimitStore(ingestionSignalClient)
      : undefined,
    timeWindow: env.ingestionRateLimitWindow,
  });

  const projectRefreshSubscription = await startProjectRefreshSubscription({
    client: ingestionSignalClient,
    logger: app.log,
  });

  app.addHook("onClose", async () => {
    await projectRefreshSubscription?.close();
    await ingestionSignalClient?.close();
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "OpenStat API",
        version: "0.0.0",
        description: [
          "API-first telemetry ingestion and monitoring for autonomous agents. SDKs are optional wrappers around this HTTP API.",
          "",
          "Agent and LLM usage: set `OPENSTAT_API_KEY` to an ingestion key from the OpenStat dashboard and send it on every ingestion request as `Authorization: Bearer ${OPENSTAT_API_KEY}`. Do not put the key in the JSON body and do not use `x-api-key`.",
        ].join("\n"),
      },
      servers: [{ url: env.apiPublicUrl }],
      tags: [
        {
          name: "Agents",
          description: [
            "Read this first when an AI agent or LLM is integrating with OpenStat.",
            "",
            "Use these exact rules:",
            "1. Store the ingestion key in `OPENSTAT_API_KEY` or the agent platform's secret store.",
            "2. Send `Authorization: Bearer ${OPENSTAT_API_KEY}` on every telemetry request.",
            "3. Send `Content-Type: application/json` with JSON request bodies.",
            "4. Send one event to `/v1/ingest/events`, multiple events to `/v1/ingest/batch`, and liveness checks to `/v1/ingest/heartbeat`.",
            "5. Do not put the API key in the JSON body.",
            "6. Do not use an `x-api-key` header.",
            "",
            "Minimal request:",
            "```sh",
            'curl -X POST "$OPENSTAT_ENDPOINT/v1/ingest/heartbeat" \\',
            '  -H "Authorization: Bearer $OPENSTAT_API_KEY" \\',
            '  -H "Content-Type: application/json" \\',
            '  -d \'{"agent":{"name":"my-agent"},"data":{"status":"online"}}\'',
            "```",
          ].join("\n"),
        },
        {
          name: "Ingestion",
          description: [
            "Canonical event ingestion API for agents.",
            "",
            "Agent and LLM usage: read `OPENSTAT_API_KEY` from the runtime environment or secret store, then send `Authorization: Bearer ${OPENSTAT_API_KEY}` and `Content-Type: application/json` with each request.",
            "",
            "Minimal curl example:",
            "```sh",
            'curl -X POST "$OPENSTAT_ENDPOINT/v1/ingest/events" \\',
            '  -H "Authorization: Bearer $OPENSTAT_API_KEY" \\',
            '  -H "Content-Type: application/json" \\',
            '  -d \'{"type":"heartbeat","data":{}}\'',
            "```",
          ].join("\n"),
        },
        {
          name: "API Keys",
          description: "Dashboard-managed ingestion keys.",
        },
        {
          name: "Monitoring",
          description: "Dashboard-ready agent and event reads.",
        },
        {
          name: "Workspace",
          description: "Authenticated workspace setup and lookup.",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description:
              "OpenStat ingestion API key. Send it in the HTTP `Authorization` header exactly as `Bearer ${OPENSTAT_API_KEY}`. Keys usually look like `ostat_...`; never place the key in the JSON request body.",
          },
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "BetterAuth dashboard session cookie.",
          },
        },
      },
    },
    transformObject: (documentObject) =>
      "openapiObject" in documentObject
        ? normalizeOpenApiDocumentForGitBook(documentObject.openapiObject)
        : documentObject.swaggerObject,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      deepLinking: true,
      docExpansion: "list",
    },
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerWorkspaceInfoRoutes(app);
  await registerApiKeyRoutes(app);
  await registerIngestionRoutes(app);
  await registerOtlpRoutes(app);
  await registerReadRoutes(app);

  app.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
      },
    },
    () => app.swagger(),
  );

  return app;
}
