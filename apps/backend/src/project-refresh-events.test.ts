import {
  emitProjectRefresh,
  onProjectRefresh,
  parseProjectUpdatedMessage,
  startProjectRefreshSubscription,
} from "./project-refresh-events.js";
import { describe, expect, it, vi } from "vitest";

describe("project refresh events", () => {
  it("parses safe project.updated messages into internal notifications", () => {
    const notification = parseProjectUpdatedMessage(
      JSON.stringify({
        type: "project.updated",
        projectId: "project_test",
        domains: ["overview", "analytics", "not-real"],
        createdAt: "2026-05-26T00:00:00.000Z",
      }),
    );

    expect(notification).toEqual({
      projectId: "project_test",
      domains: ["overview", "analytics"],
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
    });
  });

  it("rejects invalid project.updated messages", () => {
    expect(parseProjectUpdatedMessage("not-json")).toBeUndefined();
    expect(
      parseProjectUpdatedMessage(
        JSON.stringify({
          type: "project.updated",
          projectId: "project_test",
          domains: [],
          createdAt: "2026-05-26T00:00:00.000Z",
        }),
      ),
    ).toBeUndefined();
  });

  it("emits server-side project refresh notifications", () => {
    const listener = vi.fn();
    const unsubscribe = onProjectRefresh(listener);

    emitProjectRefresh({
      projectId: "project_test",
      domains: ["overview"],
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
    });
    unsubscribe();
    emitProjectRefresh({
      projectId: "project_test",
      domains: ["analytics"],
      createdAt: new Date("2026-05-26T00:01:00.000Z"),
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      projectId: "project_test",
      domains: ["overview"],
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
    });
  });

  it("subscribes to Redis project.updated messages server-side", async () => {
    let handler: ((message: string) => void | Promise<void>) | undefined;
    const client = {
      subscribe: vi.fn().mockImplementation(async (_channel, nextHandler) => {
        handler = nextHandler;
        return {
          close: vi.fn().mockResolvedValue(undefined),
        };
      }),
    };
    const listener = vi.fn();
    const unsubscribe = onProjectRefresh(listener);

    const subscription = await startProjectRefreshSubscription({
      client,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    await handler?.(
      JSON.stringify({
        type: "project.updated",
        projectId: "project_test",
        domains: ["overview", "runs"],
        createdAt: "2026-05-26T00:00:00.000Z",
      }),
    );

    expect(subscription).toBeDefined();
    expect(client.subscribe).toHaveBeenCalledWith(
      "openstat:project.updated",
      expect.any(Function),
    );
    expect(listener).toHaveBeenCalledWith({
      projectId: "project_test",
      domains: ["overview", "runs"],
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
    });

    unsubscribe();
    await subscription?.close();
  });
});
