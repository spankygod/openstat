import { z } from "zod";

const jsonObjectSchema = z.object({}).catchall(z.unknown()).default({});
const decimalInputSchema = z.union([z.string().min(1), z.number().finite()]);
const timestampMillisSchema = z.number().int().positive();

export const normalizedEventTypeSchema = z.enum([
  "decision",
  "risk_check",
  "order",
  "fill",
  "position",
  "pnl_snapshot",
  "heartbeat",
  "error",
  "completion",
]);

export const tradingSideSchema = z.enum(["buy", "sell"]);
export const orderTypeSchema = z.enum([
  "market",
  "limit",
  "stop",
  "stop_limit",
]);
export const orderStatusSchema = z.enum([
  "pending",
  "submitted",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected",
  "failed",
]);
export const fillStatusSchema = z.enum(["partial", "filled", "cancelled"]);
export const riskResultSchema = z.enum(["approved", "rejected", "warn"]);
export const agentStatusSchema = z.enum([
  "online",
  "stale",
  "offline",
  "failing",
  "unknown",
]);

export const agentInputSchema = z
  .object({
    id: z.string().min(1).max(160).optional(),
    name: z.string().min(1).max(160).optional(),
    tags: z.array(z.string().min(1).max(64)).max(50).optional(),
  })
  .optional();

export const tradingIdentitySchema = z.object({
  strategy: z.string().min(1).max(160).optional(),
  symbol: z.string().min(1).max(64),
  venue: z.string().min(1).max(80).optional(),
});

export const decisionDataSchema = tradingIdentitySchema.extend({
  action: z.string().min(1).max(80),
  confidence: z.number().int().min(0).max(100).optional(),
  rationale_summary: z.string().max(2000).optional(),
});

export const riskCheckDataSchema = z.object({
  decision_id: z.string().min(1).max(160).optional(),
  result: riskResultSchema,
  reason: z.string().max(2000).optional(),
});

export const orderDataSchema = tradingIdentitySchema.extend({
  order_id: z.string().min(1).max(160).optional(),
  decision_id: z.string().min(1).max(160).optional(),
  side: tradingSideSchema,
  order_type: orderTypeSchema,
  quantity: decimalInputSchema,
  price: decimalInputSchema.optional(),
  status: orderStatusSchema.default("pending"),
});

export const fillDataSchema = tradingIdentitySchema.extend({
  fill_id: z.string().min(1).max(160).optional(),
  order_id: z.string().min(1).max(160).optional(),
  side: tradingSideSchema,
  quantity: decimalInputSchema,
  price: decimalInputSchema,
  fee: decimalInputSchema.optional(),
  status: fillStatusSchema.default("filled"),
});

export const positionDataSchema = tradingIdentitySchema.extend({
  quantity: decimalInputSchema,
  average_price: decimalInputSchema.optional(),
});

export const pnlSnapshotDataSchema = z.object({
  strategy: z.string().min(1).max(160).optional(),
  symbol: z.string().min(1).max(64).optional(),
  realized_pnl: decimalInputSchema.optional(),
  unrealized_pnl: decimalInputSchema.optional(),
  equity: decimalInputSchema.optional(),
});

export const heartbeatDataSchema = z.object({
  status: agentStatusSchema.default("online"),
  expected_check_in_seconds: z.number().int().positive().optional(),
  summary: z.string().max(2000).optional(),
});

export const completionDataSchema = z.object({
  provider: z.string().min(1).max(80).optional(),
  model: z.string().min(1).max(160).optional(),
  status: z.string().min(1).max(80).optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  summary: z.string().max(4000).optional(),
});

export const errorDataSchema = z.object({
  code: z.string().min(1).max(160).optional(),
  message: z.string().min(1).max(4000),
  retryable: z.boolean().optional(),
});

export const normalizedEventDataSchemas = {
  completion: completionDataSchema,
  decision: decisionDataSchema,
  error: errorDataSchema,
  fill: fillDataSchema,
  heartbeat: heartbeatDataSchema,
  order: orderDataSchema,
  pnl_snapshot: pnlSnapshotDataSchema,
  position: positionDataSchema,
  risk_check: riskCheckDataSchema,
} as const;

export const ingestEventInputSchema = z
  .object({
    id: z.string().min(1).max(160).optional(),
    schema_version: z.literal(1).default(1),
    agent: agentInputSchema,
    project_id: z.uuid().optional(),
    type: normalizedEventTypeSchema,
    data: jsonObjectSchema,
    timestamp: timestampMillisSchema.optional(),
    trace_id: z.string().min(1).max(160).optional(),
    span_id: z.string().min(1).max(160).optional(),
    run_id: z.string().min(1).max(160).optional(),
    tags: z.array(z.string().min(1).max(64)).max(50).optional(),
    metadata: jsonObjectSchema,
  })
  .superRefine((event, context) => {
    const dataSchema = normalizedEventDataSchemas[event.type];
    const result = dataSchema.safeParse(event.data);

    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          ...issue,
          path: ["data", ...issue.path],
        });
      }
    }
  });

export const heartbeatEventInputSchema = ingestEventInputSchema.safeExtend({
  type: z.literal("heartbeat"),
  data: heartbeatDataSchema,
});

export const ingestEventBatchInputSchema = z.object({
  events: z.array(ingestEventInputSchema).min(1).max(100),
});

export const otlpResourceSchema = z.object({
  attributes: jsonObjectSchema,
});

export const otlpSpanSignalSchema = z.object({
  trace_id: z.string().min(1).max(160),
  span_id: z.string().min(1).max(160),
  parent_span_id: z.string().min(1).max(160).optional(),
  name: z.string().min(1).max(300),
  kind: z.string().min(1).max(80).optional(),
  started_at: timestampMillisSchema,
  ended_at: timestampMillisSchema.optional(),
  attributes: jsonObjectSchema,
  resource: jsonObjectSchema,
});

export const otlpLogSignalSchema = z.object({
  trace_id: z.string().min(1).max(160).optional(),
  span_id: z.string().min(1).max(160).optional(),
  severity_text: z.string().min(1).max(80).optional(),
  body: z.unknown().optional(),
  observed_at: timestampMillisSchema,
  attributes: jsonObjectSchema,
  resource: jsonObjectSchema,
});

export const otlpMetricSignalSchema = z.object({
  name: z.string().min(1).max(300),
  unit: z.string().max(80).optional(),
  kind: z.string().min(1).max(80),
  value: decimalInputSchema.optional(),
  recorded_at: timestampMillisSchema,
  attributes: jsonObjectSchema,
  resource: jsonObjectSchema,
});

export const redactionPolicySchema = z.object({
  enabled: z.boolean().default(true),
  raw_capture_enabled: z.boolean().default(false),
  raw_retention_days: z.number().int().positive().max(90).default(30),
  derived_retention_days: z.number().int().positive().max(3650).default(365),
  extra_sensitive_keys: z.array(z.string().min(1).max(160)).default([]),
});

export type AgentInput = z.input<typeof agentInputSchema>;
export type IngestEventInput = z.input<typeof ingestEventInputSchema>;
export type IngestEventBatchInput = z.input<typeof ingestEventBatchInputSchema>;
export type NormalizedEventType = z.infer<typeof normalizedEventTypeSchema>;
export type RedactionPolicy = z.infer<typeof redactionPolicySchema>;
