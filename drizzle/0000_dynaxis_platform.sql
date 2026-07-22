-- Dynaxis Labs Studios — Phase 3 platform foundation
-- Single PostgreSQL database for projects, generations, jobs, assets.

CREATE TABLE IF NOT EXISTS "dynaxis_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_projects_owner_idx" ON "dynaxis_projects" ("owner_ref");

-- At most one default project per owner
CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_projects_owner_default_uidx"
  ON "dynaxis_projects" ("owner_ref")
  WHERE "is_default" = true;

CREATE TABLE IF NOT EXISTS "dynaxis_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "feature_id" text,
  "provider" text DEFAULT 'muapi' NOT NULL,
  "model" text,
  "prompt" text,
  "parameters" jsonb DEFAULT '{}'::jsonb,
  "status" text DEFAULT 'queued' NOT NULL,
  "primary_job_id" uuid,
  "error_code" text,
  "error_message" text,
  "migration_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_generations_owner_idx" ON "dynaxis_generations" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_generations_project_idx" ON "dynaxis_generations" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_generations_migration_key_uidx"
  ON "dynaxis_generations" ("migration_key")
  WHERE "migration_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "dynaxis_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "generation_id" uuid NOT NULL REFERENCES "dynaxis_generations"("id"),
  "provider" text DEFAULT 'muapi' NOT NULL,
  "provider_job_id" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "progress" double precision,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "submitted_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "failed_at" timestamptz,
  "last_polled_at" timestamptz,
  "error_code" text,
  "error_message" text,
  "provider_metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_jobs_owner_idx" ON "dynaxis_jobs" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_jobs_generation_idx" ON "dynaxis_jobs" ("generation_id");
CREATE INDEX IF NOT EXISTS "dynaxis_jobs_provider_job_idx" ON "dynaxis_jobs" ("provider", "provider_job_id");

CREATE TABLE IF NOT EXISTS "dynaxis_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "generation_id" uuid REFERENCES "dynaxis_generations"("id"),
  "job_id" uuid REFERENCES "dynaxis_jobs"("id"),
  "type" text NOT NULL,
  "source" text DEFAULT 'generated' NOT NULL,
  "provider" text,
  "model" text,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "mime_type" text,
  "width" integer,
  "height" integer,
  "duration_ms" integer,
  "prompt" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_assets_owner_idx" ON "dynaxis_assets" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_assets_project_idx" ON "dynaxis_assets" ("project_id");
CREATE INDEX IF NOT EXISTS "dynaxis_assets_generation_idx" ON "dynaxis_assets" ("generation_id");

CREATE TABLE IF NOT EXISTS "dynaxis_generation_assets" (
  "generation_id" uuid NOT NULL REFERENCES "dynaxis_generations"("id"),
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "role" text DEFAULT 'primary' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("generation_id", "asset_id")
);

-- Optional FK from generations.primary_job_id after jobs exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dynaxis_generations_primary_job_fk'
  ) THEN
    ALTER TABLE "dynaxis_generations"
      ADD CONSTRAINT "dynaxis_generations_primary_job_fk"
      FOREIGN KEY ("primary_job_id") REFERENCES "dynaxis_jobs"("id");
  END IF;
END $$;
