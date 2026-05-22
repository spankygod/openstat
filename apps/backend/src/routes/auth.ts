import { fromNodeHeaders } from "better-auth/node";
import { hashPassword } from "better-auth/crypto";
import { schema } from "@openstat/db";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { auth, database } from "../context.js";
import { env } from "../config/env.js";

const demoLoginEmail = "audit1@example.com";
const demoLoginPassword = "openstat-local-demo-password";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/demo-login", async (request, reply) => {
    if (env.nodeEnv === "production") {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
          requestId: request.id,
        },
      });
    }

    const [demoUser] = await database.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, demoLoginEmail))
      .limit(1);

    if (!demoUser) {
      return reply.status(404).send({
        error: {
          code: "DEMO_ACCOUNT_NOT_FOUND",
          message: "Run the local demo seed before using demo login.",
          requestId: request.id,
        },
      });
    }

    const [credentialAccount] = await database.db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, demoUser.id),
          eq(schema.account.providerId, "credential"),
        ),
      )
      .limit(1);
    const passwordHash = await hashPassword(demoLoginPassword);

    if (credentialAccount) {
      await database.db
        .update(schema.account)
        .set({
          password: passwordHash,
          providerId: "credential",
          updatedAt: new Date(),
        })
        .where(eq(schema.account.id, credentialAccount.id));
    } else {
      await database.db.insert(schema.account).values({
        id: `account_${randomUUID()}`,
        accountId: demoUser.id,
        providerId: "credential",
        userId: demoUser.id,
        password: passwordHash,
      });
    }

    const result = await auth.api.signInEmail({
      body: {
        email: demoLoginEmail,
        password: demoLoginPassword,
        rememberMe: true,
      },
      headers: fromNodeHeaders(request.headers),
      returnHeaders: true,
      returnStatus: true,
    });

    result.headers?.forEach((value, key) => reply.header(key, value));
    reply.status(result.status ?? 200);

    return reply.send(result.response);
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, env.apiPublicUrl);
      const body =
        request.body === undefined ? undefined : JSON.stringify(request.body);

      const authRequest = new Request(url.toString(), {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        body,
      });

      const response = await auth.handler(authRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      const responseText = await response.text();

      return reply.send(responseText || null);
    },
  });

  app.get("/v1/me", async (request, reply) => {
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

    return reply.send(session);
  });
}
