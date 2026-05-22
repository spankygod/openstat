import { generateApiKey, authenticateApiKey } from "@openstat/auth";
import { describe, expect, it, vi } from "vitest";

function createAuthDb(apiKeyRow: {
  id: string;
  organizationId: string;
  projectId: string;
  secretHash: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
} | undefined) {
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
