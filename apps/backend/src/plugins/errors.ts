import { IngestionError } from "@openstat/ingestion";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { AuthScopeError } from "../auth-scope.js";
import { captureException } from "../sentry.js";

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          requestId: request.id,
          details: error.flatten(),
        },
      });
    }

    if (error instanceof IngestionError) {
      return reply.status(getIngestionStatusCode(error)).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });
    }

    if (error instanceof AuthScopeError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });
    }

    if (isHttpError(error)) {
      if (error.statusCode >= 500) {
        captureException(error, {
          request: getRequestContext(request),
        });
      }

      return reply.status(error.statusCode).send({
        error: {
          code: typeof error.code === "string" ? error.code : "REQUEST_ERROR",
          message: error.message,
          requestId: request.id,
        },
      });
    }

    captureException(error, {
      request: getRequestContext(request),
    });
    request.log.error({ err: error }, "Unhandled request error");

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
        requestId: request.id,
      },
    });
  });
}

function getRequestContext(request: FastifyRequest) {
  return {
    id: request.id,
    method: request.method,
    route: request.routeOptions.url,
    url: request.url,
  };
}

function isHttpError(
  error: unknown,
): error is Error & { statusCode: number; code?: unknown } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

function getIngestionStatusCode(error: IngestionError) {
  switch (error.code) {
    case "EMPTY_INGESTION_BATCH":
    case "INVALID_OUTBOX_PAYLOAD":
    case "PROJECT_SCOPE_MISMATCH":
      return 400;
    case "PROJECT_NOT_FOUND":
    case "AGENT_NOT_FOUND":
      return 404;
  }
}
