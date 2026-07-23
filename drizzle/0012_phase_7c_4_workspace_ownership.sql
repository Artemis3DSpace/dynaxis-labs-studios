ALTER TABLE "dynaxis_projects" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_characters" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_products" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_brands" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_design_templates" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_design_components" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_design_systems" ADD COLUMN "organization_id" uuid;
ALTER TABLE "dynaxis_design_component_sets" ADD COLUMN "organization_id" uuid;

ALTER TABLE "dynaxis_projects" ADD CONSTRAINT "dynaxis_projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_characters" ADD CONSTRAINT "dynaxis_characters_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_products" ADD CONSTRAINT "dynaxis_products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_brands" ADD CONSTRAINT "dynaxis_brands_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_design_templates" ADD CONSTRAINT "dynaxis_design_templates_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_design_components" ADD CONSTRAINT "dynaxis_design_components_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_design_systems" ADD CONSTRAINT "dynaxis_design_systems_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "dynaxis_design_component_sets" ADD CONSTRAINT "dynaxis_design_component_sets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;

CREATE INDEX "dynaxis_projects_organization_idx" ON "dynaxis_projects" USING btree ("organization_id");
CREATE INDEX "dynaxis_characters_organization_idx" ON "dynaxis_characters" USING btree ("organization_id");
CREATE INDEX "dynaxis_products_organization_idx" ON "dynaxis_products" USING btree ("organization_id");
CREATE INDEX "dynaxis_brands_organization_idx" ON "dynaxis_brands" USING btree ("organization_id");
CREATE INDEX "dynaxis_design_templates_organization_idx" ON "dynaxis_design_templates" USING btree ("organization_id");
CREATE INDEX "dynaxis_design_components_organization_idx" ON "dynaxis_design_components" USING btree ("organization_id");
CREATE INDEX "dynaxis_design_systems_organization_idx" ON "dynaxis_design_systems" USING btree ("organization_id");
CREATE INDEX "dynaxis_design_component_sets_organization_idx" ON "dynaxis_design_component_sets" USING btree ("organization_id");

UPDATE "dynaxis_projects" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_characters" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_products" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_brands" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_design_templates" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_design_components" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_design_systems" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";

UPDATE "dynaxis_design_component_sets" AS resource
SET "organization_id" = claim."organization_id"
FROM "dynaxis_owner_ref_claims" AS claim
WHERE resource."organization_id" IS NULL
  AND resource."owner_ref" = claim."legacy_owner_ref";
