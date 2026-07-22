-- Dynaxis Labs Studios — Phase 5B Character domain
-- Persistent Characters, revisions, asset/project links, conversations.

CREATE TABLE IF NOT EXISTS "dynaxis_characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "backstory" text,
  "persona" text,
  "system_prompt" text,
  "greeting" text,
  "category" text,
  "status" text DEFAULT 'active' NOT NULL,
  "source" text DEFAULT 'dynaxis' NOT NULL,
  "primary_asset_id" uuid REFERENCES "dynaxis_assets"("id"),
  "current_revision_id" uuid,
  "canonical_model" text,
  "config" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_characters_owner_idx" ON "dynaxis_characters" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_characters_owner_status_idx" ON "dynaxis_characters" ("owner_ref", "status");

CREATE TABLE IF NOT EXISTS "dynaxis_character_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL REFERENCES "dynaxis_characters"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "backstory" text,
  "persona" text,
  "system_prompt" text,
  "greeting" text,
  "category" text,
  "canonical_model" text,
  "config" jsonb DEFAULT '{}'::jsonb,
  "snapshot" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_character_revisions_char_rev_uidx"
  ON "dynaxis_character_revisions" ("character_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_character_revisions_owner_idx"
  ON "dynaxis_character_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_character_assets" (
  "character_id" uuid NOT NULL REFERENCES "dynaxis_characters"("id"),
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "role" text NOT NULL DEFAULT 'identity_reference',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("character_id", "asset_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_character_assets_asset_idx"
  ON "dynaxis_character_assets" ("asset_id");

CREATE TABLE IF NOT EXISTS "dynaxis_project_characters" (
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "character_id" uuid NOT NULL REFERENCES "dynaxis_characters"("id"),
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("project_id", "character_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_project_characters_character_idx"
  ON "dynaxis_project_characters" ("character_id");

CREATE TABLE IF NOT EXISTS "dynaxis_character_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "character_id" uuid NOT NULL REFERENCES "dynaxis_characters"("id"),
  "character_revision_id" uuid REFERENCES "dynaxis_character_revisions"("id"),
  "project_id" uuid REFERENCES "dynaxis_projects"("id"),
  "title" text,
  "status" text DEFAULT 'active' NOT NULL,
  "model" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_character_conversations_owner_idx"
  ON "dynaxis_character_conversations" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_character_conversations_character_idx"
  ON "dynaxis_character_conversations" ("character_id");

CREATE TABLE IF NOT EXISTS "dynaxis_character_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "dynaxis_character_conversations"("id"),
  "owner_ref" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "model" text,
  "character_revision_id" uuid REFERENCES "dynaxis_character_revisions"("id"),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_character_messages_conversation_idx"
  ON "dynaxis_character_messages" ("conversation_id", "created_at");

-- Generation provenance for Characters (nullable — non-character gens unchanged)
ALTER TABLE "dynaxis_generations"
  ADD COLUMN IF NOT EXISTS "character_id" uuid REFERENCES "dynaxis_characters"("id");
ALTER TABLE "dynaxis_generations"
  ADD COLUMN IF NOT EXISTS "character_revision_id" uuid REFERENCES "dynaxis_character_revisions"("id");

CREATE INDEX IF NOT EXISTS "dynaxis_generations_character_idx"
  ON "dynaxis_generations" ("character_id");
