CREATE TYPE "public"."agent_mode" AS ENUM('long_running', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('online', 'stale', 'offline', 'failing', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('sdk', 'http', 'webhook', 'otel', 'system');--> statement-breakpoint
CREATE TYPE "public"."ingestion_batch_status" AS ENUM('accepted', 'processing', 'processed', 'partially_processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_outbox_status" AS ENUM('pending', 'processing', 'processed', 'retryable', 'dead_lettered');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."trading_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid,
	"external_run_id" text,
	"strategy" text,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"status" "agent_status" DEFAULT 'unknown' NOT NULL,
	"mode" "agent_mode" DEFAULT 'long_running' NOT NULL,
	"expected_check_in_seconds" integer,
	"last_seen_at" timestamp with time zone,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"created_by_user_id" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"agent_id" uuid,
	"event_id" uuid,
	"object_key" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"checksum" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"inspector_collapsed" boolean DEFAULT false NOT NULL,
	"inspector_width" integer DEFAULT 420 NOT NULL,
	"default_range" text DEFAULT '24h' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_organization_id_membership_id_project_id_pk" PRIMARY KEY("organization_id","membership_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "event_property_catalog" (
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"property_path" text NOT NULL,
	"value_type" text NOT NULL,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_property_catalog_project_id_event_type_property_path_value_type_pk" PRIMARY KEY("project_id","event_type","property_path","value_type")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid,
	"batch_id" uuid,
	"outbox_id" uuid,
	"external_event_id" text,
	"event_type" text NOT NULL,
	"source" "event_source" NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"trace_id" text,
	"span_id" text,
	"run_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"order_id" uuid,
	"project_id" uuid NOT NULL,
	"external_fill_id" text,
	"symbol" text NOT NULL,
	"venue" text,
	"side" "trading_side" NOT NULL,
	"quantity" text NOT NULL,
	"price" text NOT NULL,
	"fee" text,
	"filled_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"agent_id" uuid,
	"status" "agent_status" DEFAULT 'online' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key_id" uuid,
	"source" "event_source" NOT NULL,
	"status" "ingestion_batch_status" DEFAULT 'accepted' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"status" "ingestion_outbox_status" DEFAULT 'pending' NOT NULL,
	"source" "event_source" NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"worker_id" text,
	"locked_until" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"provider" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"agent_id" uuid,
	"type" text NOT NULL,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"decision_id" uuid,
	"project_id" uuid NOT NULL,
	"external_order_id" text,
	"strategy" text,
	"symbol" text NOT NULL,
	"venue" text,
	"side" "trading_side" NOT NULL,
	"order_type" text NOT NULL,
	"quantity" text NOT NULL,
	"price" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "otel_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"trace_id" text,
	"span_id" text,
	"severity_text" text,
	"body" jsonb,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otel_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"kind" text NOT NULL,
	"value" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otel_spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"name" text NOT NULL,
	"kind" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resource" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pnl_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"strategy" text,
	"symbol" text,
	"realized_pnl" text,
	"unrealized_pnl" text,
	"equity" text,
	"snapshot_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"strategy" text,
	"symbol" text NOT NULL,
	"quantity" text NOT NULL,
	"average_price" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"decision_id" uuid,
	"project_id" uuid NOT NULL,
	"result" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trading_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"run_id" uuid,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid,
	"strategy" text,
	"symbol" text,
	"action" text NOT NULL,
	"confidence" integer,
	"rationale_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_property_catalog" ADD CONSTRAINT "event_property_catalog_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_property_catalog" ADD CONSTRAINT "event_property_catalog_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_outbox_id_ingestion_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."ingestion_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_outbox" ADD CONSTRAINT "ingestion_outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_outbox" ADD CONSTRAINT "ingestion_outbox_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_outbox" ADD CONSTRAINT "ingestion_outbox_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_decision_id_trading_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."trading_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otel_logs" ADD CONSTRAINT "otel_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otel_metrics" ADD CONSTRAINT "otel_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otel_spans" ADD CONSTRAINT "otel_spans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnl_snapshots" ADD CONSTRAINT "pnl_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_checks" ADD CONSTRAINT "risk_checks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_checks" ADD CONSTRAINT "risk_checks_decision_id_trading_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."trading_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_checks" ADD CONSTRAINT "risk_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_decisions" ADD CONSTRAINT "trading_decisions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_decisions" ADD CONSTRAINT "trading_decisions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_decisions" ADD CONSTRAINT "trading_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_decisions" ADD CONSTRAINT "trading_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_decisions" ADD CONSTRAINT "trading_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_project_external_idx" ON "agent_runs" USING btree ("project_id","external_run_id") WHERE "agent_runs"."external_run_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_runs_project_started_idx" ON "agent_runs" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_project_external_id_idx" ON "agents" USING btree ("project_id","external_id");--> statement-breakpoint
CREATE INDEX "agents_project_status_idx" ON "agents" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "agents_project_last_seen_idx" ON "agents" USING btree ("project_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "api_keys_project_created_idx" ON "api_keys" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_event_idx" ON "artifacts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_property_catalog_project_event_idx" ON "event_property_catalog" USING btree ("project_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "events_project_external_event_idx" ON "events" USING btree ("project_id","external_event_id") WHERE "events"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_project_created_idx" ON "events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "events_project_type_created_idx" ON "events" USING btree ("project_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "events_project_agent_created_idx" ON "events" USING btree ("project_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "events_project_trace_idx" ON "events" USING btree ("project_id","trace_id");--> statement-breakpoint
CREATE INDEX "events_project_run_idx" ON "events" USING btree ("project_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fills_project_external_idx" ON "fills" USING btree ("project_id","external_fill_id") WHERE "fills"."external_fill_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "fills_project_symbol_filled_idx" ON "fills" USING btree ("project_id","symbol","filled_at");--> statement-breakpoint
CREATE INDEX "ingestion_batches_project_received_idx" ON "ingestion_batches" USING btree ("project_id","received_at");--> statement-breakpoint
CREATE INDEX "ingestion_batches_api_key_idx" ON "ingestion_batches" USING btree ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_outbox_project_idempotency_idx" ON "ingestion_outbox" USING btree ("project_id","idempotency_key") WHERE "ingestion_outbox"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ingestion_outbox_status_locked_idx" ON "ingestion_outbox" USING btree ("status","locked_until");--> statement-breakpoint
CREATE INDEX "ingestion_outbox_batch_idx" ON "ingestion_outbox" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "llm_usage_model_idx" ON "llm_usage" USING btree ("model");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_organization_user_idx" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_created_idx" ON "memberships" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_project_status_created_idx" ON "notifications" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_project_external_idx" ON "orders" USING btree ("project_id","external_order_id") WHERE "orders"."external_order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_project_symbol_created_idx" ON "orders" USING btree ("project_id","symbol","created_at");--> statement-breakpoint
CREATE INDEX "otel_logs_project_observed_idx" ON "otel_logs" USING btree ("project_id","observed_at");--> statement-breakpoint
CREATE INDEX "otel_logs_project_trace_idx" ON "otel_logs" USING btree ("project_id","trace_id");--> statement-breakpoint
CREATE INDEX "otel_metrics_project_name_recorded_idx" ON "otel_metrics" USING btree ("project_id","name","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "otel_spans_project_trace_span_idx" ON "otel_spans" USING btree ("project_id","trace_id","span_id");--> statement-breakpoint
CREATE INDEX "otel_spans_project_started_idx" ON "otel_spans" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE INDEX "pnl_snapshots_project_snapshot_idx" ON "pnl_snapshots" USING btree ("project_id","snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_project_strategy_symbol_idx" ON "positions" USING btree ("project_id","strategy","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_slug_idx" ON "projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "projects_organization_default_idx" ON "projects" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "risk_checks_project_checked_idx" ON "risk_checks" USING btree ("project_id","checked_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trading_decisions_project_decided_idx" ON "trading_decisions" USING btree ("project_id","decided_at");--> statement-breakpoint
CREATE INDEX "trading_decisions_project_symbol_idx" ON "trading_decisions" USING btree ("project_id","symbol");