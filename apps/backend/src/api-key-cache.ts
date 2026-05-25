import type { ApiKeyLookupCache } from "@openstat/auth";
import { REDIS_KEYS } from "@openstat/ingestion";

import { ingestionSignalClient } from "./context.js";

const apiKeyLookupCacheTtlSeconds = 120;

export function getApiKeyLookupCache(): ApiKeyLookupCache | undefined {
  if (!ingestionSignalClient) {
    return undefined;
  }

  const client = ingestionSignalClient;

  return {
    async get(prefix) {
      return client.getJson(REDIS_KEYS.apiKeyLookup(prefix));
    },
    async set(prefix, row) {
      await client.setJson(
        REDIS_KEYS.apiKeyLookup(prefix),
        row,
        apiKeyLookupCacheTtlSeconds,
      );
    },
  };
}

export async function deleteApiKeyLookupCache(prefix: string) {
  try {
    await ingestionSignalClient?.delete(REDIS_KEYS.apiKeyLookup(prefix));
  } catch (error) {
    console.warn(
      { error, prefix },
      "Redis API key lookup cache delete failed; TTL fallback remains active",
    );
  }
}
