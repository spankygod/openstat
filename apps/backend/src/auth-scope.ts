import {
  ApiKeyAuthError,
  authenticateApiKey,
  type ApiKeyAuthContext,
} from "@openstat/auth";
import { schema } from "@openstat/db";
import type { ReadScope } from "@openstat/ingestion";
import { fromNodeHeaders } from "better-auth/node";
import { and, asc, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";

import { auth, database } from "./context.js";

export class AuthScopeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthScopeError";
  }
}

export async function authenticateIngestionScope(
  authorizationHeader: string | undefined,
): Promise<ApiKeyAuthContext> {
  try {
    return await authenticateApiKey({
      db: database.db,
      authorizationHeader,
    });
  } catch (error) {
    if (error instanceof ApiKeyAuthError) {
      throw new AuthScopeError(
        getApiKeyStatusCode(error),
        error.code,
        error.message,
      );
    }

    throw error;
  }
}

export async function resolveReadScope(request: FastifyRequest) {
  const sessionScope = await resolveSessionReadScope(request);

  if (sessionScope) {
    return sessionScope;
  }

  const apiKeyScope = await authenticateIngestionScope(
    request.headers.authorization,
  );

  return {
    organizationId: apiKeyScope.organizationId,
    projectId: apiKeyScope.projectId,
  };
}

export async function requireSessionScope(request: FastifyRequest) {
  const scope = await resolveSessionReadScope(request);

  if (!scope) {
    throw new AuthScopeError(
      401,
      "UNAUTHORIZED",
      "Authentication is required.",
    );
  }

  return scope;
}

async function resolveSessionReadScope(
  request: FastifyRequest,
): Promise<ReadScope | undefined> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return undefined;
  }

  const requestedOrganizationId = getHeaderValue(
    request.headers["x-openstat-organization-id"],
  );
  const requestedProjectId = getHeaderValue(request.headers["x-openstat-project-id"]);

  const membership = requestedOrganizationId
    ? await findMembership(session.user.id, requestedOrganizationId)
    : await findFirstMembership(session.user.id);

  if (!membership) {
    throw new AuthScopeError(
      403,
      "ORGANIZATION_ACCESS_DENIED",
      "User does not have access to an organization.",
    );
  }

  const project = requestedProjectId
    ? await findProject(membership.organizationId, requestedProjectId)
    : await findDefaultProject(membership.organizationId);

  if (!project) {
    throw new AuthScopeError(
      404,
      "PROJECT_NOT_FOUND",
      "Project was not found for this organization.",
    );
  }

  return {
    membershipId: membership.id,
    organizationId: membership.organizationId,
    projectId: project.id,
  };
}

async function findMembership(userId: string, organizationId: string) {
  const [membership] = await database.db
    .select({
      id: schema.memberships.id,
      organizationId: schema.memberships.organizationId,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.userId, userId),
        eq(schema.memberships.organizationId, organizationId),
      ),
    )
    .limit(1);

  return membership;
}

async function findFirstMembership(userId: string) {
  const [membership] = await database.db
    .select({
      id: schema.memberships.id,
      organizationId: schema.memberships.organizationId,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId))
    .orderBy(asc(schema.memberships.createdAt))
    .limit(1);

  return membership;
}

async function findProject(organizationId: string, projectId: string) {
  const [project] = await database.db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.organizationId, organizationId),
        eq(schema.projects.id, projectId),
      ),
    )
    .limit(1);

  return project;
}

async function findDefaultProject(organizationId: string) {
  const [project] = await database.db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.organizationId, organizationId),
        eq(schema.projects.isDefault, true),
      ),
    )
    .limit(1);

  return project;
}

function getApiKeyStatusCode(error: ApiKeyAuthError) {
  switch (error.code) {
    case "MISSING_API_KEY":
    case "INVALID_API_KEY":
      return 401;
    case "REVOKED_API_KEY":
    case "EXPIRED_API_KEY":
      return 403;
    case "MISSING_DEFAULT_PROJECT":
      return 409;
  }
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
