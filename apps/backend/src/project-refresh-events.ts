import {
  DEFAULT_PROJECT_CACHE_DOMAINS,
  REDIS_CHANNELS,
  type IngestionSignalClient,
  type IngestionSignalSubscription,
  type ProjectCacheDomain,
} from "@openstat/ingestion";
import { EventEmitter } from "node:events";

export type ProjectRefreshNotification = {
  projectId: string;
  domains: ProjectCacheDomain[];
  createdAt: Date;
};

type ProjectRefreshLogger = Pick<Console, "info" | "warn">;

const projectRefreshEmitter = new EventEmitter();

export function onProjectRefresh(
  listener: (notification: ProjectRefreshNotification) => void,
) {
  projectRefreshEmitter.on("project.refresh", listener);

  return () => {
    projectRefreshEmitter.off("project.refresh", listener);
  };
}

export function emitProjectRefresh(notification: ProjectRefreshNotification) {
  projectRefreshEmitter.emit("project.refresh", notification);
}

export async function startProjectRefreshSubscription(options: {
  client: Pick<IngestionSignalClient, "subscribe"> | undefined;
  logger?: ProjectRefreshLogger;
}): Promise<IngestionSignalSubscription | undefined> {
  if (!options.client) {
    return undefined;
  }

  const logger = options.logger ?? console;

  try {
    return await options.client.subscribe(
      REDIS_CHANNELS.projectUpdated,
      (message) => {
        const notification = parseProjectUpdatedMessage(message);

        if (!notification) {
          logger.warn(
            { channel: REDIS_CHANNELS.projectUpdated },
            "Ignoring invalid Redis project refresh message",
          );
          return;
        }

        emitProjectRefresh(notification);
      },
    );
  } catch (error) {
    logger.warn(
      { error },
      "Redis project refresh subscription failed; API reads remain available",
    );
    return undefined;
  }
}

export function parseProjectUpdatedMessage(
  message: string,
): ProjectRefreshNotification | undefined {
  try {
    const parsed = JSON.parse(message) as {
      createdAt?: unknown;
      domains?: unknown;
      projectId?: unknown;
      type?: unknown;
    };

    if (
      parsed.type !== "project.updated" ||
      typeof parsed.projectId !== "string" ||
      !Array.isArray(parsed.domains) ||
      typeof parsed.createdAt !== "string"
    ) {
      return undefined;
    }

    const domains = parsed.domains.filter(
      (domain): domain is ProjectCacheDomain =>
        typeof domain === "string" &&
        DEFAULT_PROJECT_CACHE_DOMAINS.includes(domain as ProjectCacheDomain),
    );
    const createdAt = new Date(parsed.createdAt);

    if (domains.length === 0 || Number.isNaN(createdAt.valueOf())) {
      return undefined;
    }

    return {
      projectId: parsed.projectId,
      domains,
      createdAt,
    };
  } catch {
    return undefined;
  }
}
