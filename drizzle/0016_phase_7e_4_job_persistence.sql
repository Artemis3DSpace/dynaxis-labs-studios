-- WP-7E-04 Job Schema Migration and Persistence (Phase 7E)
--
-- Persistence-only deliverable. This migration adds durable job and job-event
-- storage for the Job Engine scaffold contract.
--
-- Scope boundaries:
--   * No queue dispatch implementation (WP-7E-05).
--   * No worker runtime or provider adapter implementation (WP-7E-06).
--   * No OAuth.
--   * No ProviderConnection worker allowlist changes (R1 remains blocked).
--   * No Phase 7D provider-connection durable-audit migration (R3 remains separate).
--
-- Decision preservation:
--   * D1: `timed_out` remains non-terminal (terminal timestamp is constrained to
--     completed/failed/cancelled only).
--   * D2: no `cancelling` state exists in storage vocabulary.
CREATE TABLE "dynaxis_job_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"generation_id" uuid,
	"job_kind" text DEFAULT 'generation' NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_id" text,
	"provider_connection_ref" text,
	"provider_job_id" text,
	"provider_correlation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"cancel_requested_by" text,
	"cancel_reason" text,
	"cancelled_at" timestamp with time zone,
	"timeout_at" timestamp with time zone,
	"timeout_reason" text,
	"timed_out_at" timestamp with time zone,
	"failure_kind" text,
	"failure_code" text,
	"failure_message" text,
	"failure_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"terminal_state_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dynaxis_job_records_state_check" CHECK ("state" in ('queued', 'leased', 'running', 'waiting_retry', 'completed', 'failed', 'cancelled', 'timed_out')),
	CONSTRAINT "dynaxis_job_records_max_attempts_check" CHECK ("max_attempts" >= 1),
	CONSTRAINT "dynaxis_job_records_attempt_count_check" CHECK ("attempt_count" >= 0 and "attempt_count" <= "max_attempts"),
	CONSTRAINT "dynaxis_job_records_version_check" CHECK ("version" >= 1),
	CONSTRAINT "dynaxis_job_records_failure_kind_check" CHECK ("failure_kind" is null or "failure_kind" in ('transient', 'permanent', 'cancelled', 'timeout')),
	CONSTRAINT "dynaxis_job_records_terminal_state_check" CHECK ("terminal_state_at" is null or "state" in ('completed', 'failed', 'cancelled')),
	CONSTRAINT "dynaxis_job_records_cancelled_state_check" CHECK ("cancelled_at" is null or "state" = 'cancelled'),
	CONSTRAINT "dynaxis_job_records_completed_state_check" CHECK ("completed_at" is null or "state" = 'completed'),
	CONSTRAINT "dynaxis_job_records_failed_state_check" CHECK ("failed_at" is null or "state" = 'failed')
);
--> statement-breakpoint
CREATE TABLE "dynaxis_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"source" text NOT NULL,
	"attempt" integer,
	"correlation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dynaxis_job_events_kind_check" CHECK ("kind" in ('job.created', 'job.dispatched', 'job.provider_updated', 'job.retried', 'job.completed', 'job.failed', 'job.cancelled', 'job.reconciled')),
	CONSTRAINT "dynaxis_job_events_actor_type_check" CHECK ("actor_type" in ('user', 'service', 'worker', 'provider', 'system')),
	CONSTRAINT "dynaxis_job_events_sequence_check" CHECK ("sequence" >= 1),
	CONSTRAINT "dynaxis_job_events_attempt_check" CHECK ("attempt" is null or "attempt" >= 1)
);
--> statement-breakpoint
ALTER TABLE "dynaxis_job_records" ADD CONSTRAINT "dynaxis_job_records_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_job_records" ADD CONSTRAINT "dynaxis_job_records_project_id_dynaxis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."dynaxis_projects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_job_events" ADD CONSTRAINT "dynaxis_job_events_job_id_dynaxis_job_records_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."dynaxis_job_records"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_job_events" ADD CONSTRAINT "dynaxis_job_events_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_job_events" ADD CONSTRAINT "dynaxis_job_events_project_id_dynaxis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."dynaxis_projects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dynaxis_job_records_workspace_state_idx" ON "dynaxis_job_records" USING btree ("workspace_id","state","updated_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_job_records_project_created_idx" ON "dynaxis_job_records" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_job_records_provider_lookup_idx" ON "dynaxis_job_records" USING btree ("provider_id","provider_job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_job_records_idempotency_boundary_uidx" ON "dynaxis_job_records" USING btree ("workspace_id","project_id","job_kind","idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_job_events_job_sequence_uidx" ON "dynaxis_job_events" USING btree ("job_id","sequence");
--> statement-breakpoint
CREATE INDEX "dynaxis_job_events_workspace_created_idx" ON "dynaxis_job_events" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_job_events_job_created_idx" ON "dynaxis_job_events" USING btree ("job_id","created_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_job_events_kind_created_idx" ON "dynaxis_job_events" USING btree ("kind","created_at");
