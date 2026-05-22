import { schema } from "@openstat/db";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { auth, database } from "../context.js";

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.post("/v1/workspace/init", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication is required.",
          requestId: request.id,
        },
      });
    }

    const existingMembership = await findFirstMembership(session.user.id);

    if (existingMembership) {
      const project = await ensureDefaultProject(existingMembership.organizationId);

      return {
        workspaceId: existingMembership.organizationId,
        projectId: project.id,
      };
    }

    const result = await database.db.transaction(async (tx) => {
      const workspaceSlug = await uniqueWorkspaceSlug(
        slugify(session.user.name || session.user.email || "workspace"),
      );

      const [workspace] = await tx
        .insert(schema.organizations)
        .values({
          name: session.user.name || "OpenStat Workspace",
          slug: workspaceSlug,
        })
        .returning();

      if (!workspace) {
        throw new Error("Failed to create workspace.");
      }

      const [project] = await tx
        .insert(schema.projects)
        .values({
          organizationId: workspace.id,
          name: "Default",
          slug: "default",
          isDefault: true,
        })
        .returning();

      if (!project) {
        throw new Error("Failed to create default project.");
      }

      await tx.insert(schema.memberships).values({
        organizationId: workspace.id,
        userId: session.user.id,
        role: "owner",
      });

      return {
        workspaceId: workspace.id,
        projectId: project.id,
      };
    });

    return result;
  });
}

async function findFirstMembership(userId: string) {
  const [membership] = await database.db
    .select({
      organizationId: schema.memberships.organizationId,
    })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .limit(1);

  return membership;
}

async function ensureDefaultProject(organizationId: string) {
  const [existingProject] = await database.db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.organizationId, organizationId))
    .limit(1);

  if (existingProject) {
    return existingProject;
  }

  const [project] = await database.db
    .insert(schema.projects)
    .values({
      organizationId,
      name: "Default",
      slug: "default",
      isDefault: true,
    })
    .returning({ id: schema.projects.id });

  if (!project) {
    throw new Error("Failed to create default project.");
  }

  return project;
}

async function uniqueWorkspaceSlug(baseSlug: string) {
  let candidate = baseSlug;
  let attempt = 1;

  while (await workspaceSlugExists(candidate)) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }

  return candidate;
}

async function workspaceSlugExists(slug: string) {
  const [workspace] = await database.db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, slug))
    .limit(1);

  return Boolean(workspace);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 48) || "workspace"
  );
}
