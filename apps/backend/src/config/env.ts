import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ quiet: true });

const nodeEnvSchema = z
  .enum(["development", "test", "production"])
  .default("development");

const optionalNonEmptyString = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z.string().min(1).optional(),
);

const rawEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://openstat:openstat@localhost:5432/openstat"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  APP_WEB_URL: z.string().url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  REDIS_URL: z.string().url().optional(),
  INGESTION_MAX_BODY_BYTES: z.coerce.number().int().positive().default(1_000_000),
  INGESTION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  INGESTION_RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  DEFAULT_AGENT_STALE_SECONDS: z.coerce.number().int().positive().default(180),
  DEFAULT_AGENT_OFFLINE_SECONDS: z.coerce.number().int().positive().default(600),
});

const parsedEnv = rawEnvSchema.parse(process.env);

const fallbackSecret =
  "openstat-development-secret-change-before-production";

if (parsedEnv.NODE_ENV === "production" && !parsedEnv.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

if (Boolean(parsedEnv.GOOGLE_CLIENT_ID) !== Boolean(parsedEnv.GOOGLE_CLIENT_SECRET)) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.",
  );
}

export const env = {
  nodeEnv: parsedEnv.NODE_ENV,
  port: parsedEnv.PORT,
  host: parsedEnv.HOST,
  logLevel: parsedEnv.LOG_LEVEL,
  databaseUrl: parsedEnv.DATABASE_URL,
  betterAuthSecret: parsedEnv.BETTER_AUTH_SECRET ?? fallbackSecret,
  betterAuthUrl: parsedEnv.BETTER_AUTH_URL ?? parsedEnv.API_PUBLIC_URL,
  googleClientId: parsedEnv.GOOGLE_CLIENT_ID,
  googleClientSecret: parsedEnv.GOOGLE_CLIENT_SECRET,
  appWebUrl: parsedEnv.APP_WEB_URL,
  apiPublicUrl: parsedEnv.API_PUBLIC_URL,
  redisUrl: parsedEnv.REDIS_URL,
  ingestionMaxBodyBytes: parsedEnv.INGESTION_MAX_BODY_BYTES,
  ingestionRateLimitMax: parsedEnv.INGESTION_RATE_LIMIT_MAX,
  ingestionRateLimitWindow: parsedEnv.INGESTION_RATE_LIMIT_WINDOW,
  defaultAgentStaleSeconds: parsedEnv.DEFAULT_AGENT_STALE_SECONDS,
  defaultAgentOfflineSeconds: parsedEnv.DEFAULT_AGENT_OFFLINE_SECONDS,
} as const;
