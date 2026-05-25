import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerHealthRoutes } from "./health.js";

const state = vi.hoisted(() => ({
  databaseClient: vi.fn(),
  ingestionSignalClient: undefined as
    | {
        ping: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("../context.js", () => ({
  database: {
    get client() {
      return state.databaseClient;
    },
  },
  get ingestionSignalClient() {
    return state.ingestionSignalClient;
  },
}));

describe("health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.databaseClient.mockResolvedValue([{ "?column?": 1 }]);
    state.ingestionSignalClient = undefined;
  });

  it("reports Redis as disabled when REDIS_URL is not configured", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    const body = response.json<{
      database: string;
      redis: string;
      status: string;
      telemetry: { redis: unknown };
    }>();

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.database).toBe("ok");
    expect(body.redis).toBe("disabled");
    expect(body.telemetry.redis).toEqual(expect.any(Object));

    await app.close();
  });

  it("reports Redis readiness without making Redis a hard dependency", async () => {
    state.ingestionSignalClient = {
      ping: vi.fn().mockRejectedValue(new Error("redis unavailable")),
    };

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    const body = response.json<{
      database: string;
      redis: string;
      status: string;
    }>();

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.database).toBe("ok");
    expect(body.redis).toBe("error");

    await app.close();
  });
});

async function createApp() {
  const app = Fastify({ logger: false });

  await registerHealthRoutes(app);

  return app;
}
