-- Phase 6F — Design Templates + Composition template provenance + adaptation lineage

ALTER TABLE "dynaxis_compositions"
  ADD COLUMN IF NOT EXISTS "template_id" uuid,
  ADD COLUMN IF NOT EXISTS "template_revision_id" uuid,
  ADD COLUMN IF NOT EXISTS "source_composition_id" uuid,
  ADD COLUMN IF NOT EXISTS "source_composition_revision_id" uuid,
  ADD COLUMN IF NOT EXISTS "adaptation_engine_version" text,
  ADD COLUMN IF NOT EXISTS "adaptation_target_format_id" text;

CREATE INDEX IF NOT EXISTS "dynaxis_compositions_template_idx"
  ON "dynaxis_compositions" ("template_id");
CREATE INDEX IF NOT EXISTS "dynaxis_compositions_source_comp_idx"
  ON "dynaxis_compositions" ("source_composition_id");

CREATE TABLE IF NOT EXISTS "dynaxis_design_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'custom',
  "status" text NOT NULL DEFAULT 'draft',
  "thumbnail_asset_id" uuid REFERENCES "dynaxis_assets"("id"),
  "source_composition_id" uuid REFERENCES "dynaxis_compositions"("id"),
  "brand_id" uuid REFERENCES "dynaxis_brands"("id"),
  "brand_revision_id" uuid,
  "brand_binding" text NOT NULL DEFAULT 'neutral',
  "current_revision_id" uuid,
  "tags" jsonb NOT NULL DEFAULT '[]',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "dynaxis_design_templates_owner_idx"
  ON "dynaxis_design_templates" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_design_templates_status_idx"
  ON "dynaxis_design_templates" ("owner_ref", "status");
CREATE INDEX IF NOT EXISTS "dynaxis_design_templates_category_idx"
  ON "dynaxis_design_templates" ("category");

CREATE TABLE IF NOT EXISTS "dynaxis_design_template_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "dynaxis_design_templates"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "document" jsonb NOT NULL DEFAULT '{}',
  "canvas_width" integer NOT NULL,
  "canvas_height" integer NOT NULL,
  "aspect_ratio" text,
  "source_composition_revision_id" uuid,
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_design_template_revisions_tmpl_rev_uidx"
  ON "dynaxis_design_template_revisions" ("template_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_design_template_revisions_owner_idx"
  ON "dynaxis_design_template_revisions" ("owner_ref");
