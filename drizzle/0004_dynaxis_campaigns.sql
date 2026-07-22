-- Phase 6D: Dynaxis Campaign domain
-- Campaigns, revisions, products, characters, concepts, deliverables, assets, generation provenance

ALTER TABLE "dynaxis_generations"
  ADD COLUMN IF NOT EXISTS "campaign_id" uuid,
  ADD COLUMN IF NOT EXISTS "campaign_revision_id" uuid;

CREATE INDEX IF NOT EXISTS "dynaxis_generations_campaign_idx"
  ON "dynaxis_generations" ("campaign_id");

CREATE TABLE IF NOT EXISTS "dynaxis_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "brand_id" uuid NOT NULL REFERENCES "dynaxis_brands"("id"),
  "brand_revision_id" uuid NOT NULL,
  "name" text NOT NULL,
  "goal" text NOT NULL,
  "direction" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "selected_concept_id" uuid,
  "current_revision_id" uuid,
  "include_brand_logo" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaigns_owner_idx" ON "dynaxis_campaigns" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_campaigns_project_idx" ON "dynaxis_campaigns" ("project_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaigns_brand_idx" ON "dynaxis_campaigns" ("brand_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaigns_status_idx" ON "dynaxis_campaigns" ("owner_ref", "status");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_campaign_revisions_campaign_rev_uidx"
  ON "dynaxis_campaign_revisions" ("campaign_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_revisions_owner_idx"
  ON "dynaxis_campaign_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_products" (
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "product_id" uuid NOT NULL REFERENCES "dynaxis_products"("id"),
  "product_revision_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("campaign_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_products_product_idx"
  ON "dynaxis_campaign_products" ("product_id");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_characters" (
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "character_id" uuid NOT NULL REFERENCES "dynaxis_characters"("id"),
  "character_revision_id" uuid NOT NULL,
  "role" text DEFAULT 'presenter' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("campaign_id", "character_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_characters_character_idx"
  ON "dynaxis_campaign_characters" ("character_id");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_concepts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "campaign_revision_id" uuid NOT NULL,
  "owner_ref" text NOT NULL,
  "title" text NOT NULL,
  "theme" text NOT NULL,
  "key_message" text NOT NULL,
  "hook" text NOT NULL,
  "cta" text NOT NULL,
  "recommended_format_ids" jsonb DEFAULT '[]'::jsonb,
  "tone_notes" text,
  "visual_direction" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "provider" text,
  "model" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_concepts_campaign_idx"
  ON "dynaxis_campaign_concepts" ("campaign_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_concepts_revision_idx"
  ON "dynaxis_campaign_concepts" ("campaign_revision_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_concepts_owner_idx"
  ON "dynaxis_campaign_concepts" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_deliverables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "campaign_revision_id" uuid NOT NULL,
  "concept_id" uuid NOT NULL REFERENCES "dynaxis_campaign_concepts"("id"),
  "owner_ref" text NOT NULL,
  "format_id" text NOT NULL,
  "output_modality" text DEFAULT 'image' NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "headline" text,
  "body" text,
  "cta" text,
  "generation_id" uuid,
  "asset_id" uuid,
  "include_brand_logo" boolean DEFAULT false NOT NULL,
  "provider" text,
  "model" text,
  "error_code" text,
  "error_message" text,
  "output_history" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_campaign_idx"
  ON "dynaxis_campaign_deliverables" ("campaign_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_concept_idx"
  ON "dynaxis_campaign_deliverables" ("concept_id");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_status_idx"
  ON "dynaxis_campaign_deliverables" ("campaign_id", "status");
CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_owner_idx"
  ON "dynaxis_campaign_deliverables" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_campaign_assets" (
  "campaign_id" uuid NOT NULL REFERENCES "dynaxis_campaigns"("id"),
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "role" text DEFAULT 'campaign_reference' NOT NULL,
  "concept_id" uuid,
  "deliverable_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("campaign_id", "asset_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_assets_asset_idx"
  ON "dynaxis_campaign_assets" ("asset_id");
