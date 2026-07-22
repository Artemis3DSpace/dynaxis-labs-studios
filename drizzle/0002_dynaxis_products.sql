-- Phase 6A: Dynaxis Product domain
-- Products, revisions, product↔ assets, project ↔ products, generation provenance

ALTER TABLE "dynaxis_generations"
  ADD COLUMN IF NOT EXISTS "product_id" uuid,
  ADD COLUMN IF NOT EXISTS "product_revision_id" uuid;

CREATE INDEX IF NOT EXISTS "dynaxis_generations_product_idx"
  ON "dynaxis_generations" ("product_id");

CREATE TABLE IF NOT EXISTS "dynaxis_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "product_type" text,
  "sku" text,
  "brand_name" text,
  "category" text,
  "status" text DEFAULT 'active' NOT NULL,
  "visual_description" text,
  "claims" jsonb DEFAULT '[]'::jsonb,
  "primary_asset_id" uuid,
  "current_revision_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "dynaxis_products_owner_idx"
  ON "dynaxis_products" ("owner_ref");
CREATE INDEX IF NOT EXISTS "dynaxis_products_status_idx"
  ON "dynaxis_products" ("owner_ref", "status");

CREATE TABLE IF NOT EXISTS "dynaxis_product_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "dynaxis_products"("id"),
  "owner_ref" text NOT NULL,
  "revision_number" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "product_type" text,
  "sku" text,
  "brand_name" text,
  "category" text,
  "visual_description" text,
  "claims" jsonb DEFAULT '[]'::jsonb,
  "snapshot" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dynaxis_product_revisions_product_rev_uidx"
  ON "dynaxis_product_revisions" ("product_id", "revision_number");
CREATE INDEX IF NOT EXISTS "dynaxis_product_revisions_owner_idx"
  ON "dynaxis_product_revisions" ("owner_ref");

CREATE TABLE IF NOT EXISTS "dynaxis_product_assets" (
  "product_id" uuid NOT NULL REFERENCES "dynaxis_products"("id"),
  "asset_id" uuid NOT NULL REFERENCES "dynaxis_assets"("id"),
  "role" text DEFAULT 'product_reference' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("product_id", "asset_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_product_assets_asset_idx"
  ON "dynaxis_product_assets" ("asset_id");

CREATE TABLE IF NOT EXISTS "dynaxis_project_products" (
  "project_id" uuid NOT NULL REFERENCES "dynaxis_projects"("id"),
  "product_id" uuid NOT NULL REFERENCES "dynaxis_products"("id"),
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("project_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "dynaxis_project_products_product_idx"
  ON "dynaxis_project_products" ("product_id");
