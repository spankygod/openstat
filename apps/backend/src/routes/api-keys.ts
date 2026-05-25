import { generateApiKey } from "@openstat/auth";
import { schema } from "@openstat/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireSessionScope } from "../auth-scope.js";
import { database } from "../context.js";
import { deleteApiKeyLookupCache } from "../api-key-cache.js";
import {
  createApiKeyBodySchema,
  createApiKeyResponseSchema,
  errorResponseSchema,
  getApiKeyResponseSchema,
  listApiKeysResponseSchema,
  rotateApiKeyResponseSchema,
  revokeApiKeyResponseSchema,
  sessionCookieSecurity,
} from "../openapi/schemas.js";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(120).default("Ingestion key"),
});

const apiKeyParamsSchema = z.object({
  apiKeyId: z.uuid(),
});

export async function registerApiKeyRoutes(app: FastifyInstance) {
  app.get(
    "/v1/api-keys",
    {
      schema: {
        tags: ["API Keys"],
        summary: "List API keys for the current project",
        security: sessionCookieSecurity,
        response: {
          200: listApiKeysResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await requireSessionScope(request);

      const apiKeys = await database.db
        .select({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          prefix: schema.apiKeys.prefix,
          lastUsedAt: schema.apiKeys.lastUsedAt,
          revokedAt: schema.apiKeys.revokedAt,
          expiresAt: schema.apiKeys.expiresAt,
          createdAt: schema.apiKeys.createdAt,
        })
        .from(schema.apiKeys)
        .where(
          and(
            eq(schema.apiKeys.organizationId, scope.organizationId),
            eq(schema.apiKeys.projectId, scope.projectId),
          ),
        )
        .orderBy(desc(schema.apiKeys.createdAt));

      return { apiKeys };
    },
  );

  app.get(
    "/v1/api-keys/:apiKeyId",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Get one API key for the current project",
        security: sessionCookieSecurity,
        params: {
          type: "object",
          required: ["apiKeyId"],
          properties: {
            apiKeyId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: getApiKeyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await requireSessionScope(request);
      const params = apiKeyParamsSchema.parse(request.params);
      const [apiKey] = await database.db
        .select({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          prefix: schema.apiKeys.prefix,
          lastUsedAt: schema.apiKeys.lastUsedAt,
          revokedAt: schema.apiKeys.revokedAt,
          expiresAt: schema.apiKeys.expiresAt,
          createdAt: schema.apiKeys.createdAt,
        })
        .from(schema.apiKeys)
        .where(
          and(
            eq(schema.apiKeys.id, params.apiKeyId),
            eq(schema.apiKeys.organizationId, scope.organizationId),
            eq(schema.apiKeys.projectId, scope.projectId),
          ),
        )
        .limit(1);

      if (!apiKey) {
        return reply.status(404).send({
          error: {
            code: "API_KEY_NOT_FOUND",
            message: "API key was not found.",
            requestId: request.id,
          },
        });
      }

      return { apiKey };
    },
  );

  app.post(
    "/v1/api-keys",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Create an ingestion API key",
        description:
          "The plaintext key is returned once and should be copied immediately.",
        security: sessionCookieSecurity,
        body: createApiKeyBodySchema,
        response: {
          200: createApiKeyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const scope = await requireSessionScope(request);
      const input = createApiKeySchema.parse(request.body ?? {});
      const apiKey = generateApiKey();

      const [createdApiKey] = await database.db
        .insert(schema.apiKeys)
        .values({
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          name: input.name,
          prefix: apiKey.prefix,
          secretHash: apiKey.secretHash,
        })
        .returning({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          prefix: schema.apiKeys.prefix,
          createdAt: schema.apiKeys.createdAt,
        });

      if (!createdApiKey) {
        throw new Error("Failed to create API key.");
      }

      await database.db.insert(schema.notifications).values({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        type: "api_key.created",
        status: "unread",
        title: "API key created",
        message: `${createdApiKey.name} was created.`,
        data: {
          apiKeyId: createdApiKey.id,
          name: createdApiKey.name,
          prefix: createdApiKey.prefix,
        },
      });

      return {
        apiKey: createdApiKey,
        key: apiKey.key,
      };
    },
  );

  app.post(
    "/v1/api-keys/:apiKeyId/rotate",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Rotate an ingestion API key",
        description:
          "Revokes the selected key and returns a plaintext replacement once.",
        security: sessionCookieSecurity,
        params: {
          type: "object",
          required: ["apiKeyId"],
          properties: {
            apiKeyId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: rotateApiKeyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await requireSessionScope(request);
      const params = apiKeyParamsSchema.parse(request.params);
      const now = new Date();
      const replacementKey = generateApiKey();

      const rotation = await database.db.transaction(async (tx) => {
        const [rotatedApiKey] = await tx
          .update(schema.apiKeys)
          .set({
            revokedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.apiKeys.id, params.apiKeyId),
              eq(schema.apiKeys.organizationId, scope.organizationId),
              eq(schema.apiKeys.projectId, scope.projectId),
              isNull(schema.apiKeys.revokedAt),
            ),
          )
          .returning({
            id: schema.apiKeys.id,
            name: schema.apiKeys.name,
            prefix: schema.apiKeys.prefix,
            revokedAt: schema.apiKeys.revokedAt,
          });

        if (!rotatedApiKey) {
          return undefined;
        }

        const [createdApiKey] = await tx
          .insert(schema.apiKeys)
          .values({
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            name: rotatedApiKey.name,
            prefix: replacementKey.prefix,
            secretHash: replacementKey.secretHash,
          })
          .returning({
            id: schema.apiKeys.id,
            name: schema.apiKeys.name,
            prefix: schema.apiKeys.prefix,
            lastUsedAt: schema.apiKeys.lastUsedAt,
            revokedAt: schema.apiKeys.revokedAt,
            expiresAt: schema.apiKeys.expiresAt,
            createdAt: schema.apiKeys.createdAt,
          });

        if (!createdApiKey) {
          throw new Error("Failed to rotate API key.");
        }

        await tx.insert(schema.notifications).values({
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          type: "api_key.rotated",
          status: "unread",
          title: "API key rotated",
          message: `${rotatedApiKey.name} was rotated.`,
          data: {
            apiKeyId: rotatedApiKey.id,
            name: rotatedApiKey.name,
            prefix: rotatedApiKey.prefix,
            replacementApiKeyId: createdApiKey.id,
            replacementPrefix: createdApiKey.prefix,
          },
        });

        return {
          apiKey: createdApiKey,
          revokedPrefix: rotatedApiKey.prefix,
          rotatedApiKey: {
            id: rotatedApiKey.id,
            revokedAt: rotatedApiKey.revokedAt,
          },
        };
      });

      if (!rotation) {
        return reply.status(404).send({
          error: {
            code: "API_KEY_NOT_FOUND",
            message: "API key was not found.",
            requestId: request.id,
          },
        });
      }

      await deleteApiKeyLookupCache(rotation.revokedPrefix);

      return {
        apiKey: rotation.apiKey,
        key: replacementKey.key,
        rotatedApiKey: rotation.rotatedApiKey,
      };
    },
  );

  app.delete(
    "/v1/api-keys/:apiKeyId",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Revoke an ingestion API key",
        security: sessionCookieSecurity,
        params: {
          type: "object",
          required: ["apiKeyId"],
          properties: {
            apiKeyId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: revokeApiKeyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const scope = await requireSessionScope(request);
      const params = apiKeyParamsSchema.parse(request.params);
      const now = new Date();

      const [revokedApiKey] = await database.db
        .update(schema.apiKeys)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.apiKeys.id, params.apiKeyId),
            eq(schema.apiKeys.organizationId, scope.organizationId),
            eq(schema.apiKeys.projectId, scope.projectId),
            isNull(schema.apiKeys.revokedAt),
          ),
        )
        .returning({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          prefix: schema.apiKeys.prefix,
          revokedAt: schema.apiKeys.revokedAt,
        });

      if (!revokedApiKey) {
        return reply.status(404).send({
          error: {
            code: "API_KEY_NOT_FOUND",
            message: "API key was not found.",
            requestId: request.id,
          },
        });
      }

      await database.db.insert(schema.notifications).values({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        type: "api_key.revoked",
        status: "unread",
        title: "API key revoked",
        message: `${revokedApiKey.name} was revoked.`,
        data: {
          apiKeyId: revokedApiKey.id,
          name: revokedApiKey.name,
          prefix: revokedApiKey.prefix,
        },
      });

      await deleteApiKeyLookupCache(revokedApiKey.prefix);

      return {
        apiKey: {
          id: revokedApiKey.id,
          revokedAt: revokedApiKey.revokedAt,
        },
      };
    },
  );
}
