CREATE UNIQUE INDEX "dynaxis_projects_id_organization_uidx" ON "dynaxis_projects" USING btree ("id","organization_id");
--> statement-breakpoint
CREATE TABLE "dynaxis_project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dynaxis_project_members_role_check" CHECK ("role" in ('owner', 'admin', 'editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "dynaxis_project_members" ADD CONSTRAINT "dynaxis_project_members_project_id_dynaxis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."dynaxis_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_project_members" ADD CONSTRAINT "dynaxis_project_members_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_project_members" ADD CONSTRAINT "dynaxis_project_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_project_members" ADD CONSTRAINT "dynaxis_project_members_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."dynaxis_projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_project_members" ADD CONSTRAINT "dynaxis_project_members_workspace_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "auth"."member"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_project_members_project_user_uidx" ON "dynaxis_project_members" USING btree ("project_id","user_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_project_members_project_idx" ON "dynaxis_project_members" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_project_members_user_idx" ON "dynaxis_project_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_project_members_organization_idx" ON "dynaxis_project_members" USING btree ("organization_id");
