import { z } from "zod";

const jsonObjectSchema = z
  .object({})
  .catchall(z.unknown())
  .default({});

export const agentInputSchema = z
  .object({
    id: z.string().min(1).max(160).optional(),
    name: z.string().min(1).max(160).optional(),
    tags: z.array(z.string().min(1).max(64)).max(50).optional(),
  })
  .optional();

export const ingestEventInputSchema = z.object({
  id: z.string().min(1).max(160).optional(),
  schema_version: z.literal(1).default(1),
  agent: agentInputSchema,
  project_id: z.uuid().optional(),
  type: z.string().min(1).max(128),
  data: jsonObjectSchema,
  timestamp: z.number().int().positive().optional(),
  trace_id: z.string().min(1).max(160).optional(),
  span_id: z.string().min(1).max(160).optional(),
  run_id: z.string().min(1).max(160).optional(),
  tags: z.array(z.string().min(1).max(64)).max(50).optional(),
  metadata: jsonObjectSchema,
});

export const ingestEventBatchInputSchema = z.object({
  events: z.array(ingestEventInputSchema).min(1).max(100),
});

export type IngestEventInput = z.input<typeof ingestEventInputSchema>;
export type IngestEventBatchInput = z.input<typeof ingestEventBatchInputSchema>;
