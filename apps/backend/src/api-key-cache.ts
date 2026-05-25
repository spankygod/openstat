import type { ApiKeyLookupCache, ApiKeyLookupRow } from "@openstat/auth";
import { REDIS_KEYS } from "@openstat/ingestion";

import { ingestionSignalClient } from "./context.js";
import {
  recordApiKeyCacheDelete,
  recordApiKeyCacheError,
  recordApiKeyCacheHit,
  recordApiKeyCacheMiss,
  recordApiKeyCacheWrite,
} from "./redis-telemetry.js";

const apiKeyLookupCacheTtlSeconds = 120;

export function getApiKeyLookupCache(): ApiKeyLookupCache | undefined {
  if (!ingestionSignalClient) {
    return undefined;
  }

  const client = ingestionSignalClient;

  return {
    async get(prefix) {
      try {
        const row = await client.getJson<ApiKeyLookupRow>(
          REDIS_KEYS.apiKeyLookup(prefix),
        );

        if (row) {
          recordApiKeyCacheHit();
        } else {
          recordApiKeyCacheMiss();
        }

        return row;
      } catch (error) {
        recordApiKeyCacheError();
        throw error;
      }
    },
    async set(prefix, row) {
      try {
        await client.setJson(
          REDIS_KEYS.apiKeyLookup(prefix),
          row,
          apiKeyLookupCacheTtlSeconds,
        );
        recordApiKeyCacheWrite();
      } catch (error) {
        recordApiKeyCacheError();
        throw error;
      }
    },
  };
}

export async function deleteApiKeyLookupCache(prefix: string) {
  try {
    await ingestionSignalClient?.delete(REDIS_KEYS.apiKeyLookup(prefix));
    recordApiKeyCacheDelete();
  } catch (error) {
    recordApiKeyCacheError();
    console.warn(
      { error, prefix },
      "Redis API key lookup cache delete failed; TTL fallback remains active",
    );
  }
}
