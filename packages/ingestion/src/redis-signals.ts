import { createClient } from "redis";

export const OPENSTAT_REDIS_PREFIX = "openstat";

export const REDIS_CHANNELS = {
  ingestion: `${OPENSTAT_REDIS_PREFIX}:ingestion`,
  projectUpdated: `${OPENSTAT_REDIS_PREFIX}:project.updated`,
} as const;

export const REDIS_KEYS = {
  apiKeyLookup: (prefix: string) =>
    `${OPENSTAT_REDIS_PREFIX}:api-key:${prefix}`,
  projectAnalyticsSummary: (projectId: string, cacheKey: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:analytics:${cacheKey}`,
  projectLatestRuns: (projectId: string, cacheKey: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:runs:${cacheKey}`,
  projectLatestTrades: (projectId: string, cacheKey: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:trades:${cacheKey}`,
  projectNotifications: (projectId: string, cacheKey: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:notifications:${cacheKey}`,
  projectOverview: (projectId: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:overview`,
  projectUnreadNotifications: (projectId: string) =>
    `${OPENSTAT_REDIS_PREFIX}:project:${projectId}:notifications:unread`,
} as const;

export const DEFAULT_PROJECT_CACHE_DOMAINS = [
  "overview",
  "runs",
  "trades",
  "notifications",
  "analytics",
] as const;

export type ProjectCacheDomain = (typeof DEFAULT_PROJECT_CACHE_DOMAINS)[number];

export type IngestionWakeupMessage = {
  type: "ingestion.outbox.created";
  projectId: string;
  batchId: string;
  outboxIds: string[];
  count: number;
  source: string;
  createdAt: string;
};

export type ProjectUpdatedMessage = {
  type: "project.updated";
  projectId: string;
  domains: ProjectCacheDomain[];
  createdAt: string;
};

export interface IngestionSignalPublisher {
  publish(channel: string, message: string): Promise<void>;
}

export interface IngestionSignalSubscription {
  close(): Promise<void>;
}

export interface IngestionSignalClient extends IngestionSignalPublisher {
  close(): Promise<void>;
  delete(key: string): Promise<number>;
  deleteByPattern(pattern: string): Promise<number>;
  getJson<T>(key: string): Promise<T | undefined>;
  ping(): Promise<boolean>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  subscribe(
    channel: string,
    handler: (message: string, channel: string) => void | Promise<void>,
  ): Promise<IngestionSignalSubscription>;
}

export type IngestionSignalLogger = Pick<Console, "error" | "info" | "warn">;

type RedisClient = ReturnType<typeof createClient>;

export function createProjectUpdatedMessage(options: {
  projectId: string;
  domains?: ProjectCacheDomain[];
  createdAt?: Date;
}): ProjectUpdatedMessage {
  return {
    type: "project.updated",
    projectId: options.projectId,
    domains: options.domains ?? [...DEFAULT_PROJECT_CACHE_DOMAINS],
    createdAt: (options.createdAt ?? new Date()).toISOString(),
  };
}

export function getProjectCacheInvalidationTargets(options: {
  projectId: string;
  domains?: ProjectCacheDomain[];
}) {
  const domains = options.domains ?? DEFAULT_PROJECT_CACHE_DOMAINS;
  const keys: string[] = [];
  const patterns: string[] = [];

  for (const domain of domains) {
    switch (domain) {
      case "overview":
        keys.push(REDIS_KEYS.projectOverview(options.projectId));
        break;
      case "runs":
        patterns.push(
          `${OPENSTAT_REDIS_PREFIX}:project:${options.projectId}:runs:*`,
        );
        break;
      case "trades":
        patterns.push(
          `${OPENSTAT_REDIS_PREFIX}:project:${options.projectId}:trades:*`,
        );
        break;
      case "notifications":
        patterns.push(
          `${OPENSTAT_REDIS_PREFIX}:project:${options.projectId}:notifications:*`,
        );
        break;
      case "analytics":
        patterns.push(
          `${OPENSTAT_REDIS_PREFIX}:project:${options.projectId}:analytics:*`,
        );
        break;
    }
  }

  return { keys, patterns };
}

export async function invalidateProjectReadCaches(options: {
  client: Pick<IngestionSignalClient, "delete" | "deleteByPattern">;
  projectId: string;
  domains?: ProjectCacheDomain[];
}) {
  const targets = getProjectCacheInvalidationTargets({
    projectId: options.projectId,
    domains: options.domains,
  });
  let deleted = 0;

  for (const key of targets.keys) {
    deleted += await options.client.delete(key);
  }

  for (const pattern of targets.patterns) {
    deleted += await options.client.deleteByPattern(pattern);
  }

  return { ...targets, deleted };
}

// Redis is an acceleration layer for short-lived signals and caches only.
// Postgres remains canonical for ingestion, projections, auth, and reads.
export function createIngestionRedisClient(
  redisUrl: string | undefined,
  logger: IngestionSignalLogger = console,
): IngestionSignalClient | undefined {
  if (!redisUrl) {
    logger.info(
      "Redis signal client disabled because REDIS_URL is not configured.",
    );
    return undefined;
  }

  let publisherClient: RedisClient | undefined;
  const clients = new Set<RedisClient>();

  function makeClient(role: string) {
    const client = createClient({
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy(retries) {
          return Math.min(retries * 100, 1_000);
        },
      },
      url: redisUrl,
    });

    client.on("error", (error) => {
      logger.warn("Redis signal client error.", {
        error,
        redisRole: role,
      });
    });

    clients.add(client);
    return client;
  }

  async function getPublisherClient() {
    if (!publisherClient) {
      publisherClient = makeClient("publisher");
    }

    if (!publisherClient.isOpen) {
      await publisherClient.connect();
      logger.info("Redis ingestion signal publisher connected.");
    }

    return publisherClient;
  }

  logger.info(
    "Redis signal client configured; Postgres remains the source of truth.",
  );

  return {
    async close() {
      await Promise.all(
        [...clients].map(async (client) => {
          clients.delete(client);

          if (!client.isOpen) {
            return;
          }

          try {
            await client.quit();
          } catch (error) {
            logger.warn("Redis signal client quit failed; disconnecting.", {
              error,
            });
            client.disconnect();
          }
        }),
      );
    },
    async ping() {
      const client = await getPublisherClient();
      return (await client.ping()) === "PONG";
    },
    async delete(key) {
      const client = await getPublisherClient();
      return client.del(key);
    },
    async deleteByPattern(pattern) {
      const client = await getPublisherClient();
      let deleted = 0;

      for await (const key of client.scanIterator({
        COUNT: 100,
        MATCH: pattern,
      })) {
        deleted += await client.del(key);
      }

      return deleted;
    },
    async getJson<T>(key: string) {
      const client = await getPublisherClient();
      const value = await client.get(key);

      if (!value) {
        return undefined;
      }

      return JSON.parse(value) as T;
    },
    async publish(channel, message) {
      const client = await getPublisherClient();
      await client.publish(channel, message);
    },
    async setJson(key, value, ttlSeconds) {
      const client = await getPublisherClient();
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
    },
    async subscribe(channel, handler) {
      const subscriber = makeClient("subscriber");
      await subscriber.connect();
      await subscriber.subscribe(channel, (message, subscribedChannel) => {
        void handler(message, subscribedChannel);
      });
      logger.info("Redis ingestion signal subscriber connected.", {
        channel,
      });

      return {
        async close() {
          clients.delete(subscriber);

          if (!subscriber.isOpen) {
            return;
          }

          try {
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
          } catch (error) {
            logger.warn("Redis signal subscriber quit failed; disconnecting.", {
              channel,
              error,
            });
            subscriber.disconnect();
          }
        },
      };
    },
  };
}
