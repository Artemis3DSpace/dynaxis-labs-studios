-- Phase 6E — Non-destructive Composition domain + deliverable final asset

ALTER TABLE "dynaxis_campaign_deliverables"
  ADD COLUMN IF NOT EXISTS "composition_id" uuid,
  ADD COLUMN IF NOT EXISTS "final_asset_id" uuid;

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_composition_idx"
  ON "dynaxis_campaign_deliverables" ("composition_id");

CREATE INDEX IF NOT EXISTS "dynaxis_campaign_deliverables_final_asset_idx"
  ON "dynaxis_campaign_deliverables" ("final_asset_id");

CREATE TABLE IF NOT EXISTS "dynaxis_compositions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "name" text NOT NULL,
  "source_asset_id" uuid REFERENCES "dynaxis_assets"("id"),
  "campaign_id" uuid REFERENCES "dynaxis_campaigns"("id"),
  "campaign_revision_id" uuid,
  "campaign_concept_id" uuid,
  "campaign_deliverable_id" uuid,
  "brand_id" uuid REFERENCES "dynaxis_brands"("id"),
  "brand_revision_id" uuid,
  "canvas_width" integer NOT NULL,
  "canvas_height" integer NOT NULL,
  "aspect_ratio" text,
  "status" text NOT NULL DEFAULT 'draft',
  "document" jsonb NOT NULL DEFAULT '{}',
  "document_version" integer NOT NULL DEFAULT 1,
  "current_revision_id" uuid,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "dynaxis_compositions_owner_idx" ON "dynaxis_compositions" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_compositions_project_idx" ON "dynaxis_compositions" ("project_id");
CREATE INDEX IF NOT EXISTS "dynaxis_compositions_campaign_idx" ON "dynaxis_compositions" ("campaign_id");
CREATE INDEX IF NOT EXISTS "dynaxis_compositions_deliverable_idx" ON "dynaxis_compositions" ("campaign_deliverable_id");

CREATE TABLE IF NOT EXISTS "dynaxis_composition_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "composition_id" uuid NOT NULL REFERENCES "dynaxis_compositions"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "snapshot" jsonb NOT NULL DEFAULT '{}',
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_composition_revisions_comp_rev_uidx"
  ON "dynaxis_composition_revisions" ("composition_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_composition_revisions_owner_idx"
  ON "dynaxis_composition_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_composition_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "composition_id" uuid NOT NULL REFERENCES "dynaxis_compositions"("id"),
  "composition_revision_id" uuid NOT NULL REFERENCES "dynaxis_composition_revisions"("id"),
  "owner_ref" text NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "export_format" text NOT NULL DEFAULT 'png',
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "render_version" text NOT NULL DEFAULT 'resvg-1',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dynaxis_composition_exports_comp_idx"
  ON "dynaxis_composition_exports" ("composition_id");
CREATE INDEX IF NOT EXISTS "dynaxis_composition_exports_asset_idx"
  ON "dynaxis_composition_exports" ("asset_id");

CREATE TABLE IF NOT EXISTS "dynaxis_asset_derivations" (
  "derived_asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "source_asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "owner_ref" text NOT NULL,
  "composition_id" uuid REFERENCES "dynaxis_compositions"("id"),
  "composition_revision_id" uuid REFERENCES "dynaxis_composition_revisions"("id"),
  "composition_export_id" uuid REFERENCES "dynaxis_composition_exports"("id"),
  "campaign_id" uuid,
  "campaign_deliverable_id" uuid,
  "render_format" text,
  "render_version" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("derived_asset_id", "source_asset_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_asset_derivations_source_idx"
  ON "dynaxis_asset_derivations" ("source_asset_id");
CREATE INDEX IF NOT EXISTS "dynaxis_asset_derivations_comp_idx"
  ON "dynaxis_asset_derivations" ("composition_id");
