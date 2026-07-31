-- WP-7D-03 Provider Connection Schema and Migration (Phase 7D)
--
-- Adds the persistence shape for ProviderConnection metadata and encrypted
-- secret envelopes. Storage shape only: this migration adds no encryption,
-- decryption, unwrap, AAD runtime validation, key generation, KMS/local/test
-- key runtime, provider service, OAuth flow, or UI. Those belong to WP-7D-04.
--
-- Security invariants encoded here:
--   * Provider credentials are never Dynaxis identity. Owner columns reference
--     Better Auth auth.user / auth.organization; provider account columns are
--     display metadata only and grant no authority.
--   * Exactly one owner target is active (owner_type user <-> owner_user_id,
--     owner_type workspace <-> owner_workspace_id), enforced by check.
--   * Audit actors (created_by/last_updated_by/revoked_by) are not owners.
--   * No raw credential material is persisted in any column. Connections hold
--     only opaque envelope references (secret_ref/secret_version/key_ref) and
--     a non-reversible credential_fingerprint. Envelopes hold AEAD ciphertext
--     components (encrypted_payload/auth_tag/iv), never plaintext.
--   * Revoked and deleted states must record their tombstone timestamps.
CREATE TABLE "dynaxis_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_user_id" uuid,
	"owner_workspace_id" uuid,
	"created_by_user_id" uuid,
	"last_updated_by_user_id" uuid,
	"revoked_by_user_id" uuid,
	"credential_kind" text NOT NULL,
	"secret_ref" uuid,
	"secret_version" integer,
	"key_ref" text,
	"credential_fingerprint" text,
	"expires_at" timestamp with time zone,
	"last_rotated_at" timestamp with time zone,
	"rotation_required_at" timestamp with time zone,
	"envelope_created_at" timestamp with time zone,
	"rotation_in_progress" boolean DEFAULT false NOT NULL,
	"secret_status" text,
	"label" text,
	"provider_display_name" text,
	"provider_account_id" text,
	"provider_account_label" text,
	"provider_account_avatar_url" text,
	"provider_region" text,
	"metadata_verified_at" timestamp with time zone,
	"metadata_source" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"requested_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_provider_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_for_workspace" boolean DEFAULT false NOT NULL,
	"default_for_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_use_job_id" uuid,
	"last_use_generation_id" uuid,
	"last_health_checked_at" timestamp with time zone,
	"last_health_status" text,
	"revoked_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"audit_correlation_id" text,
	CONSTRAINT "dynaxis_provider_connections_owner_type_check" CHECK ("owner_type" in ('user', 'workspace')),
	CONSTRAINT "dynaxis_provider_connections_owner_target_check" CHECK (("owner_type" = 'user' and "owner_user_id" is not null and "owner_workspace_id" is null)
        or ("owner_type" = 'workspace' and "owner_workspace_id" is not null and "owner_user_id" is null)),
	CONSTRAINT "dynaxis_provider_connections_default_scope_check" CHECK (("default_for_workspace" = false or "owner_type" = 'workspace')
        and ("default_for_user" = false or "owner_type" = 'user')),
	CONSTRAINT "dynaxis_provider_connections_credential_kind_check" CHECK ("credential_kind" in ('api_key', 'bearer_token', 'oauth_access_refresh_token', 'oauth_client_secret', 'service_account_json', 'webhook_secret', 'local_runtime_reference', 'no_secret_required')),
	CONSTRAINT "dynaxis_provider_connections_status_check" CHECK ("status" in ('pending_verification', 'active', 'disabled', 'rotation_required', 'revoked', 'provider_error', 'deleted')),
	CONSTRAINT "dynaxis_provider_connections_secret_status_check" CHECK ("secret_status" is null or "secret_status" in ('active', 'rotation_required', 'corrupted', 'missing')),
	CONSTRAINT "dynaxis_provider_connections_metadata_source_check" CHECK ("metadata_source" is null or "metadata_source" in ('user_supplied', 'provider_verified', 'system_inferred')),
	CONSTRAINT "dynaxis_provider_connections_secretless_check" CHECK ("credential_kind" <> 'no_secret_required'
        or ("secret_ref" is null and "secret_version" is null and "credential_fingerprint" is null)),
	CONSTRAINT "dynaxis_provider_connections_revoked_tombstone_check" CHECK ("status" <> 'revoked' or "revoked_at" is not null),
	CONSTRAINT "dynaxis_provider_connections_deleted_tombstone_check" CHECK ("status" <> 'deleted' or "deleted_at" is not null),
	CONSTRAINT "dynaxis_provider_connections_secret_version_check" CHECK ("secret_version" is null or "secret_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "dynaxis_provider_secret_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"secret_version" integer NOT NULL,
	"key_ref" text NOT NULL,
	"algorithm" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"auth_tag" text NOT NULL,
	"iv" text NOT NULL,
	"aad_owner_type" text NOT NULL,
	"aad_owner_id" uuid NOT NULL,
	"aad_provider_id" text NOT NULL,
	"aad_credential_kind" text NOT NULL,
	"aad_secret_version" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_from_envelope_id" uuid,
	CONSTRAINT "dynaxis_provider_secret_envelopes_algorithm_check" CHECK ("algorithm" in ('aes-256-gcm', 'chacha20-poly1305')),
	CONSTRAINT "dynaxis_provider_secret_envelopes_status_check" CHECK ("status" in ('active', 'superseded', 'revoked', 'corrupted')),
	CONSTRAINT "dynaxis_provider_secret_envelopes_aad_owner_type_check" CHECK ("aad_owner_type" in ('user', 'workspace')),
	CONSTRAINT "dynaxis_provider_secret_envelopes_aad_version_check" CHECK ("aad_secret_version" = "secret_version"),
	CONSTRAINT "dynaxis_provider_secret_envelopes_secret_version_check" CHECK ("secret_version" >= 1),
	CONSTRAINT "dynaxis_provider_secret_envelopes_rotated_from_self_check" CHECK ("rotated_from_envelope_id" is null or "rotated_from_envelope_id" <> "id")
);
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_connections" ADD CONSTRAINT "dynaxis_provider_connections_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_connections" ADD CONSTRAINT "dynaxis_provider_connections_owner_workspace_id_organization_id_fk" FOREIGN KEY ("owner_workspace_id") REFERENCES "auth"."organization"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_connections" ADD CONSTRAINT "dynaxis_provider_connections_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_connections" ADD CONSTRAINT "dynaxis_provider_connections_last_updated_by_user_id_user_id_fk" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_connections" ADD CONSTRAINT "dynaxis_provider_connections_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynaxis_provider_secret_envelopes" ADD CONSTRAINT "dynaxis_provider_secret_envelopes_connection_id_dynaxis_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."dynaxis_provider_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_owner_user_idx" ON "dynaxis_provider_connections" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_owner_workspace_idx" ON "dynaxis_provider_connections" USING btree ("owner_workspace_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_provider_idx" ON "dynaxis_provider_connections" USING btree ("provider_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_status_idx" ON "dynaxis_provider_connections" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_workspace_provider_idx" ON "dynaxis_provider_connections" USING btree ("owner_workspace_id","provider_id","status");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_user_provider_idx" ON "dynaxis_provider_connections" USING btree ("owner_user_id","provider_id","status");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_secret_ref_idx" ON "dynaxis_provider_connections" USING btree ("secret_ref");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_secret_status_idx" ON "dynaxis_provider_connections" USING btree ("secret_status");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_rotation_idx" ON "dynaxis_provider_connections" USING btree ("rotation_in_progress","rotation_required_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_deleted_at_idx" ON "dynaxis_provider_connections" USING btree ("deleted_at");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_connections_audit_correlation_idx" ON "dynaxis_provider_connections" USING btree ("audit_correlation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_provider_connections_workspace_default_uidx" ON "dynaxis_provider_connections" USING btree ("owner_workspace_id","provider_id") WHERE "default_for_workspace" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_provider_connections_user_default_uidx" ON "dynaxis_provider_connections" USING btree ("owner_user_id","provider_id") WHERE "default_for_user" = true AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "dynaxis_provider_secret_envelopes_connection_version_uidx" ON "dynaxis_provider_secret_envelopes" USING btree ("connection_id","secret_version");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_secret_envelopes_connection_idx" ON "dynaxis_provider_secret_envelopes" USING btree ("connection_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_secret_envelopes_status_idx" ON "dynaxis_provider_secret_envelopes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_secret_envelopes_key_ref_idx" ON "dynaxis_provider_secret_envelopes" USING btree ("key_ref");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_secret_envelopes_rotated_from_idx" ON "dynaxis_provider_secret_envelopes" USING btree ("rotated_from_envelope_id");
--> statement-breakpoint
CREATE INDEX "dynaxis_provider_secret_envelopes_aad_owner_idx" ON "dynaxis_provider_secret_envelopes" USING btree ("aad_owner_type","aad_owner_id");
