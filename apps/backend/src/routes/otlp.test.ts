import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthScopeError } from "../auth-scope.js";
import { registerErrorHandler } from "../plugins/errors.js";
import { registerOtlpRoutes } from "./otlp.js";

const state = vi.hoisted(() => ({
  authenticateIngestionScope: vi.fn(),
  insertValues: [] as unknown[],
  returning: vi.fn(),
}));

vi.mock("../context.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  database: {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          state.insertValues.push(values);

          return {
            returning: state.returning,
            then: (resolve: (value: unknown) => void) =>
              Promise.resolve(undefined).then(resolve),
          };
        }),
      })),
    },
  },
}));

vi.mock("../auth-scope.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../auth-scope.js")>();

  return {
    ...actual,
    authenticateIngestionScope: state.authenticateIngestionScope,
  };
});

const authScope = {
  apiKeyId: "api_key_test",
  organizationId: "org_test",
  projectId: "project_test",
};

describe("OTLP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.insertValues = [];
    state.authenticateIngestionScope.mockResolvedValue(authScope);
    state.returning.mockResolvedValue([{ id: "batch_test" }]);
  });

  it("accepts JSON protobuf traces into scoped OTLP span rows", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: {
        authorization: "Bearer ostat_public_secret",
      },
      payload: {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "paper-trader" },
                },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [
                      {
                        key: "openstat.strategy",
                        value: { stringValue: "breakout" },
                      },
                    ],
                    endTimeUnixNano: "1779468001000000000",
                    name: "decision",
                    spanId: "1111111111111111",
                    startTimeUnixNano: "1779468000000000000",
                    traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const body = response.json<{
      partialSuccess: { rejectedSpans: number };
    }>();
    const spanRows = state.insertValues[1] as Array<{
      projectId: string;
      resource: Record<string, unknown>;
      spanId: string;
      traceId: string;
    }>;

    expect(response.statusCode).toBe(200);
    expect(body.partialSuccess.rejectedSpans).toBe(0);
    expect(state.authenticateIngestionScope).toHaveBeenCalledWith(
      "Bearer ostat_public_secret",
    );
    expect(spanRows).toEqual([
      expect.objectContaining({
        projectId: authScope.projectId,
        resource: { "service.name": "paper-trader" },
        spanId: "1111111111111111",
        traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ]);

    await app.close();
  });

  it("returns auth errors before parsing OTLP payloads", async () => {
    state.authenticateIngestionScope.mockRejectedValue(
      new AuthScopeError(401, "MISSING_API_KEY", "Missing API key."),
    );

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/logs",
      payload: { resourceLogs: [] },
    });

    expect(response.statusCode).toBe(401);
    expect(state.insertValues).toHaveLength(0);

    await app.close();
  });

  it("rejects malformed protobuf payloads", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/metrics",
      headers: {
        authorization: "Bearer ostat_public_secret",
        "content-type": "application/x-protobuf",
      },
      payload: Buffer.from([0xff]),
    });

    const body = response.json<{ error: { code: string } }>();

    expect(response.statusCode).toBe(400);
    expect(body.error.code).toBe("MALFORMED_OTLP_PAYLOAD");

    await app.close();
  });
});

async function createApp() {
  const app = Fastify({ logger: false });

  await registerErrorHandler(app);
  await registerOtlpRoutes(app);

  return app;
}
