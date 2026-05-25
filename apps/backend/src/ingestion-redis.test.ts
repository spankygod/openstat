import {
  acceptIngestionBatch,
  createProjectUpdatedMessage,
  DEFAULT_PROJECT_CACHE_DOMAINS,
  invalidateProjectReadCaches,
  REDIS_CHANNELS,
} from "@openstat/ingestion";
import type { IngestEventInput } from "@openstat/schemas/ingestion";
import { describe, expect, it, vi } from "vitest";

const auth = {
  apiKeyId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000003",
};

describe("ingestion Redis wake-up signals", () => {
  it("publishes only safe outbox metadata after accepting rows", async () => {
    const { db } = createAcceptDb({
      batchId: "00000000-0000-4000-8000-000000000010",
      outboxIds: [
        "00000000-0000-4000-8000-000000000011",
        "00000000-0000-4000-8000-000000000012",
      ],
    });
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const accepted = await acceptIngestionBatch({
      db,
      auth,
      input: {
        events: [
          createEvent("event_one"),
          createEvent("event_two", {
            prompt: "do not publish this",
            raw_order_payload: {
              account_id: "acct_sensitive",
            },
          }),
        ],
      },
      publisher,
      source: "http",
    });

    expect(accepted.count).toBe(2);
    expect(publisher.publish).toHaveBeenCalledOnce();
    expect(publisher.publish).toHaveBeenCalledWith(
      REDIS_CHANNELS.ingestion,
      expect.any(String),
    );

    const [, rawMessage] = publisher.publish.mock.calls[0] as [string, string];
    const message = JSON.parse(rawMessage) as Record<string, unknown>;

    expect(message).toEqual({
      type: "ingestion.outbox.created",
      projectId: auth.projectId,
      batchId: "00000000-0000-4000-8000-000000000010",
      outboxIds: [
        "00000000-0000-4000-8000-000000000011",
        "00000000-0000-4000-8000-000000000012",
      ],
      count: 2,
      source: "http",
      createdAt: expect.any(String),
    });
    expect(new Date(message.createdAt as string).toString()).not.toBe(
      "Invalid Date",
    );
    expect(rawMessage).not.toContain("do not publish this");
    expect(rawMessage).not.toContain("acct_sensitive");
  });

  it("keeps ingestion accepted when Redis publish fails", async () => {
    const { db } = createAcceptDb({
      batchId: "00000000-0000-4000-8000-000000000020",
      outboxIds: ["00000000-0000-4000-8000-000000000021"],
    });
    const publisher = {
      publish: vi.fn().mockRejectedValue(new Error("redis unavailable")),
    };

    const accepted = await acceptIngestionBatch({
      db,
      auth,
      input: {
        events: [createEvent("event_fallback")],
      },
      publisher,
      source: "sdk",
    });

    expect(accepted).toEqual({
      accepted: true,
      batchId: "00000000-0000-4000-8000-000000000020",
      projectId: auth.projectId,
      count: 1,
      outboxIds: ["00000000-0000-4000-8000-000000000021"],
    });
    expect(publisher.publish).toHaveBeenCalledOnce();
  });

  it("does not publish a wake-up when no outbox rows are created", async () => {
    const { db } = createAcceptDb({
      batchId: "00000000-0000-4000-8000-000000000030",
      outboxIds: [],
    });
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const accepted = await acceptIngestionBatch({
      db,
      auth,
      input: {
        events: [createEvent("event_duplicate")],
      },
      publisher,
      source: "webhook",
    });

    expect(accepted.count).toBe(0);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

describe("project cache invalidation", () => {
  it("builds a safe project update message", () => {
    const message = createProjectUpdatedMessage({
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
      projectId: auth.projectId,
    });

    expect(message).toEqual({
      type: "project.updated",
      projectId: auth.projectId,
      domains: [...DEFAULT_PROJECT_CACHE_DOMAINS],
      createdAt: "2026-05-26T00:00:00.000Z",
    });
    expect(JSON.stringify(message)).not.toContain("payload");
    expect(JSON.stringify(message)).not.toContain("secret");
  });

  it("deletes the expected project-scoped cache keys and patterns", async () => {
    const client = {
      delete: vi.fn().mockResolvedValue(1),
      deleteByPattern: vi.fn().mockResolvedValue(3),
    };

    const invalidated = await invalidateProjectReadCaches({
      client,
      projectId: auth.projectId,
    });

    expect(client.delete).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:overview`,
    );
    expect(client.deleteByPattern).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:runs:*`,
    );
    expect(client.deleteByPattern).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:trades:*`,
    );
    expect(client.deleteByPattern).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:notifications:*`,
    );
    expect(client.deleteByPattern).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:analytics:*`,
    );
    expect(invalidated.deleted).toBe(13);
  });

  it("can invalidate a narrow changed domain set", async () => {
    const client = {
      delete: vi.fn().mockResolvedValue(0),
      deleteByPattern: vi.fn().mockResolvedValue(2),
    };

    const invalidated = await invalidateProjectReadCaches({
      client,
      domains: ["trades"],
      projectId: auth.projectId,
    });

    expect(client.delete).not.toHaveBeenCalled();
    expect(client.deleteByPattern).toHaveBeenCalledOnce();
    expect(client.deleteByPattern).toHaveBeenCalledWith(
      `openstat:project:${auth.projectId}:trades:*`,
    );
    expect(invalidated.deleted).toBe(2);
  });
});

function createAcceptDb(options: { batchId: string; outboxIds: string[] }) {
  let insertCount = 0;

  const db = {
    insert: vi.fn(() => {
      insertCount += 1;

      if (insertCount === 1) {
        return {
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: options.batchId }]),
          })),
        };
      }

      return {
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue(options.outboxIds.map((id) => ({ id }))),
          })),
        })),
      };
    }),
  } as unknown as Parameters<typeof acceptIngestionBatch>[0]["db"];

  return { db };
}

function createEvent(
  id: string,
  data: Record<string, unknown> = {},
): IngestEventInput {
  return {
    id,
    schema_version: 1,
    agent: {
      id: "agent_test",
      name: "Test Agent",
    },
    type: "decision",
    data: {
      action: "watch",
      symbol: "BTC-USD",
      ...data,
    },
    metadata: {},
  };
}
