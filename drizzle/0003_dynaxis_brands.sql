-- Phase 7A: Dynaxis Brand domain
-- Brands, revisions, brand↔assets, brand↔products, project↔brands, generation provenance

ALTER TABLE "dynaxis_generations"
  ADD COLUMN IF NOT EXISTS "brand_id" uuid,
  ADD COLUMN IF NOT EXISTS "brand_revision_id" uuid;

CREATE INDEX IF NOT EXISTS "dynaxis_generations_brand_idx"
  ON "dynaxis_generations" ("brand_id");

CREATE TABLE IF NOT EXISTS "dynaxis_brands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "industry" text,
  "tagline" text,
  "value_proposition" text,
  "target_audience" text,
  "imagery_style" text,
  "layout_style" text,
  "source_url" text,
  "status" text DEFAULT 'active' NOT NULL,
  "tone_of_voice" jsonb DEFAULT '[]'::jsonb,
  "brand_personality" jsonb DEFAULT '[]'::jsonb,
  "key_messages" jsonb DEFAULT '[]'::jsonb,
  "primary_colors" jsonb DEFAULT '[]'::jsonb,
  "secondary_colors" jsonb DEFAULT '[]'::jsonb,
  "fonts" jsonb DEFAULT '[]'::jsonb,
  "primary_asset_id" uuid,
  "current_revision_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_brands_owner_idx"
  ON "dynaxis_brands" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_brands_status_idx"
  ON "dynaxis_brands" ("owner_ref", "status");

CREATE TABLE IF NOT EXISTS "dynaxis_brand_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brand_id" uuid NOT NULL REFERENCES "dynaxis_brands"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_brand_revisions_brand_rev_uidx"
  ON "dynaxis_brand_revisions" ("brand_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_brand_revisions_owner_idx"
  ON "dynaxis_brand_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_brand_assets" (
  "brand_id" uuid NOT NULL REFERENCES "dynaxis_brands"("id"),
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "role" text DEFAULT 'brand_reference' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("brand_id", "asset_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_brand_assets_asset_idx"
  ON "dynaxis_brand_assets" ("asset_id");

CREATE TABLE IF NOT EXISTS "dynaxis_brand_products" (
  "brand_id" uuid NOT NULL REFERENCES "dynaxis_brands"("id"),
  "product_id" uuid NOT NULL REFERENCES "dynaxis_products"("id"),
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "is_primary" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("brand_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_brand_products_product_idx"
  ON "dynaxis_brand_products" ("product_id");

CREATE TABLE IF NOT EXISTS "dynaxis_project_brands" (
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "brand_id" uuid NOT NULL REFERENCES "dynaxis_brands"("id"),
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("project_id", "brand_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_project_brands_brand_idx"
  ON "dynaxis_project_brands" ("brand_id");
