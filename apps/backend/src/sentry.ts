import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";

import { env } from "./config/env.js";

const sensitiveKeyPattern =
  /api[_-]?key|authorization|cookie|password|secret|token|prompt|tool[_-]?(args|arguments|result|output)|raw[_-]?(payload|order)|account[_-]?(id|number)|order[_-]?payload/iu;

export const isSentryEnabled = Boolean(env.sentryDsn);

if (isSentryEnabled) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    release: env.sentryRelease,
    tracesSampleRate: env.sentryTracesSampleRate,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!isSentryEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context ?? {})) {
      scope.setContext(key, getSentryContext(value));
    }

    Sentry.captureException(error);
  });
}

export async function flushSentry(timeoutMs = 2_000) {
  if (isSentryEnabled) {
    await Sentry.flush(timeoutMs);
  }
}

function scrubSentryEvent(event: ErrorEvent) {
  return scrubValue(event) as ErrorEvent;
}

function getSentryContext(value: unknown) {
  const scrubbed = scrubValue(value);

  if (scrubbed && typeof scrubbed === "object" && !Array.isArray(scrubbed)) {
    return scrubbed as Record<string, unknown>;
  }

  return { value: scrubbed };
}

function scrubValue(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return "[Filtered]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, key));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        scrubValue(entryValue, entryKey),
      ]),
    );
  }

  if (typeof value === "string" && /ostat_[a-z0-9._-]+/iu.test(value)) {
    return value.replace(/ostat_[a-z0-9._-]+/giu, "ostat_[Filtered]");
  }

  return value;
}
