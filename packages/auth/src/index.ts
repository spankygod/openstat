import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { schema, type Database } from "@openstat/db";

const keyPrefix = "ostat";
const publicPartBytes = 9;
const secretPartBytes = 24;

export class ApiKeyAuthError extends Error {
  constructor(public readonly code: ApiKeyAuthErrorCode, message: string) {
    super(message);
    this.name = "ApiKeyAuthError";
  }
}

export type ApiKeyAuthErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "REVOKED_API_KEY"
  | "EXPIRED_API_KEY"
  | "MISSING_DEFAULT_PROJECT";

export interface ApiKeyAuthContext {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
}

export function generateApiKey() {
  const publicPart = generateKeyPart(publicPartBytes);
  const secret = generateKeyPart(secretPartBytes);
  const prefix = `${keyPrefix}_${publicPart}`;
  const key = `${prefix}_${secret}`;

  return {
    key,
    prefix,
    secretHash: hashApiKeySecret(secret),
  };
}

function generateKeyPart(byteLength: number) {
  return randomBytes(byteLength).toString("base64url").replaceAll("_", "-");
}

export async function authenticateApiKey(options: {
  db: Database["db"];
  authorizationHeader: string | undefined;
}): Promise<ApiKeyAuthContext> {
  const key = getBearerToken(options.authorizationHeader);

  if (!key) {
    throw new ApiKeyAuthError("MISSING_API_KEY", "Missing API key.");
  }

  const parsed = parseApiKey(key);

  if (!parsed) {
    throw new ApiKeyAuthError("INVALID_API_KEY", "Invalid API key.");
  }

  const [apiKey] = await options.db
    .select({
      id: schema.apiKeys.id,
      organizationId: schema.apiKeys.organizationId,
      projectId: schema.apiKeys.projectId,
      secretHash: schema.apiKeys.secretHash,
      revokedAt: schema.apiKeys.revokedAt,
      expiresAt: schema.apiKeys.expiresAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.prefix, parsed.prefix))
    .limit(1);

  if (!apiKey || !safeEqual(apiKey.secretHash, hashApiKeySecret(parsed.secret))) {
    throw new ApiKeyAuthError("INVALID_API_KEY", "Invalid API key.");
  }

  if (apiKey.revokedAt) {
    throw new ApiKeyAuthError("REVOKED_API_KEY", "API key has been revoked.");
  }

  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    throw new ApiKeyAuthError("EXPIRED_API_KEY", "API key has expired.");
  }

  await options.db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id));

  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    projectId: apiKey.projectId,
  };
}

export function createOpenStatAuth(options: {
  db: Database["db"];
  baseUrl: string;
  secret: string;
  trustedOrigins: string[];
  googleClientId?: string;
  googleClientSecret?: string;
}) {
  return betterAuth({
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      options.googleClientId && options.googleClientSecret
        ? {
            google: {
              clientId: options.googleClientId,
              clientSecret: options.googleClientSecret,
            },
          }
        : undefined,
  });
}

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/u);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function parseApiKey(key: string) {
  const parts = key.split("_");

  if (parts.length !== 3 || parts[0] !== keyPrefix || !parts[1] || !parts[2]) {
    return undefined;
  }

  return {
    prefix: `${parts[0]}_${parts[1]}`,
    secret: parts[2],
  };
}

function hashApiKeySecret(secret: string) {
  return createHash("sha256").update(secret).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
