-- WP-7C-24 Canonical Persistence Access Bridge (Projects and Assets only)
--
-- Relax the legacy owner_ref NOT NULL constraint on Workspace-owned Projects
-- and Project-owned Assets so canonical rows can persist Workspace/Project
-- ownership (organization_id and project_id) without a legacy owner_ref.
-- Legacy rows continue to populate owner_ref for the compatibility partition;
-- canonical rows use owner_ref IS NULL. No data is modified, no owner_ref is
-- deleted or backfilled, and no organization_id column is added anywhere.
ALTER TABLE "dynaxis_projects" ALTER COLUMN "owner_ref" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "dynaxis_assets" ALTER COLUMN "owner_ref" DROP NOT NULL;
