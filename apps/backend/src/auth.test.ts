import { generateApiKey, authenticateApiKey } from "@openstat/auth";
import { describe, expect, it, vi } from "vitest";

function createAuthDb(
  apiKeyRow:
    | {
        id: string;
        organizationId: string;
        projectId: string;
        secretHash: string;
        revokedAt: Date | null;
        expiresAt: Date | null;
      }
    | undefined,
) {
  const limit = vi.fn().mockResolvedValue(apiKeyRow ? [apiKeyRow] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    db: { select, update },
    calls: { from, limit, select, set, update, updateWhere, where },
  };
}

describe("API key authentication", () => {
  it("generates opaque ostat keys and authenticates the matching secret", async () => {
    const generated = generateApiKey();
    const { db, calls } = createAuthDb({
      id: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      projectId: "00000000-0000-4000-8000-000000000003",
      secretHash: generated.secretHash,
      revokedAt: null,
      expiresAt: null,
    });

    const scope = await authenticateApiKey({
      db: db as never,
      authorizationHeader: `Bearer ${generated.key}`,
    });

    expect(generated.key).toMatch(/^ostat_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$/u);
    expect(generated.prefix).toMatch(/^ostat_[A-Za-z0-9_-]+$/u);
    expect(generated.key).not.toContain(generated.secretHash);
    expect(scope).toEqual({
      apiKeyId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      projectId: "00000000-0000-4000-8000-000000000003",
    });
    expect(calls.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastUsedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("uses a warm API key lookup cache before querying by prefix", async () => {
    const generated = generateApiKey();
    const { db, calls } = createAuthDb(undefined);
    const cache = {
      get: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: "00000000-0000-4000-8000-000000000102",
        projectId: "00000000-0000-4000-8000-000000000103",
        secretHash: generated.secretHash,
        revokedAt: null,
        expiresAt: null,
      }),
      set: vi.fn(),
    };

    const scope = await authenticateApiKey({
      cache,
      db: db as never,
      authorizationHeader: `Bearer ${generated.key}`,
    });

    expect(scope).toEqual({
      apiKeyId: "00000000-0000-4000-8000-000000000101",
      organizationId: "00000000-0000-4000-8000-000000000102",
      projectId: "00000000-0000-4000-8000-000000000103",
    });
    expect(cache.get).toHaveBeenCalledWith(generated.prefix);
    expect(cache.set).not.toHaveBeenCalled();
    expect(calls.select).not.toHaveBeenCalled();
  });

  it("caches successful API key prefix lookups after a miss", async () => {
    const generated = generateApiKey();
    const row = {
      id: "00000000-0000-4000-8000-000000000201",
      organizationId: "00000000-0000-4000-8000-000000000202",
      projectId: "00000000-0000-4000-8000-000000000203",
      secretHash: generated.secretHash,
      revokedAt: null,
      expiresAt: null,
    };
    const { db } = createAuthDb(row);
    const cache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    };

    await authenticateApiKey({
      cache,
      db: db as never,
      authorizationHeader: `Bearer ${generated.key}`,
    });

    expect(cache.get).toHaveBeenCalledWith(generated.prefix);
    expect(cache.set).toHaveBeenCalledWith(generated.prefix, row);
  });

  it("rejects revoked and expired API keys from a warm cache", async () => {
    const generated = generateApiKey();

    await expect(
      authenticateApiKey({
        cache: {
          get: vi.fn().mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000301",
            organizationId: "00000000-0000-4000-8000-000000000302",
            projectId: "00000000-0000-4000-8000-000000000303",
            secretHash: generated.secretHash,
            revokedAt: new Date().toISOString(),
            expiresAt: null,
          }),
          set: vi.fn(),
        },
        db: createAuthDb(undefined).db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).rejects.toMatchObject({
      code: "REVOKED_API_KEY",
    });

    await expect(
      authenticateApiKey({
        cache: {
          get: vi.fn().mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000401",
            organizationId: "00000000-0000-4000-8000-000000000402",
            projectId: "00000000-0000-4000-8000-000000000403",
            secretHash: generated.secretHash,
            revokedAt: null,
            expiresAt: new Date(Date.now() - 1).toISOString(),
          }),
          set: vi.fn(),
        },
        db: createAuthDb(undefined).db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).rejects.toMatchObject({
      code: "EXPIRED_API_KEY",
    });
  });

  it("falls back to Postgres when the API key cache fails", async () => {
    const generated = generateApiKey();
    const { db, calls } = createAuthDb({
      id: "00000000-0000-4000-8000-000000000501",
      organizationId: "00000000-0000-4000-8000-000000000502",
      projectId: "00000000-0000-4000-8000-000000000503",
      secretHash: generated.secretHash,
      revokedAt: null,
      expiresAt: null,
    });
    const cache = {
      get: vi.fn().mockRejectedValue(new Error("redis unavailable")),
      set: vi.fn(),
    };

    await expect(
      authenticateApiKey({
        cache,
        db: db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).resolves.toMatchObject({
      apiKeyId: "00000000-0000-4000-8000-000000000501",
    });
    expect(calls.select).toHaveBeenCalledOnce();
  });

  it("returns stable codes for missing and malformed API keys", async () => {
    const { db } = createAuthDb(undefined);

    await expect(
      authenticateApiKey({ db: db as never, authorizationHeader: undefined }),
    ).rejects.toMatchObject({
      code: "MISSING_API_KEY",
    });
    await expect(
      authenticateApiKey({
        db: db as never,
        authorizationHeader: "Bearer not-an-openstat-key",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
  });

  it("returns stable codes for unknown, revoked, and expired API keys", async () => {
    const generated = generateApiKey();

    await expect(
      authenticateApiKey({
        db: createAuthDb(undefined).db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });

    await expect(
      authenticateApiKey({
        db: createAuthDb({
          id: "00000000-0000-4000-8000-000000000001",
          organizationId: "00000000-0000-4000-8000-000000000002",
          projectId: "00000000-0000-4000-8000-000000000003",
          secretHash: generated.secretHash,
          revokedAt: new Date(),
          expiresAt: null,
        }).db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).rejects.toMatchObject({
      code: "REVOKED_API_KEY",
    });

    await expect(
      authenticateApiKey({
        db: createAuthDb({
          id: "00000000-0000-4000-8000-000000000001",
          organizationId: "00000000-0000-4000-8000-000000000002",
          projectId: "00000000-0000-4000-8000-000000000003",
          secretHash: generated.secretHash,
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1),
        }).db as never,
        authorizationHeader: `Bearer ${generated.key}`,
      }),
    ).rejects.toMatchObject({
      code: "EXPIRED_API_KEY",
    });
  });
});
