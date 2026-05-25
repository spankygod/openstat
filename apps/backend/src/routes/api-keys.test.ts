import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerErrorHandler } from "../plugins/errors.js";
import { registerApiKeyRoutes } from "./api-keys.js";

const state = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
  ingestionSignalClient: undefined as
    | {
        delete: ReturnType<typeof vi.fn>;
      }
    | undefined,
  requireSessionScope: vi.fn(),
  tx: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../context.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  database: {
    db: state.db,
  },
  get ingestionSignalClient() {
    return state.ingestionSignalClient;
  },
}));

vi.mock("../auth-scope.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth-scope.js")>();

  return {
    ...actual,
    requireSessionScope: state.requireSessionScope,
  };
});

const scope = {
  organizationId: "org_test",
  projectId: "project_test",
};

describe("api key routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ingestionSignalClient = undefined;
    state.requireSessionScope.mockResolvedValue(scope);
    state.db.transaction.mockImplementation(async (callback) =>
      callback(state.tx),
    );
  });

  it("creates an API key scoped to the current project", async () => {
    const createKeyValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: "key_1",
          name: "Main ingestion",
          prefix: "ostat_public",
          createdAt: new Date("2026-05-11T00:00:00.000Z"),
        },
      ]),
    });
    const createNotificationValues = vi.fn().mockResolvedValue(undefined);

    state.db.insert
      .mockReturnValueOnce({ values: createKeyValues })
      .mockReturnValueOnce({ values: createNotificationValues });

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      payload: {
        name: "Main ingestion",
      },
    });

    const body = response.json<{
      apiKey: { id: string; name: string; prefix: string };
      key: string;
    }>();

    expect(response.statusCode).toBe(200);
    expect(createKeyValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        name: "Main ingestion",
      }),
    );
    expect(createNotificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        type: "api_key.created",
        status: "unread",
        title: "API key created",
        message: "Main ingestion was created.",
        data: expect.objectContaining({
          apiKeyId: "key_1",
          prefix: "ostat_public",
        }),
      }),
    );
    expect(body.apiKey.id).toBe("key_1");
    expect(body.apiKey.prefix).toBe("ostat_public");
    expect(body.key).toMatch(/^ostat_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$/u);

    await app.close();
  });

  it("lists only API keys for the session project scope", async () => {
    const orderBy = vi.fn().mockResolvedValue([
      {
        id: "key_1",
        name: "Main ingestion",
        prefix: "ostat_public",
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });

    state.db.select.mockReturnValue({ from });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/api-keys",
    });

    const body = response.json<{ apiKeys: Array<{ id: string }> }>();

    expect(response.statusCode).toBe(200);
    expect(state.requireSessionScope).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0]?.id).toBe("key_1");

    await app.close();
  });

  it("returns one safe API key inside the current project scope", async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Main ingestion",
        prefix: "ostat_public",
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });

    state.db.select.mockReturnValue({ from });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000001",
    });

    const body = response.json<{
      apiKey: { id: string; prefix: string; secretHash?: string };
    }>();

    expect(response.statusCode).toBe(200);
    expect(where).toHaveBeenCalledOnce();
    expect(body.apiKey.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(body.apiKey.prefix).toBe("ostat_public");
    expect(body.apiKey.secretHash).toBeUndefined();

    await app.close();
  });

  it("returns a stable error code when an API key detail is out of scope", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });

    state.db.select.mockReturnValue({ from });

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000404",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("API_KEY_NOT_FOUND");

    await app.close();
  });

  it("revokes an API key inside the current project scope", async () => {
    state.ingestionSignalClient = {
      delete: vi.fn().mockResolvedValue(1),
    };
    const returning = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Main ingestion",
        prefix: "ostat_public",
        revokedAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const createNotificationValues = vi.fn().mockResolvedValue(undefined);

    state.db.update.mockReturnValue({ set });
    state.db.insert.mockReturnValue({ values: createNotificationValues });

    const app = await createApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000001",
    });

    const body = response.json<{ apiKey: { id: string; revokedAt: string } }>();

    expect(response.statusCode).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(where).toHaveBeenCalledOnce();
    expect(createNotificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        type: "api_key.revoked",
        status: "unread",
        title: "API key revoked",
        message: "Main ingestion was revoked.",
        data: expect.objectContaining({
          apiKeyId: "00000000-0000-4000-8000-000000000001",
          prefix: "ostat_public",
        }),
      }),
    );
    expect(state.ingestionSignalClient.delete).toHaveBeenCalledWith(
      "openstat:api-key:ostat_public",
    );
    expect(body.apiKey.id).toBe("00000000-0000-4000-8000-000000000001");

    await app.close();
  });

  it("rotates an active API key inside the current project scope", async () => {
    state.ingestionSignalClient = {
      delete: vi.fn().mockResolvedValue(1),
    };
    const updateReturning = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Main ingestion",
        prefix: "ostat_public",
        revokedAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    ]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const insertReturning = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Main ingestion",
        prefix: "ostat_rotated",
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-05-11T00:01:00.000Z"),
      },
    ]);
    const insertKeyValues = vi.fn().mockReturnValue({
      returning: insertReturning,
    });
    const insertNotificationValues = vi.fn().mockResolvedValue(undefined);

    state.tx.update.mockReturnValue({ set: updateSet });
    state.tx.insert
      .mockReturnValueOnce({ values: insertKeyValues })
      .mockReturnValueOnce({ values: insertNotificationValues });

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000001/rotate",
    });

    const body = response.json<{
      apiKey: { id: string; name: string; prefix: string };
      key: string;
      rotatedApiKey: { id: string; revokedAt: string };
    }>();

    expect(response.statusCode).toBe(200);
    expect(state.db.transaction).toHaveBeenCalledOnce();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(insertKeyValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        name: "Main ingestion",
      }),
    );
    expect(insertNotificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        type: "api_key.rotated",
        status: "unread",
        title: "API key rotated",
        message: "Main ingestion was rotated.",
        data: expect.objectContaining({
          apiKeyId: "00000000-0000-4000-8000-000000000001",
          prefix: "ostat_public",
          replacementApiKeyId: "00000000-0000-4000-8000-000000000002",
          replacementPrefix: "ostat_rotated",
        }),
      }),
    );
    expect(state.ingestionSignalClient.delete).toHaveBeenCalledWith(
      "openstat:api-key:ostat_public",
    );
    expect(body.rotatedApiKey.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(body.apiKey.id).toBe("00000000-0000-4000-8000-000000000002");
    expect(body.apiKey.prefix).toBe("ostat_rotated");
    expect(body.key).toMatch(/^ostat_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$/u);

    await app.close();
  });

  it("returns a stable error code when an API key cannot be rotated", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });

    state.tx.update.mockReturnValue({ set });

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000404/rotate",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("API_KEY_NOT_FOUND");
    expect(state.tx.insert).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns a stable error code when an API key cannot be revoked", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });

    state.db.update.mockReturnValue({ set });

    const app = await createApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/api-keys/00000000-0000-4000-8000-000000000404",
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("API_KEY_NOT_FOUND");

    await app.close();
  });
});

async function createApp() {
  const app = Fastify({ logger: false });

  await registerErrorHandler(app);
  await registerApiKeyRoutes(app);

  return app;
}
