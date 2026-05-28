import { schema } from "@openstat/db";
import {
  otlpLogSignalSchema,
  otlpMetricSignalSchema,
  otlpSpanSignalSchema,
} from "@openstat/schemas";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";

import { authenticateIngestionScope } from "../auth-scope.js";
import { database } from "../context.js";
import { bearerSecurity, errorResponseSchema } from "../openapi/schemas.js";

type OtlpSignalKind = "logs" | "metrics" | "traces";
type UnknownRecord = Record<string, unknown>;

type ParsedOtlpSpan = z.infer<typeof otlpSpanSignalSchema>;
type ParsedOtlpLog = z.infer<typeof otlpLogSignalSchema>;
type ParsedOtlpMetric = z.infer<typeof otlpMetricSignalSchema>;
type ParsedOtlpSignal = ParsedOtlpLog | ParsedOtlpMetric | ParsedOtlpSpan;
type ParseResult<T> = {
  errorMessage?: string;
  items: T[];
  malformed?: boolean;
  rejected: number;
};
type SafeParseResult<T> =
  | { data: T; success: true }
  | { error: ZodError; success: false };

const otlpJsonContentType = "application/json";
const otlpProtobufContentType = "application/x-protobuf";

export async function registerOtlpRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    otlpProtobufContentType,
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  registerOtlpRoute(app, "traces", "/v1/traces");
  registerOtlpRoute(app, "logs", "/v1/logs");
  registerOtlpRoute(app, "metrics", "/v1/metrics");
}

function registerOtlpRoute(
  app: FastifyInstance,
  kind: OtlpSignalKind,
  path: string,
) {
  app.post(
    path,
    {
      schema: {
        tags: ["Agents", "Ingestion"],
        summary: `Ingest OTLP/HTTP ${kind}`,
        description:
          "Accepts OTLP/HTTP protobuf and JSON protobuf payloads authenticated with an OpenStat ingestion API key.",
        consumes: [otlpProtobufContentType, otlpJsonContentType],
        security: bearerSecurity,
        response: {
          200: otlpSuccessResponseSchema(kind),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          415: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const auth = await authenticateIngestionScope(
        request.headers.authorization,
      );
      const parsed = parseOtlpPayload(kind, request.body);
      const acceptedCount = parsed.items.length;

      if (acceptedCount === 0 && parsed.rejected === 0) {
        return reply.status(400).send({
          error: {
            code: "EMPTY_OTLP_REQUEST",
            message: "OTLP request did not contain any supported signals.",
            requestId: request.id,
          },
        });
      }

      if (acceptedCount === 0 && parsed.malformed) {
        return reply.status(400).send({
          error: {
            code: "MALFORMED_OTLP_PAYLOAD",
            message: parsed.errorMessage ?? "Malformed OTLP payload.",
            requestId: request.id,
          },
        });
      }

      if (acceptedCount > 0) {
        await insertOtlpSignals({
          auth,
          kind,
          requestId: request.id,
          signals: parsed.items,
        });
      }

      return reply.send(
        otlpResponse(kind, parsed.rejected, parsed.errorMessage),
      );
    },
  );
}

function parseOtlpPayload(
  kind: OtlpSignalKind,
  body: unknown,
): ParseResult<ParsedOtlpSignal> {
  if (Buffer.isBuffer(body)) {
    return parseProtobufOtlpPayload(kind, body);
  }

  if (!isRecord(body)) {
    return {
      errorMessage: "OTLP JSON body must be an object.",
      items: [],
      rejected: 1,
    };
  }

  return parseJsonOtlpPayload(kind, body);
}

function parseJsonOtlpPayload(
  kind: OtlpSignalKind,
  body: UnknownRecord,
): ParseResult<ParsedOtlpSignal> {
  switch (kind) {
    case "traces":
      return collectSignals<ParsedOtlpSpan>(
        jsonSpans(body).map((span) => otlpSpanSignalSchema.safeParse(span)),
      );
    case "logs":
      return collectSignals<ParsedOtlpLog>(
        jsonLogs(body).map((log) => otlpLogSignalSchema.safeParse(log)),
      );
    case "metrics":
      return collectSignals<ParsedOtlpMetric>(
        jsonMetrics(body).map((metric) =>
          otlpMetricSignalSchema.safeParse(metric),
        ),
      );
  }
}

function parseProtobufOtlpPayload(
  kind: OtlpSignalKind,
  body: Buffer,
): ParseResult<ParsedOtlpSignal> {
  try {
    switch (kind) {
      case "traces":
        return collectSignals<ParsedOtlpSpan>(
          protobufSpans(body).map((span) =>
            otlpSpanSignalSchema.safeParse(span),
          ),
        );
      case "logs":
        return collectSignals<ParsedOtlpLog>(
          protobufLogs(body).map((log) => otlpLogSignalSchema.safeParse(log)),
        );
      case "metrics":
        return collectSignals<ParsedOtlpMetric>(
          protobufMetrics(body).map((metric) =>
            otlpMetricSignalSchema.safeParse(metric),
          ),
        );
    }
  } catch (error) {
    return {
      errorMessage:
        error instanceof Error ? error.message : "Malformed protobuf payload.",
      items: [],
      malformed: true,
      rejected: 1,
    };
  }
}

function collectSignals<T>(results: Array<SafeParseResult<T>>): ParseResult<T> {
  const items: T[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.success) {
      items.push(result.data as T);
    } else {
      errors.push(formatZodError(result.error));
    }
  }

  return {
    errorMessage: errors[0],
    items,
    rejected: errors.length,
  };
}

async function insertOtlpSignals(options: {
  auth: { apiKeyId: string; organizationId: string; projectId: string };
  kind: OtlpSignalKind;
  requestId: string;
  signals: ParsedOtlpSignal[];
}) {
  const [batch] = await database.db
    .insert(schema.ingestionBatches)
    .values({
      acceptedCount: options.signals.length,
      apiKeyId: options.auth.apiKeyId,
      eventCount: options.signals.length,
      metadata: { otlpSignal: options.kind },
      organizationId: options.auth.organizationId,
      processedAt: new Date(),
      projectId: options.auth.projectId,
      rejectedCount: 0,
      requestId: options.requestId,
      source: "otel",
      status: "processed",
    })
    .returning({ id: schema.ingestionBatches.id });

  if (!batch) {
    throw new Error("Failed to create OTLP ingestion batch.");
  }

  switch (options.kind) {
    case "traces":
      await database.db.insert(schema.otelSpans).values(
        (options.signals as ParsedOtlpSpan[]).map((span) => ({
          attributes: span.attributes,
          endedAt: toDate(span.ended_at),
          kind: span.kind,
          name: span.name,
          parentSpanId: span.parent_span_id,
          projectId: options.auth.projectId,
          resource: span.resource,
          spanId: span.span_id,
          startedAt: toRequiredDate(span.started_at),
          traceId: span.trace_id,
        })),
      );
      break;
    case "logs":
      await database.db.insert(schema.otelLogs).values(
        (options.signals as ParsedOtlpLog[]).map((log) => ({
          attributes: log.attributes,
          body: log.body,
          observedAt: toRequiredDate(log.observed_at),
          projectId: options.auth.projectId,
          severityText: log.severity_text,
          spanId: log.span_id,
          traceId: log.trace_id,
        })),
      );
      break;
    case "metrics":
      await database.db.insert(schema.otelMetrics).values(
        (options.signals as ParsedOtlpMetric[]).map((metric) => ({
          attributes: metric.attributes,
          kind: metric.kind,
          name: metric.name,
          projectId: options.auth.projectId,
          recordedAt: toRequiredDate(metric.recorded_at),
          unit: metric.unit,
          value:
            metric.value === undefined ? undefined : String(metric.value),
        })),
      );
      break;
  }
}

function jsonSpans(body: UnknownRecord) {
  const spans: unknown[] = [];

  for (const resourceSpan of getArray(body.resourceSpans)) {
    const resource = jsonResource(getRecord(resourceSpan)?.resource);

    for (const scopeSpan of getArray(getRecord(resourceSpan)?.scopeSpans)) {
      for (const span of getArray(getRecord(scopeSpan)?.spans)) {
        const record = getRecord(span);

        if (!record) {
          continue;
        }

        spans.push({
          attributes: jsonAttributes(record.attributes),
          ended_at: nanoToMillis(record.endTimeUnixNano),
          kind: enumName(record.kind),
          name: stringValue(record.name),
          parent_span_id: bytesToHex(record.parentSpanId),
          resource,
          span_id: bytesToHex(record.spanId),
          started_at: nanoToMillis(record.startTimeUnixNano),
          trace_id: bytesToHex(record.traceId),
        });
      }
    }
  }

  return spans;
}

function jsonLogs(body: UnknownRecord) {
  const logs: unknown[] = [];

  for (const resourceLog of getArray(body.resourceLogs)) {
    const resource = jsonResource(getRecord(resourceLog)?.resource);

    for (const scopeLog of getArray(getRecord(resourceLog)?.scopeLogs)) {
      for (const log of getArray(getRecord(scopeLog)?.logRecords)) {
        const record = getRecord(log);

        if (!record) {
          continue;
        }

        logs.push({
          attributes: jsonAttributes(record.attributes),
          body: jsonAnyValue(record.body),
          observed_at: nanoToMillis(
            record.observedTimeUnixNano ?? record.timeUnixNano,
          ),
          resource,
          severity_text: stringValue(record.severityText),
          span_id: bytesToHex(record.spanId),
          trace_id: bytesToHex(record.traceId),
        });
      }
    }
  }

  return logs;
}

function jsonMetrics(body: UnknownRecord) {
  const metrics: unknown[] = [];

  for (const resourceMetric of getArray(body.resourceMetrics)) {
    const resource = jsonResource(getRecord(resourceMetric)?.resource);

    for (const scopeMetric of getArray(getRecord(resourceMetric)?.scopeMetrics)) {
      for (const metric of getArray(getRecord(scopeMetric)?.metrics)) {
        const record = getRecord(metric);

        if (!record) {
          continue;
        }

        metrics.push(...jsonMetricPoints(record, resource));
      }
    }
  }

  return metrics;
}

function jsonMetricPoints(metric: UnknownRecord, resource: UnknownRecord) {
  const name = stringValue(metric.name);
  const unit = stringValue(metric.unit);
  const points: unknown[] = [];

  for (const [kind, data] of [
    ["gauge", metric.gauge],
    ["sum", metric.sum],
  ] as const) {
    for (const point of getArray(getRecord(data)?.dataPoints)) {
      const record = getRecord(point);

      if (!record) {
        continue;
      }

      points.push({
        attributes: jsonAttributes(record.attributes),
        kind,
        name,
        recorded_at: nanoToMillis(record.timeUnixNano),
        resource,
        unit,
        value: metricPointValue(record),
      });
    }
  }

  return points;
}

function protobufSpans(body: Buffer) {
  const spans: unknown[] = [];

  for (const resourceSpan of readFields(body).filter((field) => field.no === 1)) {
    const resourceSpanFields = readMessage(resourceSpan);
    const resource = protobufResource(resourceSpanFields.find((field) => field.no === 1));

    for (const scopeSpan of resourceSpanFields.filter((field) => field.no === 2)) {
      for (const span of readMessage(scopeSpan).filter((field) => field.no === 2)) {
        const fields = readMessage(span);

        spans.push({
          attributes: protobufAttributes(fields.filter((field) => field.no === 9)),
          ended_at: fixedNanoToMillis(fields.find((field) => field.no === 8)),
          kind: stringValue(fields.find((field) => field.no === 6)?.value),
          name: protobufString(fields.find((field) => field.no === 5)),
          parent_span_id: protobufBytesHex(fields.find((field) => field.no === 4)),
          resource,
          span_id: protobufBytesHex(fields.find((field) => field.no === 2)),
          started_at: fixedNanoToMillis(fields.find((field) => field.no === 7)),
          trace_id: protobufBytesHex(fields.find((field) => field.no === 1)),
        });
      }
    }
  }

  return spans;
}

function protobufLogs(body: Buffer) {
  const logs: unknown[] = [];

  for (const resourceLog of readFields(body).filter((field) => field.no === 1)) {
    const resourceLogFields = readMessage(resourceLog);
    const resource = protobufResource(resourceLogFields.find((field) => field.no === 1));

    for (const scopeLog of resourceLogFields.filter((field) => field.no === 2)) {
      for (const log of readMessage(scopeLog).filter((field) => field.no === 2)) {
        const fields = readMessage(log);

        logs.push({
          attributes: protobufAttributes(fields.filter((field) => field.no === 6)),
          body: protobufAnyValue(fields.find((field) => field.no === 5)),
          observed_at:
            fixedNanoToMillis(fields.find((field) => field.no === 11)) ??
            fixedNanoToMillis(fields.find((field) => field.no === 1)),
          resource,
          severity_text: protobufString(fields.find((field) => field.no === 3)),
          span_id: protobufBytesHex(fields.find((field) => field.no === 10)),
          trace_id: protobufBytesHex(fields.find((field) => field.no === 9)),
        });
      }
    }
  }

  return logs;
}

function protobufMetrics(body: Buffer) {
  const metrics: unknown[] = [];

  for (const resourceMetric of readFields(body).filter((field) => field.no === 1)) {
    const resourceMetricFields = readMessage(resourceMetric);
    const resource = protobufResource(
      resourceMetricFields.find((field) => field.no === 1),
    );

    for (const scopeMetric of resourceMetricFields.filter((field) => field.no === 2)) {
      for (const metric of readMessage(scopeMetric).filter((field) => field.no === 2)) {
        metrics.push(...protobufMetricPoints(readMessage(metric), resource));
      }
    }
  }

  return metrics;
}

function protobufMetricPoints(fields: ProtobufField[], resource: UnknownRecord) {
  const name = protobufString(fields.find((field) => field.no === 1));
  const unit = protobufString(fields.find((field) => field.no === 3));
  const points: unknown[] = [];

  for (const [kind, no] of [
    ["gauge", 5],
    ["sum", 7],
  ] as const) {
    const data = fields.find((field) => field.no === no);

    if (!data) {
      continue;
    }

    for (const point of readMessage(data).filter((field) => field.no === 1)) {
      const pointFields = readMessage(point);

      points.push({
        attributes: protobufAttributes(
          pointFields.filter((field) => field.no === 7),
        ),
        kind,
        name,
        recorded_at: fixedNanoToMillis(
          pointFields.find((field) => field.no === 3),
        ),
        resource,
        unit,
        value:
          protobufNumber(pointFields.find((field) => field.no === 4)) ??
          protobufNumber(pointFields.find((field) => field.no === 6)),
      });
    }
  }

  return points;
}

type ProtobufField = {
  no: number;
  value: Buffer | bigint | number;
  wire: number;
};

function readFields(buffer: Buffer): ProtobufField[] {
  const fields: ProtobufField[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;

    const no = Number(tag.value >> 3n);
    const wire = Number(tag.value & 0x07n);

    if (wire === 0) {
      const value = readVarint(buffer, offset);
      fields.push({ no, value: value.value, wire });
      offset = value.offset;
    } else if (wire === 1) {
      fields.push({ no, value: buffer.readBigUInt64LE(offset), wire });
      offset += 8;
    } else if (wire === 2) {
      const size = readVarint(buffer, offset);
      offset = size.offset;
      const end = offset + Number(size.value);
      fields.push({ no, value: buffer.subarray(offset, end), wire });
      offset = end;
    } else if (wire === 5) {
      fields.push({ no, value: buffer.readUInt32LE(offset), wire });
      offset += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wire}.`);
    }
  }

  return fields;
}

function readVarint(buffer: Buffer, start: number) {
  let offset = start;
  let shift = 0n;
  let value = 0n;

  while (offset < buffer.length) {
    const byte = buffer[offset];
    if (byte === undefined) {
      break;
    }
    value |= BigInt(byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return { offset, value };
    }

    shift += 7n;
  }

  throw new Error("Malformed protobuf varint.");
}

function toDate(timestampMillis: number | undefined) {
  return timestampMillis === undefined ? undefined : new Date(timestampMillis);
}

function toRequiredDate(timestampMillis: number) {
  return new Date(timestampMillis);
}

function readMessage(field: ProtobufField | undefined) {
  return Buffer.isBuffer(field?.value) ? readFields(field.value) : [];
}

function protobufResource(field: ProtobufField | undefined) {
  return protobufAttributes(readMessage(field).filter((child) => child.no === 1));
}

function protobufAttributes(fields: ProtobufField[]) {
  const attributes: UnknownRecord = {};

  for (const field of fields) {
    const keyValue = readMessage(field);
    const key = protobufString(keyValue.find((child) => child.no === 1));

    if (key) {
      attributes[key] = protobufAnyValue(keyValue.find((child) => child.no === 2));
    }
  }

  return attributes;
}

function protobufAnyValue(field: ProtobufField | undefined): unknown {
  const value = readMessage(field);
  const stringField = value.find((child) => child.no === 1);
  const boolField = value.find((child) => child.no === 2);
  const intField = value.find((child) => child.no === 3);
  const doubleField = value.find((child) => child.no === 4);
  const bytesField = value.find((child) => child.no === 7);

  if (stringField) {
    return protobufString(stringField);
  }

  if (boolField && typeof boolField.value === "bigint") {
    return boolField.value === 1n;
  }

  if (intField && typeof intField.value === "bigint") {
    return intField.value.toString();
  }

  if (doubleField && typeof doubleField.value === "bigint") {
    return Number(doubleField.value);
  }

  if (bytesField && Buffer.isBuffer(bytesField.value)) {
    return bytesField.value.toString("base64");
  }

  return undefined;
}

function protobufString(field: ProtobufField | undefined) {
  return Buffer.isBuffer(field?.value) ? field.value.toString("utf8") : undefined;
}

function protobufBytesHex(field: ProtobufField | undefined) {
  return Buffer.isBuffer(field?.value) && field.value.length > 0
    ? field.value.toString("hex")
    : undefined;
}

function fixedNanoToMillis(field: ProtobufField | undefined) {
  return typeof field?.value === "bigint"
    ? Number(field.value / 1_000_000n)
    : undefined;
}

function protobufNumber(field: ProtobufField | undefined) {
  if (typeof field?.value === "bigint") {
    return field.value.toString();
  }

  if (typeof field?.value === "number") {
    return String(field.value);
  }

  return undefined;
}

function jsonAttributes(value: unknown) {
  const attributes: UnknownRecord = {};

  for (const attribute of getArray(value)) {
    const record = getRecord(attribute);
    const key = stringValue(record?.key);

    if (key) {
      attributes[key] = jsonAnyValue(record?.value);
    }
  }

  return attributes;
}

function jsonResource(value: unknown) {
  return jsonAttributes(getRecord(value)?.attributes);
}

function jsonAnyValue(value: unknown): unknown {
  const record = getRecord(value);

  if (!record) {
    return value;
  }

  if ("stringValue" in record) return record.stringValue;
  if ("boolValue" in record) return record.boolValue;
  if ("intValue" in record) return record.intValue;
  if ("doubleValue" in record) return record.doubleValue;
  if ("bytesValue" in record) return record.bytesValue;
  if ("arrayValue" in record) {
    return getArray(getRecord(record.arrayValue)?.values).map(jsonAnyValue);
  }
  if ("kvlistValue" in record) {
    return jsonAttributes(getRecord(record.kvlistValue)?.values);
  }

  return undefined;
}

function bytesToHex(value: unknown) {
  const text = stringValue(value);

  if (!text) {
    return undefined;
  }

  if (/^[\da-f]+$/iu.test(text)) {
    return text.toLowerCase();
  }

  return Buffer.from(text, "base64").toString("hex");
}

function nanoToMillis(value: unknown) {
  const text = stringValue(value);

  if (!text) {
    return undefined;
  }

  return Number(BigInt(text) / 1_000_000n);
}

function metricPointValue(value: UnknownRecord) {
  return stringValue(value.asDouble ?? value.asInt);
}

function enumName(value: unknown) {
  return stringValue(value);
}

function getRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}

function otlpResponse(
  kind: OtlpSignalKind,
  rejected: number,
  errorMessage: string | undefined,
) {
  const partialSuccess = { errorMessage: errorMessage ?? "" };

  if (kind === "traces") {
    return { partialSuccess: { ...partialSuccess, rejectedSpans: rejected } };
  }

  if (kind === "logs") {
    return {
      partialSuccess: { ...partialSuccess, rejectedLogRecords: rejected },
    };
  }

  return {
    partialSuccess: { ...partialSuccess, rejectedDataPoints: rejected },
  };
}

function otlpSuccessResponseSchema(kind: OtlpSignalKind) {
  const rejectedKey =
    kind === "traces"
      ? "rejectedSpans"
      : kind === "logs"
        ? "rejectedLogRecords"
        : "rejectedDataPoints";

  return {
    type: "object",
    properties: {
      partialSuccess: {
        type: "object",
        properties: {
          errorMessage: { type: "string" },
          [rejectedKey]: { type: "integer" },
        },
      },
    },
  } as const;
}

function formatZodError(error: ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "signal"}: ${issue.message}`)
    .join("; ");
}
