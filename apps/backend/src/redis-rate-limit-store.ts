import { REDIS_KEYS, type IngestionSignalClient } from "@openstat/ingestion";

import {
  recordRateLimitError,
  recordRateLimitIncrement,
} from "./redis-telemetry.js";

type RateLimitCallback = (
  error: Error | null,
  result?: { current: number; ttl: number },
) => void;

type RedisRateLimitClient = Pick<
  IngestionSignalClient,
  "incrementRateLimitCounter"
>;

export function createRedisRateLimitStore(client: RedisRateLimitClient) {
  return class RedisRateLimitStore {
    readonly prefix: string;

    constructor(options: unknown = {}) {
      const routeInfo = getRouteInfo(options);

      this.prefix = routeInfo ? `${routeInfo.method}${routeInfo.url}:` : "";
    }

    child(options: unknown) {
      return new RedisRateLimitStore(options);
    }

    incr(key: string, callback: RateLimitCallback, timeWindow = 60_000): void {
      const counterKey = REDIS_KEYS.rateLimit(
        `${this.prefix}${key}`,
        timeWindow,
      );

      client
        .incrementRateLimitCounter(counterKey, timeWindow)
        .then((result) => {
          recordRateLimitIncrement();
          callback(null, result);
        })
        .catch((error: Error) => {
          recordRateLimitError();
          callback(error);
        });
    }
  };
}

function getRouteInfo(options: unknown) {
  if (!options || typeof options !== "object" || !("routeInfo" in options)) {
    return undefined;
  }

  const routeInfo = (options as { routeInfo?: unknown }).routeInfo;

  if (!routeInfo || typeof routeInfo !== "object") {
    return undefined;
  }

  const method = (routeInfo as { method?: unknown }).method;
  const url = (routeInfo as { url?: unknown }).url;

  if (typeof method !== "string" || typeof url !== "string") {
    return undefined;
  }

  return { method, url };
}

export function getIngestionRateLimitKey(authorization: unknown, ip: string) {
  const prefix = getApiKeyPrefix(authorization);

  if (prefix) {
    return `ingest:api-key:${prefix}`;
  }

  return `ingest:ip:${ip}`;
}

function getApiKeyPrefix(authorization: unknown) {
  if (typeof authorization !== "string") {
    return undefined;
  }

  const [scheme, token] = authorization.split(/\s+/u);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  const [keyPrefix, publicPart] = token.split("_");

  if (keyPrefix !== "ostat" || !publicPart) {
    return undefined;
  }

  return `${keyPrefix}_${publicPart}`;
}
