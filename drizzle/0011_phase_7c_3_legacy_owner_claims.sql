-- Custom SQL migration file, put your code below! --
CREATE TABLE "dynaxis_owner_ref_claims" (
	"legacy_owner_ref" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"claimed_by_user_id" uuid,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dynaxis_owner_ref_claims" ADD CONSTRAINT "dynaxis_owner_ref_claims_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_owner_ref_claims" ADD CONSTRAINT "dynaxis_owner_ref_claims_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dynaxis_owner_ref_claims_organization_idx" ON "dynaxis_owner_ref_claims" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_owner_ref_claims_claimed_by_user_idx" ON "dynaxis_owner_ref_claims" USING btree ("claimed_by_user_id");
