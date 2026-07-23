/**
 * Dynaxis Labs Studios — PostgreSQL schema (Drizzle ORM).
 * Single coherent platform database for Projects, Assets, Generations, Jobs.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organization } from '../auth/schema.js';

export const dynaxisProjects = pgTable(
  'dynaxis_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    isDefault: boolean('is_default').notNull().default(false),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('dynaxis_projects_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_projects_organization_idx').on(t.organizationId),
  })
);

export const dynaxisGenerations = pgTable(
  'dynaxis_generations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    featureId: text('feature_id'),
    provider: text('provider').notNull().default('muapi'),
    model: text('model'),
    prompt: text('prompt'),
    parameters: jsonb('parameters').$type().default({}),
    status: text('status').notNull().default('queued'),
    primaryJobId: uuid('primary_job_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    migrationKey: text('migration_key'),
    characterId: uuid('character_id'),
    characterRevisionId: uuid('character_revision_id'),
    productId: uuid('product_id'),
    productRevisionId: uuid('product_revision_id'),
    brandId: uuid('brand_id'),
    brandRevisionId: uuid('brand_revision_id'),
    campaignId: uuid('campaign_id'),
    campaignRevisionId: uuid('campaign_revision_id'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_generations_owner_idx').on(t.ownerRef),
    projectIdx: index('dynaxis_generations_project_idx').on(t.projectId),
    characterIdx: index('dynaxis_generations_character_idx').on(t.characterId),
    productIdx: index('dynaxis_generations_product_idx').on(t.productId),
    brandIdx: index('dynaxis_generations_brand_idx').on(t.brandId),
    campaignIdx: index('dynaxis_generations_campaign_idx').on(t.campaignId),
    migrationKeyUidx: uniqueIndex('dynaxis_generations_migration_key_uidx').on(t.migrationKey),
  })
);

export const dynaxisJobs = pgTable(
  'dynaxis_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    generationId: uuid('generation_id')
      .notNull()
      .references(() => dynaxisGenerations.id),
    provider: text('provider').notNull().default('muapi'),
    providerJobId: text('provider_job_id'),
    status: text('status').notNull().default('queued'),
    progress: doublePrecision('progress'),
    attemptCount: integer('attempt_count').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    providerMetadata: jsonb('provider_metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('dynaxis_jobs_owner_idx').on(t.ownerRef),
    generationIdx: index('dynaxis_jobs_generation_idx').on(t.generationId),
    providerJobIdx: index('dynaxis_jobs_provider_job_idx').on(t.provider, t.providerJobId),
  })
);

export const dynaxisAssets = pgTable(
  'dynaxis_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    generationId: uuid('generation_id').references(() => dynaxisGenerations.id),
    jobId: uuid('job_id').references(() => dynaxisJobs.id),
    type: text('type').notNull(),
    source: text('source').notNull().default('generated'),
    provider: text('provider'),
    model: text('model'),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    prompt: text('prompt'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('dynaxis_assets_owner_idx').on(t.ownerRef),
    projectIdx: index('dynaxis_assets_project_idx').on(t.projectId),
    generationIdx: index('dynaxis_assets_generation_idx').on(t.generationId),
  })
);

export const dynaxisGenerationAssets = pgTable(
  'dynaxis_generation_assets',
  {
    generationId: uuid('generation_id')
      .notNull()
      .references(() => dynaxisGenerations.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    role: text('role').notNull().default('primary'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.generationId, t.assetId] }),
  })
);

/** Persistent reusable Character identity (owner-scoped, not Project-owned). */
export const dynaxisCharacters = pgTable(
  'dynaxis_characters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    backstory: text('backstory'),
    persona: text('persona'),
    systemPrompt: text('system_prompt'),
    greeting: text('greeting'),
    category: text('category'),
    status: text('status').notNull().default('active'),
    source: text('source').notNull().default('dynaxis'),
    primaryAssetId: uuid('primary_asset_id').references(() => dynaxisAssets.id),
    currentRevisionId: uuid('current_revision_id'),
    canonicalModel: text('canonical_model'),
    config: jsonb('config').$type().default({}),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_characters_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_characters_organization_idx').on(t.organizationId),
    ownerStatusIdx: index('dynaxis_characters_owner_status_idx').on(t.ownerRef, t.status),
  })
);

export const dynaxisCharacterRevisions = pgTable(
  'dynaxis_character_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => dynaxisCharacters.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    backstory: text('backstory'),
    persona: text('persona'),
    systemPrompt: text('system_prompt'),
    greeting: text('greeting'),
    category: text('category'),
    canonicalModel: text('canonical_model'),
    config: jsonb('config').$type().default({}),
    snapshot: jsonb('snapshot').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    charRevUidx: uniqueIndex('dynaxis_character_revisions_char_rev_uidx').on(
      t.characterId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_character_revisions_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisCharacterAssets = pgTable(
  'dynaxis_character_assets',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => dynaxisCharacters.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    role: text('role').notNull().default('identity_reference'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.assetId] }),
    assetIdx: index('dynaxis_character_assets_asset_idx').on(t.assetId),
  })
);

export const dynaxisProjectCharacters = pgTable(
  'dynaxis_project_characters',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    characterId: uuid('character_id')
      .notNull()
      .references(() => dynaxisCharacters.id),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.characterId] }),
    characterIdx: index('dynaxis_project_characters_character_idx').on(t.characterId),
  })
);

export const dynaxisCharacterConversations = pgTable(
  'dynaxis_character_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => dynaxisCharacters.id),
    characterRevisionId: uuid('character_revision_id').references(
      () => dynaxisCharacterRevisions.id
    ),
    projectId: uuid('project_id').references(() => dynaxisProjects.id),
    title: text('title'),
    status: text('status').notNull().default('active'),
    model: text('model'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('dynaxis_character_conversations_owner_idx').on(t.ownerRef),
    characterIdx: index('dynaxis_character_conversations_character_idx').on(t.characterId),
  })
);

export const dynaxisCharacterMessages = pgTable(
  'dynaxis_character_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => dynaxisCharacterConversations.id),
    ownerRef: text('owner_ref').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    model: text('model'),
    characterRevisionId: uuid('character_revision_id').references(
      () => dynaxisCharacterRevisions.id
    ),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    conversationIdx: index('dynaxis_character_messages_conversation_idx').on(
      t.conversationId,
      t.createdAt
    ),
  })
);

export const dynaxisProducts = pgTable(
  'dynaxis_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    productType: text('product_type'),
    sku: text('sku'),
    brandName: text('brand_name'),
    category: text('category'),
    status: text('status').notNull().default('active'),
    visualDescription: text('visual_description'),
    claims: jsonb('claims').$type().default([]),
    primaryAssetId: uuid('primary_asset_id'),
    currentRevisionId: uuid('current_revision_id'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_products_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_products_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_products_status_idx').on(t.ownerRef, t.status),
  })
);

export const dynaxisProductRevisions = pgTable(
  'dynaxis_product_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => dynaxisProducts.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    productType: text('product_type'),
    sku: text('sku'),
    brandName: text('brand_name'),
    category: text('category'),
    visualDescription: text('visual_description'),
    claims: jsonb('claims').$type().default([]),
    snapshot: jsonb('snapshot').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productRevUidx: uniqueIndex('dynaxis_product_revisions_product_rev_uidx').on(
      t.productId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_product_revisions_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisProductAssets = pgTable(
  'dynaxis_product_assets',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => dynaxisProducts.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    role: text('role').notNull().default('product_reference'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.assetId] }),
    assetIdx: index('dynaxis_product_assets_asset_idx').on(t.assetId),
  })
);

export const dynaxisProjectProducts = pgTable(
  'dynaxis_project_products',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => dynaxisProducts.id),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.productId] }),
    productIdx: index('dynaxis_project_products_product_idx').on(t.productId),
  })
);

/** Persistent reusable Brand identity (owner-scoped, not Project-owned). */
export const dynaxisBrands = pgTable(
  'dynaxis_brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    industry: text('industry'),
    tagline: text('tagline'),
    valueProposition: text('value_proposition'),
    targetAudience: text('target_audience'),
    imageryStyle: text('imagery_style'),
    layoutStyle: text('layout_style'),
    sourceUrl: text('source_url'),
    status: text('status').notNull().default('active'),
    toneOfVoice: jsonb('tone_of_voice').$type().default([]),
    brandPersonality: jsonb('brand_personality').$type().default([]),
    keyMessages: jsonb('key_messages').$type().default([]),
    primaryColors: jsonb('primary_colors').$type().default([]),
    secondaryColors: jsonb('secondary_colors').$type().default([]),
    fonts: jsonb('fonts').$type().default([]),
    primaryAssetId: uuid('primary_asset_id'),
    currentRevisionId: uuid('current_revision_id'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_brands_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_brands_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_brands_status_idx').on(t.ownerRef, t.status),
  })
);

export const dynaxisBrandRevisions = pgTable(
  'dynaxis_brand_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => dynaxisBrands.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    snapshot: jsonb('snapshot').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandRevUidx: uniqueIndex('dynaxis_brand_revisions_brand_rev_uidx').on(
      t.brandId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_brand_revisions_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisBrandAssets = pgTable(
  'dynaxis_brand_assets',
  {
    brandId: uuid('brand_id')
      .notNull()
      .references(() => dynaxisBrands.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    role: text('role').notNull().default('brand_reference'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.brandId, t.assetId] }),
    assetIdx: index('dynaxis_brand_assets_asset_idx').on(t.assetId),
  })
);

export const dynaxisBrandProducts = pgTable(
  'dynaxis_brand_products',
  {
    brandId: uuid('brand_id')
      .notNull()
      .references(() => dynaxisBrands.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => dynaxisProducts.id),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    isPrimary: boolean('is_primary').notNull().default(true),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.brandId, t.productId] }),
    productIdx: index('dynaxis_brand_products_product_idx').on(t.productId),
  })
);

export const dynaxisProjectBrands = pgTable(
  'dynaxis_project_brands',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => dynaxisBrands.id),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.brandId] }),
    brandIdx: index('dynaxis_project_brands_brand_idx').on(t.brandId),
  })
);

/** Project-scoped Brand-led Campaign (not an owner-level reusable identity). */
export const dynaxisCampaigns = pgTable(
  'dynaxis_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id').notNull(),
    name: text('name').notNull(),
    goal: text('goal').notNull(),
    direction: text('direction'),
    status: text('status').notNull().default('draft'),
    selectedConceptId: uuid('selected_concept_id'),
    currentRevisionId: uuid('current_revision_id'),
    includeBrandLogo: boolean('include_brand_logo').notNull().default(false),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_campaigns_owner_idx').on(t.ownerRef),
    projectIdx: index('dynaxis_campaigns_project_idx').on(t.projectId),
    brandIdx: index('dynaxis_campaigns_brand_idx').on(t.brandId),
    statusIdx: index('dynaxis_campaigns_status_idx').on(t.ownerRef, t.status),
  })
);

export const dynaxisCampaignRevisions = pgTable(
  'dynaxis_campaign_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    snapshot: jsonb('snapshot').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignRevUidx: uniqueIndex('dynaxis_campaign_revisions_campaign_rev_uidx').on(
      t.campaignId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_campaign_revisions_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisCampaignProducts = pgTable(
  'dynaxis_campaign_products',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => dynaxisProducts.id),
    productRevisionId: uuid('product_revision_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.productId] }),
    productIdx: index('dynaxis_campaign_products_product_idx').on(t.productId),
  })
);

export const dynaxisCampaignCharacters = pgTable(
  'dynaxis_campaign_characters',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    characterId: uuid('character_id')
      .notNull()
      .references(() => dynaxisCharacters.id),
    characterRevisionId: uuid('character_revision_id').notNull(),
    role: text('role').notNull().default('presenter'),
    sortOrder: integer('sort_order').notNull().default(0),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type().default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.characterId] }),
    characterIdx: index('dynaxis_campaign_characters_character_idx').on(t.characterId),
  })
);

export const dynaxisCampaignConcepts = pgTable(
  'dynaxis_campaign_concepts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    campaignRevisionId: uuid('campaign_revision_id').notNull(),
    ownerRef: text('owner_ref').notNull(),
    title: text('title').notNull(),
    theme: text('theme').notNull(),
    keyMessage: text('key_message').notNull(),
    hook: text('hook').notNull(),
    cta: text('cta').notNull(),
    recommendedFormatIds: jsonb('recommended_format_ids').$type().default([]),
    toneNotes: text('tone_notes'),
    visualDirection: text('visual_direction'),
    status: text('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    provider: text('provider'),
    model: text('model'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index('dynaxis_campaign_concepts_campaign_idx').on(t.campaignId),
    revisionIdx: index('dynaxis_campaign_concepts_revision_idx').on(t.campaignRevisionId),
    ownerIdx: index('dynaxis_campaign_concepts_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisCampaignDeliverables = pgTable(
  'dynaxis_campaign_deliverables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    campaignRevisionId: uuid('campaign_revision_id').notNull(),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => dynaxisCampaignConcepts.id),
    ownerRef: text('owner_ref').notNull(),
    formatId: text('format_id').notNull(),
    outputModality: text('output_modality').notNull().default('image'),
    status: text('status').notNull().default('planned'),
    headline: text('headline'),
    body: text('body'),
    cta: text('cta'),
    generationId: uuid('generation_id'),
    assetId: uuid('asset_id'),
    compositionId: uuid('composition_id'),
    finalAssetId: uuid('final_asset_id'),
    includeBrandLogo: boolean('include_brand_logo').notNull().default(false),
    provider: text('provider'),
    model: text('model'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    outputHistory: jsonb('output_history').$type().default([]),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    campaignIdx: index('dynaxis_campaign_deliverables_campaign_idx').on(t.campaignId),
    conceptIdx: index('dynaxis_campaign_deliverables_concept_idx').on(t.conceptId),
    statusIdx: index('dynaxis_campaign_deliverables_status_idx').on(t.campaignId, t.status),
    ownerIdx: index('dynaxis_campaign_deliverables_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisCampaignAssets = pgTable(
  'dynaxis_campaign_assets',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => dynaxisCampaigns.id),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    role: text('role').notNull().default('campaign_reference'),
    conceptId: uuid('concept_id'),
    deliverableId: uuid('deliverable_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.assetId] }),
    assetIdx: index('dynaxis_campaign_assets_asset_idx').on(t.assetId),
  })
);

/** Non-destructive editable Composition document (not an Asset). */
export const dynaxisCompositions = pgTable(
  'dynaxis_compositions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => dynaxisProjects.id),
    name: text('name').notNull(),
    sourceAssetId: uuid('source_asset_id').references(() => dynaxisAssets.id),
    campaignId: uuid('campaign_id').references(() => dynaxisCampaigns.id),
    campaignRevisionId: uuid('campaign_revision_id'),
    campaignConceptId: uuid('campaign_concept_id'),
    campaignDeliverableId: uuid('campaign_deliverable_id'),
    brandId: uuid('brand_id').references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id'),
    templateId: uuid('template_id'),
    templateRevisionId: uuid('template_revision_id'),
    sourceCompositionId: uuid('source_composition_id'),
    sourceCompositionRevisionId: uuid('source_composition_revision_id'),
    adaptationEngineVersion: text('adaptation_engine_version'),
    adaptationTargetFormatId: text('adaptation_target_format_id'),
    designSystemId: uuid('design_system_id'),
    designSystemRevisionId: uuid('design_system_revision_id'),
    designSystemModes: jsonb('design_system_modes').$type().notNull().default({}),
    canvasWidth: integer('canvas_width').notNull(),
    canvasHeight: integer('canvas_height').notNull(),
    aspectRatio: text('aspect_ratio'),
    status: text('status').notNull().default('draft'),
    document: jsonb('document').$type().notNull().default({}),
    documentVersion: integer('document_version').notNull().default(1),
    currentRevisionId: uuid('current_revision_id'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_compositions_owner_idx').on(t.ownerRef),
    projectIdx: index('dynaxis_compositions_project_idx').on(t.projectId),
    campaignIdx: index('dynaxis_compositions_campaign_idx').on(t.campaignId),
    deliverableIdx: index('dynaxis_compositions_deliverable_idx').on(t.campaignDeliverableId),
    templateIdx: index('dynaxis_compositions_template_idx').on(t.templateId),
    sourceCompIdx: index('dynaxis_compositions_source_comp_idx').on(t.sourceCompositionId),
    designSystemIdx: index('dynaxis_compositions_design_system_idx').on(t.designSystemId),
  })
);

export const dynaxisCompositionRevisions = pgTable(
  'dynaxis_composition_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    compositionId: uuid('composition_id')
      .notNull()
      .references(() => dynaxisCompositions.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    snapshot: jsonb('snapshot').$type().default({}),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    compRevUidx: uniqueIndex('dynaxis_composition_revisions_comp_rev_uidx').on(
      t.compositionId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_composition_revisions_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisCompositionExports = pgTable(
  'dynaxis_composition_exports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    compositionId: uuid('composition_id')
      .notNull()
      .references(() => dynaxisCompositions.id),
    compositionRevisionId: uuid('composition_revision_id')
      .notNull()
      .references(() => dynaxisCompositionRevisions.id),
    ownerRef: text('owner_ref').notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    exportFormat: text('export_format').notNull().default('png'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    renderVersion: text('render_version').notNull().default('resvg-1'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    compIdx: index('dynaxis_composition_exports_comp_idx').on(t.compositionId),
    assetIdx: index('dynaxis_composition_exports_asset_idx').on(t.assetId),
  })
);

export const dynaxisAssetDerivations = pgTable(
  'dynaxis_asset_derivations',
  {
    derivedAssetId: uuid('derived_asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    sourceAssetId: uuid('source_asset_id')
      .notNull()
      .references(() => dynaxisAssets.id),
    ownerRef: text('owner_ref').notNull(),
    compositionId: uuid('composition_id').references(() => dynaxisCompositions.id),
    compositionRevisionId: uuid('composition_revision_id').references(
      () => dynaxisCompositionRevisions.id
    ),
    compositionExportId: uuid('composition_export_id').references(
      () => dynaxisCompositionExports.id
    ),
    campaignId: uuid('campaign_id'),
    campaignDeliverableId: uuid('campaign_deliverable_id'),
    renderFormat: text('render_format'),
    renderVersion: text('render_version'),
    metadata: jsonb('metadata').$type().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.derivedAssetId, t.sourceAssetId] }),
    sourceIdx: index('dynaxis_asset_derivations_source_idx').on(t.sourceAssetId),
    compIdx: index('dynaxis_asset_derivations_comp_idx').on(t.compositionId),
  })
);

/** Owner-scoped Design Templates (reusable across Projects). */
export const dynaxisDesignTemplates = pgTable(
  'dynaxis_design_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('custom'),
    status: text('status').notNull().default('draft'),
    thumbnailAssetId: uuid('thumbnail_asset_id').references(() => dynaxisAssets.id),
    sourceCompositionId: uuid('source_composition_id').references(() => dynaxisCompositions.id),
    brandId: uuid('brand_id').references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id'),
    brandBinding: text('brand_binding').notNull().default('neutral'),
    currentRevisionId: uuid('current_revision_id'),
    tags: jsonb('tags').$type().notNull().default([]),
    metadata: jsonb('metadata').$type().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_design_templates_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_design_templates_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_design_templates_status_idx').on(t.ownerRef, t.status),
    categoryIdx: index('dynaxis_design_templates_category_idx').on(t.category),
  })
);

export const dynaxisDesignTemplateRevisions = pgTable(
  'dynaxis_design_template_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => dynaxisDesignTemplates.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    document: jsonb('document').$type().notNull().default({}),
    canvasWidth: integer('canvas_width').notNull(),
    canvasHeight: integer('canvas_height').notNull(),
    aspectRatio: text('aspect_ratio'),
    sourceCompositionRevisionId: uuid('source_composition_revision_id'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tmplRevUidx: uniqueIndex('dynaxis_design_template_revisions_tmpl_rev_uidx').on(
      t.templateId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_design_template_revisions_owner_idx').on(t.ownerRef),
  })
);

/** Owner-scoped Design Components (reusable visual fragments). */
export const dynaxisDesignComponents = pgTable(
  'dynaxis_design_components',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('custom'),
    status: text('status').notNull().default('draft'),
    thumbnailAssetId: uuid('thumbnail_asset_id').references(() => dynaxisAssets.id),
    brandId: uuid('brand_id').references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id'),
    brandBinding: text('brand_binding').notNull().default('neutral'),
    currentRevisionId: uuid('current_revision_id'),
    tags: jsonb('tags').$type().notNull().default([]),
    metadata: jsonb('metadata').$type().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_design_components_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_design_components_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_design_components_status_idx').on(t.ownerRef, t.status),
    categoryIdx: index('dynaxis_design_components_category_idx').on(t.category),
    brandIdx: index('dynaxis_design_components_brand_idx').on(t.brandId),
  })
);

export const dynaxisDesignComponentRevisions = pgTable(
  'dynaxis_design_component_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    componentId: uuid('component_id')
      .notNull()
      .references(() => dynaxisDesignComponents.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    document: jsonb('document').$type().notNull().default({}),
    intrinsicWidth: integer('intrinsic_width').notNull(),
    intrinsicHeight: integer('intrinsic_height').notNull(),
    propertyDefinitions: jsonb('property_definitions').$type().notNull().default([]),
    sourceCompositionId: uuid('source_composition_id').references(() => dynaxisCompositions.id),
    sourceCompositionRevisionId: uuid('source_composition_revision_id'),
    brandRevisionId: uuid('brand_revision_id'),
    reason: text('reason'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    compRevUidx: uniqueIndex('dynaxis_design_component_revisions_comp_rev_uidx').on(
      t.componentId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_design_component_revisions_owner_idx').on(t.ownerRef),
    componentIdx: index('dynaxis_design_component_revisions_component_idx').on(t.componentId),
  })
);

/** Dependency index — Composition Document remains canonical instance state. */
export const dynaxisCompositionComponentInstances = pgTable(
  'dynaxis_composition_component_instances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    compositionId: uuid('composition_id')
      .notNull()
      .references(() => dynaxisCompositions.id),
    compositionRevisionId: uuid('composition_revision_id').references(
      () => dynaxisCompositionRevisions.id
    ),
    layerId: uuid('layer_id').notNull(),
    componentId: uuid('component_id')
      .notNull()
      .references(() => dynaxisDesignComponents.id),
    componentRevisionId: uuid('component_revision_id')
      .notNull()
      .references(() => dynaxisDesignComponentRevisions.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    layerUidx: uniqueIndex('dynaxis_comp_comp_instances_layer_uidx').on(t.compositionId, t.layerId),
    componentIdx: index('dynaxis_comp_comp_instances_component_idx').on(t.componentId),
    revisionIdx: index('dynaxis_comp_comp_instances_revision_idx').on(t.componentRevisionId),
    ownerIdx: index('dynaxis_comp_comp_instances_owner_idx').on(t.ownerRef),
  })
);

export const dynaxisProjectsRelations = relations(dynaxisProjects, ({ many }) => ({
  generations: many(dynaxisGenerations),
  assets: many(dynaxisAssets),
  jobs: many(dynaxisJobs),
}));

export const dynaxisGenerationsRelations = relations(dynaxisGenerations, ({ one, many }) => ({
  project: one(dynaxisProjects, {
    fields: [dynaxisGenerations.projectId],
    references: [dynaxisProjects.id],
  }),
  jobs: many(dynaxisJobs),
  assets: many(dynaxisAssets),
}));

export const schema = {
  dynaxisProjects,
  dynaxisGenerations,
  dynaxisJobs,
  dynaxisAssets,
  dynaxisGenerationAssets,
  dynaxisCharacters,
  dynaxisCharacterRevisions,
  dynaxisCharacterAssets,
  dynaxisProjectCharacters,
  dynaxisCharacterConversations,
  dynaxisCharacterMessages,
  dynaxisProducts,
  dynaxisProductRevisions,
  dynaxisProductAssets,
  dynaxisProjectProducts,
  dynaxisBrands,
  dynaxisBrandRevisions,
  dynaxisBrandAssets,
  dynaxisBrandProducts,
  dynaxisProjectBrands,
  dynaxisCampaigns,
  dynaxisCampaignRevisions,
  dynaxisCampaignProducts,
  dynaxisCampaignCharacters,
  dynaxisCampaignConcepts,
  dynaxisCampaignDeliverables,
  dynaxisCampaignAssets,
  dynaxisCompositions,
  dynaxisCompositionRevisions,
  dynaxisCompositionExports,
  dynaxisAssetDerivations,
  dynaxisDesignTemplates,
  dynaxisDesignTemplateRevisions,
  dynaxisDesignComponents,
  dynaxisDesignComponentRevisions,
  dynaxisCompositionComponentInstances,
};

/** Owner-scoped Design Systems (token collections + modes). */
export const dynaxisDesignSystems = pgTable(
  'dynaxis_design_systems',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('draft'),
    brandId: uuid('brand_id').references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id'),
    currentRevisionId: uuid('current_revision_id'),
    metadata: jsonb('metadata').$type().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_design_systems_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_design_systems_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_design_systems_status_idx').on(t.ownerRef, t.status),
    brandIdx: index('dynaxis_design_systems_brand_idx').on(t.brandId),
  })
);

export const dynaxisDesignSystemRevisions = pgTable(
  'dynaxis_design_system_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    designSystemId: uuid('design_system_id')
      .notNull()
      .references(() => dynaxisDesignSystems.id),
    ownerRef: text('owner_ref').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    document: jsonb('document').$type().notNull().default({}),
    brandRevisionId: uuid('brand_revision_id'),
    reason: text('reason'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sysRevUidx: uniqueIndex('dynaxis_design_system_revisions_sys_rev_uidx').on(
      t.designSystemId,
      t.revisionNumber
    ),
    ownerIdx: index('dynaxis_design_system_revisions_owner_idx').on(t.ownerRef),
  })
);

/** Component Sets — optional variant grouping of Design Components. */
export const dynaxisDesignComponentSets = pgTable(
  'dynaxis_design_component_sets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerRef: text('owner_ref').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('custom'),
    status: text('status').notNull().default('draft'),
    brandId: uuid('brand_id').references(() => dynaxisBrands.id),
    brandRevisionId: uuid('brand_revision_id'),
    thumbnailAssetId: uuid('thumbnail_asset_id').references(() => dynaxisAssets.id),
    variantAxes: jsonb('variant_axes').$type().notNull().default([]),
    defaultCombination: jsonb('default_combination').$type().notNull().default({}),
    tags: jsonb('tags').$type().notNull().default([]),
    metadata: jsonb('metadata').$type().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('dynaxis_design_component_sets_owner_idx').on(t.ownerRef),
    organizationIdx: index('dynaxis_design_component_sets_organization_idx').on(t.organizationId),
    statusIdx: index('dynaxis_design_component_sets_status_idx').on(t.ownerRef, t.status),
    categoryIdx: index('dynaxis_design_component_sets_category_idx').on(t.category),
  })
);

export const dynaxisDesignComponentSetVariants = pgTable(
  'dynaxis_design_component_set_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    componentSetId: uuid('component_set_id')
      .notNull()
      .references(() => dynaxisDesignComponentSets.id),
    ownerRef: text('owner_ref').notNull(),
    combinationKey: text('combination_key').notNull(),
    combination: jsonb('combination').$type().notNull().default({}),
    componentId: uuid('component_id')
      .notNull()
      .references(() => dynaxisDesignComponents.id),
    componentRevisionId: uuid('component_revision_id')
      .notNull()
      .references(() => dynaxisDesignComponentRevisions.id),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUidx: uniqueIndex('dynaxis_design_comp_set_variants_key_uidx').on(
      t.componentSetId,
      t.combinationKey
    ),
    setIdx: index('dynaxis_design_comp_set_variants_set_idx').on(t.componentSetId),
    componentIdx: index('dynaxis_design_comp_set_variants_component_idx').on(t.componentId),
    ownerIdx: index('dynaxis_design_comp_set_variants_owner_idx').on(t.ownerRef),
  })
);

// Re-export schema with Design Systems + Component Sets
Object.assign(schema, {
  dynaxisDesignSystems,
  dynaxisDesignSystemRevisions,
  dynaxisDesignComponentSets,
  dynaxisDesignComponentSetVariants,
});
