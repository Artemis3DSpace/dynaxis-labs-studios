-- Phase 6H — Design Components + Component Instance dependency index

CREATE TABLE IF NOT EXISTS "dynaxis_design_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'custom',
  "status" text NOT NULL DEFAULT 'draft',
  "thumbnail_asset_id" uuid REFERENCES "dynaxis_assets"("id"),
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

CREATE INDEX IF NOT EXISTS "dynaxis_design_components_owner_idx"
  ON "dynaxis_design_components" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_design_components_status_idx"
  ON "dynaxis_design_components" ("owner_ref", "status");
CREATE INDEX IF NOT EXISTS "dynaxis_design_components_category_idx"
  ON "dynaxis_design_components" ("category");
CREATE INDEX IF NOT EXISTS "dynaxis_design_components_brand_idx"
  ON "dynaxis_design_components" ("brand_id");

CREATE TABLE IF NOT EXISTS "dynaxis_design_component_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "component_id" uuid NOT NULL REFERENCES "dynaxis_design_components"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "document" jsonb NOT NULL DEFAULT '{}',
  "intrinsic_width" integer NOT NULL,
  "intrinsic_height" integer NOT NULL,
  "property_definitions" jsonb NOT NULL DEFAULT '[]',
  "source_composition_id" uuid REFERENCES "dynaxis_compositions"("id"),
  "source_composition_revision_id" uuid,
  "brand_revision_id" uuid,
  "reason" text,
  "label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_design_component_revisions_comp_rev_uidx"
  ON "dynaxis_design_component_revisions" ("component_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_design_component_revisions_owner_idx"
  ON "dynaxis_design_component_revisions" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_design_component_revisions_component_idx"
  ON "dynaxis_design_component_revisions" ("component_id");

-- Dependency index for usage / update-available lookups (Composition Document remains canonical).
CREATE TABLE IF NOT EXISTS "dynaxis_composition_component_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "composition_id" uuid NOT NULL REFERENCES "dynaxis_compositions"("id"),
  "composition_revision_id" uuid REFERENCES "dynaxis_composition_revisions"("id"),
  "layer_id" uuid NOT NULL,
  "component_id" uuid NOT NULL REFERENCES "dynaxis_design_components"("id"),
  "component_revision_id" uuid NOT NULL REFERENCES "dynaxis_design_component_revisions"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_comp_comp_instances_layer_uidx"
  ON "dynaxis_composition_component_instances" ("composition_id", "layer_id");
CREATE INDEX IF NOT EXISTS "dynaxis_comp_comp_instances_component_idx"
  ON "dynaxis_composition_component_instances" ("component_id");
CREATE INDEX IF NOT EXISTS "dynaxis_comp_comp_instances_revision_idx"
  ON "dynaxis_composition_component_instances" ("component_revision_id");
CREATE INDEX IF NOT EXISTS "dynaxis_comp_comp_instances_owner_idx"
  ON "dynaxis_composition_component_instances" ("owner_ref");
