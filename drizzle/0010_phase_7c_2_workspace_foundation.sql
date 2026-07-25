-- Custom SQL migration file, put your code below! --
CREATE TABLE "auth"."organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "auth"."session" ADD COLUMN "active_organization_id" uuid;
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynaxis_personal_workspaces" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_personal_workspaces" ADD CONSTRAINT "dynaxis_personal_workspaces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_personal_workspaces" ADD CONSTRAINT "dynaxis_personal_workspaces_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "auth"."organization" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "member_organization_user_uidx" ON "auth"."member" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_personal_workspaces_organization_uidx" ON "dynaxis_personal_workspaces" USING btree ("organization_id");
