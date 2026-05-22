import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthScopeError } from "../auth-scope.js";
import { registerErrorHandler } from "../plugins/errors.js";
import { registerIngestionRoutes } from "./ingestion.js";

const state = vi.hoisted(() => ({
  authenticateIngestionScope: vi.fn(),
  db: {},
  ingestEvent: vi.fn(),
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
  ingestionSignalPublisher: undefined,
}));

vi.mock("../auth-scope.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../auth-scope.js")>();

  return {
    ...actual,
    authenticateIngestionScope: state.authenticateIngestionScope,
  };
});

vi.mock("@openstat/ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openstat/ingestion")>();

  return {
    ...actual,
    acceptIngestionBatch: state.ingestEvent,
  };
});

const authScope = {
  apiKeyId: "api_key_test",
  organizationId: "org_test",
  projectId: "project_test",
};

describe("ingestion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authenticateIngestionScope.mockResolvedValue(authScope);
    state.ingestEvent.mockResolvedValue({
      accepted: true,
      batchId: "batch_test",
      projectId: authScope.projectId,
      count: 1,
      outboxIds: ["outbox_test"],
    });
  });

  it("authenticates bearer keys before accepting events", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/ingest/events",
      headers: {
        authorization: "Bearer ostat_public_secret",
      },
      payload: {
        type: "decision",
        data: {
          action: "watch",
        },
      },
    });

    const body = response.json<{
      accepted: true;
      batchId: string;
      projectId: string;
    }>();

    expect(response.statusCode).toBe(202);
    expect(state.authenticateIngestionScope).toHaveBeenCalledWith(
      "Bearer ostat_public_secret",
    );
    expect(state.ingestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: authScope,
        db: state.db,
        source: "http",
        input: {
          events: [
            expect.objectContaining({
              type: "decision",
              data: {
                action: "watch",
              },
            }),
          ],
        },
      }),
    );
    expect(body.accepted).toBe(true);
    expect(body.projectId).toBe(authScope.projectId);

    await app.close();
  });

  it("returns the auth error code when ingestion has no valid API key", async () => {
    state.authenticateIngestionScope.mockRejectedValue(
      new AuthScopeError(401, "MISSING_API_KEY", "Missing API key."),
    );

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/ingest/events",
      payload: {
        type: "heartbeat",
        data: {},
      },
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(401);
    expect(body.error.code).toBe("MISSING_API_KEY");
    expect(state.ingestEvent).not.toHaveBeenCalled();

    await app.close();
  });
});

async function createApp() {
  const app = Fastify({ logger: false });

  await registerErrorHandler(app);
  await registerIngestionRoutes(app);

  return app;
}
