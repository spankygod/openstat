type RedisTelemetry = {
  apiKeyCache: {
    deletes: number;
    errors: number;
    hits: number;
    misses: number;
    writes: number;
  };
  projectCache: {
    hits: number;
    misses: number;
    readErrors: number;
    writeErrors: number;
    writes: number;
  };
  projectInvalidation: {
    deletedKeys: number;
    errors: number;
    projects: number;
  };
  projectRefresh: {
    emitted: number;
    invalidMessages: number;
    subscriptionErrors: number;
  };
  projectUpdatePublish: {
    errors: number;
    messages: number;
  };
  rateLimit: {
    errors: number;
    increments: number;
  };
  wakeups: {
    invalidMessages: number;
    lastLatencyMs: number | null;
    maxLatencyMs: number | null;
    messages: number;
  };
};

const redisTelemetry: RedisTelemetry = {
  apiKeyCache: {
    deletes: 0,
    errors: 0,
    hits: 0,
    misses: 0,
    writes: 0,
  },
  projectCache: {
    hits: 0,
    misses: 0,
    readErrors: 0,
    writeErrors: 0,
    writes: 0,
  },
  projectInvalidation: {
    deletedKeys: 0,
    errors: 0,
    projects: 0,
  },
  projectRefresh: {
    emitted: 0,
    invalidMessages: 0,
    subscriptionErrors: 0,
  },
  projectUpdatePublish: {
    errors: 0,
    messages: 0,
  },
  rateLimit: {
    errors: 0,
    increments: 0,
  },
  wakeups: {
    invalidMessages: 0,
    lastLatencyMs: null,
    maxLatencyMs: null,
    messages: 0,
  },
};

export function getRedisTelemetrySnapshot() {
  return structuredClone(redisTelemetry);
}

export function recordApiKeyCacheDelete() {
  redisTelemetry.apiKeyCache.deletes += 1;
}

export function recordApiKeyCacheError() {
  redisTelemetry.apiKeyCache.errors += 1;
}

export function recordApiKeyCacheHit() {
  redisTelemetry.apiKeyCache.hits += 1;
}

export function recordApiKeyCacheMiss() {
  redisTelemetry.apiKeyCache.misses += 1;
}

export function recordApiKeyCacheWrite() {
  redisTelemetry.apiKeyCache.writes += 1;
}

export function recordProjectCacheHit() {
  redisTelemetry.projectCache.hits += 1;
}

export function recordProjectCacheMiss() {
  redisTelemetry.projectCache.misses += 1;
}

export function recordProjectCacheReadError() {
  redisTelemetry.projectCache.readErrors += 1;
}

export function recordProjectCacheWrite() {
  redisTelemetry.projectCache.writes += 1;
}

export function recordProjectCacheWriteError() {
  redisTelemetry.projectCache.writeErrors += 1;
}

export function recordProjectInvalidation(deletedKeys: number) {
  redisTelemetry.projectInvalidation.deletedKeys += deletedKeys;
  redisTelemetry.projectInvalidation.projects += 1;
}

export function recordProjectInvalidationError() {
  redisTelemetry.projectInvalidation.errors += 1;
}

export function recordProjectRefreshEmitted() {
  redisTelemetry.projectRefresh.emitted += 1;
}

export function recordProjectRefreshInvalidMessage() {
  redisTelemetry.projectRefresh.invalidMessages += 1;
}

export function recordProjectRefreshSubscriptionError() {
  redisTelemetry.projectRefresh.subscriptionErrors += 1;
}

export function recordProjectUpdatePublish() {
  redisTelemetry.projectUpdatePublish.messages += 1;
}

export function recordProjectUpdatePublishError() {
  redisTelemetry.projectUpdatePublish.errors += 1;
}

export function recordRateLimitError() {
  redisTelemetry.rateLimit.errors += 1;
}

export function recordRateLimitIncrement() {
  redisTelemetry.rateLimit.increments += 1;
}

export function recordWakeupInvalidMessage() {
  redisTelemetry.wakeups.invalidMessages += 1;
}

export function recordWakeupMessage(latencyMs: number | undefined) {
  redisTelemetry.wakeups.messages += 1;

  if (latencyMs === undefined) {
    return;
  }

  redisTelemetry.wakeups.lastLatencyMs = latencyMs;
  redisTelemetry.wakeups.maxLatencyMs =
    redisTelemetry.wakeups.maxLatencyMs === null
      ? latencyMs
      : Math.max(redisTelemetry.wakeups.maxLatencyMs, latencyMs);
}
