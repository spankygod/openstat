import type { ErrorEvent } from "@sentry/nextjs";

const sensitiveKeyPattern =
  /api[_-]?key|authorization|cookie|password|secret|token|prompt|tool[_-]?(args|arguments|result|output)|raw[_-]?(payload|order)|account[_-]?(id|number)|order[_-]?payload/iu;

export function scrubSentryEvent(event: ErrorEvent) {
  return scrubValue(event) as ErrorEvent;
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
