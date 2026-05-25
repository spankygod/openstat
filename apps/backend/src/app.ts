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
import { registerReadRoutes } from "./routes/read.js";
import { registerWorkspaceInfoRoutes } from "./routes/workspace-info.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";

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
        description:
          "API-first telemetry ingestion and monitoring for autonomous agents. SDKs are optional wrappers around this HTTP API.",
      },
      tags: [
        {
          name: "Ingestion",
          description: "Canonical event ingestion API for agents.",
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
            description: "OpenStat API key, for example `Bearer ostat_...`.",
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
