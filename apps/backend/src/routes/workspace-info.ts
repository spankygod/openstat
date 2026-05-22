import { schema } from "@openstat/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { requireSessionScope } from "../auth-scope.js";
import { database } from "../context.js";

export async function registerWorkspaceInfoRoutes(app: FastifyInstance) {
  app.get("/v1/workspace", async (request, reply) => {
    const scope = await requireSessionScope(request);
    const [workspace] = await database.db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
        createdAt: schema.organizations.createdAt,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, scope.organizationId))
      .limit(1);

    const [project] = await database.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        isDefault: schema.projects.isDefault,
      })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, scope.projectId),
          eq(schema.projects.organizationId, scope.organizationId),
        ),
      )
      .limit(1);

    if (!workspace || !project) {
      return reply.status(404).send({
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace was not found.",
          requestId: request.id,
        },
      });
    }

    return {
      workspace,
      project,
    };
  });
}
