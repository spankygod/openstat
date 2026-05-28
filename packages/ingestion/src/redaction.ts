import { redactionPolicySchema, type RedactionPolicy } from "@openstat/schemas";

const redacted = "[REDACTED]";
const sensitiveKeyPatterns = [
  /account.*id/iu,
  /api.*key/iu,
  /authorization/iu,
  /bearer/iu,
  /credential/iu,
  /message/i,
  /password/iu,
  /prompt/iu,
  /raw.*order/iu,
  /secret/iu,
  /token/iu,
  /tool.*args/iu,
  /tool.*arguments/iu,
  /tool.*result/iu,
];
const safeKeyPatterns = [
  /confidence/iu,
  /equity/iu,
  /fee/iu,
  /hash/iu,
  /input_tokens/iu,
  /latency/iu,
  /model/iu,
  /order_type/iu,
  /output_tokens/iu,
  /price/iu,
  /provider/iu,
  /quantity/iu,
  /rationale_summary/iu,
  /realized_pnl/iu,
  /side/iu,
  /status/iu,
  /strategy/iu,
  /summary/iu,
  /symbol/iu,
  /token_count/iu,
  /total_tokens/iu,
  /unrealized_pnl/iu,
  /usage/iu,
  /venue/iu,
];

export function redactTelemetryPayload<T>(
  payload: T,
  policyInput: Partial<RedactionPolicy> = {},
): T {
  const policy = redactionPolicySchema.parse(policyInput);

  if (!policy.enabled || policy.raw_capture_enabled) {
    return payload;
  }

  return redactValue(payload, policy.extra_sensitive_keys, []) as T;
}

function redactValue(
  value: unknown,
  extraSensitiveKeys: string[],
  path: string[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      redactValue(child, extraSensitiveKeys, [...path, String(index)]),
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const childPath = [...path, key];

      if (isSensitiveKey(key, extraSensitiveKeys) && !isSafeKey(key)) {
        return [key, redacted];
      }

      return [key, redactValue(child, extraSensitiveKeys, childPath)];
    }),
  );
}

function isSensitiveKey(key: string, extraSensitiveKeys: string[]) {
  return (
    extraSensitiveKeys.some((sensitiveKey) => sensitiveKey === key) ||
    sensitiveKeyPatterns.some((pattern) => pattern.test(key))
  );
}

function isSafeKey(key: string) {
  return safeKeyPatterns.some((pattern) => pattern.test(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
