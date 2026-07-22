-- Phase 6I — Design Systems + tokens/modes + Component Sets/variants
-- Also: Composition Design System revision pins

ALTER TABLE "dynaxis_compositions"
  ADD COLUMN IF NOT EXISTS "design_system_id" uuid,
  ADD COLUMN IF NOT EXISTS "design_system_revision_id" uuid,
  ADD COLUMN IF NOT EXISTS "design_system_modes" jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "dynaxis_compositions_design_system_idx"
  ON "dynaxis_compositions" ("design_system_id");

CREATE TABLE IF NOT EXISTS "dynaxis_design_systems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'draft',
  "brand_id" uuid REFERENCES "dynaxis_brands"("id"),
  "brand_revision_id" uuid,
  "current_revision_id" uuid,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "dynaxis_design_systems_owner_idx"
  ON "dynaxis_design_systems" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_design_systems_status_idx"
  ON "dynaxis_design_systems" ("owner_ref", "status");
CREATE INDEX IF NOT EXISTS "dynaxis_design_systems_brand_idx"
  ON "dynaxis_design_systems" ("brand_id");

CREATE TABLE IF NOT EXISTS "dynaxis_design_system_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "design_system_id" uuid NOT NULL REFERENCES "dynaxis_design_systems"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "document" jsonb NOT NULL DEFAULT '{}',
  "brand_revision_id" uuid,
  "reason" text,
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_design_system_revisions_sys_rev_uidx"
  ON "dynaxis_design_system_revisions" ("design_system_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_design_system_revisions_owner_idx"
  ON "dynaxis_design_system_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_design_component_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'custom',
  "status" text NOT NULL DEFAULT 'draft',
  "brand_id" uuid REFERENCES "dynaxis_brands"("id"),
  "brand_revision_id" uuid,
  "thumbnail_asset_id" uuid REFERENCES "dynaxis_assets"("id"),
  "variant_axes" jsonb NOT NULL DEFAULT '[]',
  "default_combination" jsonb NOT NULL DEFAULT '{}',
  "tags" jsonb NOT NULL DEFAULT '[]',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "dynaxis_design_component_sets_owner_idx"
  ON "dynaxis_design_component_sets" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_design_component_sets_status_idx"
  ON "dynaxis_design_component_sets" ("owner_ref", "status");
CREATE INDEX IF NOT EXISTS "dynaxis_design_component_sets_category_idx"
  ON "dynaxis_design_component_sets" ("category");

-- Explicit sparse variant combinations → pinned Component revision
CREATE TABLE IF NOT EXISTS "dynaxis_design_component_set_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "component_set_id" uuid NOT NULL REFERENCES "dynaxis_design_component_sets"("id"),
  "owner_ref" text NOT NULL,
  "combination_key" text NOT NULL,
  "combination" jsonb NOT NULL DEFAULT '{}',
  "component_id" uuid NOT NULL REFERENCES "dynaxis_design_components"("id"),
  "component_revision_id" uuid NOT NULL REFERENCES "dynaxis_design_component_revisions"("id"),
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_design_comp_set_variants_key_uidx"
  ON "dynaxis_design_component_set_variants" ("component_set_id", "combination_key");
CREATE INDEX IF NOT EXISTS "dynaxis_design_comp_set_variants_set_idx"
  ON "dynaxis_design_component_set_variants" ("component_set_id");
CREATE INDEX IF NOT EXISTS "dynaxis_design_comp_set_variants_component_idx"
  ON "dynaxis_design_component_set_variants" ("component_id");
CREATE INDEX IF NOT EXISTS "dynaxis_design_comp_set_variants_owner_idx"
  ON "dynaxis_design_component_set_variants" ("owner_ref");
