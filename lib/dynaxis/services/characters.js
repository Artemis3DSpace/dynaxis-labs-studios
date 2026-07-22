/**
 * Dynaxis Character service — persistent reusable creative identities.
 * Characters belong to owner_ref, may link to many Projects, and reference Assets.
 * Continuity strategy: reference-based (not trained identity / LoRA).
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import { ASSET_SEMANTIC_ROLES } from '../mini-apps/permissions.js';
import {
  CHARACTER_CATEGORIES,
  CHARACTER_CONTINUITY_STRATEGY,
  CHARACTER_VISUAL_MODELS,
} from '../types.js';
import { resolveProjectId } from './projects.js';

const roleEnum = z.enum(ASSET_SEMANTIC_ROLES);

export const createCharacterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  backstory: z.string().trim().max(20000).optional().nullable(),
  persona: z.string().trim().max(20000).optional().nullable(),
  systemPrompt: z.string().trim().max(20000).optional().nullable(),
  greeting: z.string().trim().max(4000).optional().nullable(),
  category: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .refine(
      (v) => v == null || v === '' || CHARACTER_CATEGORIES.includes(/** @type {any} */ (v)),
      'Invalid character category'
    ),
  canonicalModel: z.string().max(200).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  projectId: z.string().uuid().optional().nullable(),
});

export const updateCharacterSchema = createCharacterSchema
  .omit({ projectId: true })
  .partial()
  .extend({
    status: z.enum(['active', 'archived']).optional(),
  });

export const linkCharacterAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: roleEnum.default('identity_reference'),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  createRevision: z.boolean().optional().default(true),
});

function notFound(code, message) {
  const err = new Error(message);
  err.status = 404;
  err.code = code;
  return err;
}

function forbidden(code, message) {
  const err = new Error(message);
  err.status = 403;
  err.code = code;
  return err;
}

async function requireCharacter(store, ownerRef, characterId) {
  const character = await store.getCharacter(ownerRef, characterId);
  if (!character) throw notFound('CHARACTER_NOT_FOUND', 'Character not found');
  return character;
}

async function requireOwnedAsset(store, ownerRef, assetId) {
  const asset = await store.getAsset(ownerRef, assetId);
  if (!asset) throw notFound('ASSET_NOT_FOUND', 'Asset not found');
  return asset;
}

function profileFromCharacter(character) {
  return {
    name: character.name,
    description: character.description,
    backstory: character.backstory,
    persona: character.persona,
    systemPrompt: character.systemPrompt,
    greeting: character.greeting,
    category: character.category,
    canonicalModel: character.canonicalModel,
    config: character.config || {},
  };
}

/**
 * Snapshot Character state into a new revision and point currentRevisionId at it.
 */
export async function createRevisionForCharacter(ownerRef, characterId, { reason } = {}) {
  const store = await getPlatformStore();
  const character = await requireCharacter(store, ownerRef, characterId);
  const assetLinks = await store.listCharacterAssets(characterId);
  const revision = await store.createCharacterRevision({
    characterId,
    ownerRef,
    ...profileFromCharacter(character),
    snapshot: {
      continuity: CHARACTER_CONTINUITY_STRATEGY,
      reason: reason || 'update',
      primaryAssetId: character.primaryAssetId,
      assets: assetLinks.map((l) => ({
        assetId: l.assetId,
        role: l.role,
        sortOrder: l.sortOrder,
        isPrimary: l.isPrimary,
        url: l.asset?.url || null,
      })),
    },
  });
  await store.updateCharacter(ownerRef, characterId, {
    currentRevisionId: revision.id,
  });
  return revision;
}

export async function createCharacter(ownerRef, input) {
  const data = createCharacterSchema.parse(input);
  const store = await getPlatformStore();
  const character = await store.createCharacter({
    ownerRef,
    name: data.name,
    description: data.description ?? null,
    backstory: data.backstory ?? null,
    persona: data.persona ?? null,
    systemPrompt:
      data.systemPrompt ||
      buildDefaultSystemPrompt({
        name: data.name,
        persona: data.persona,
        backstory: data.backstory,
      }),
    greeting: data.greeting || `Hello! I'm ${data.name}. How can I help you today?`,
    category: data.category || 'Original',
    canonicalModel: data.canonicalModel || CHARACTER_VISUAL_MODELS.generate,
    config: data.config || {},
    metadata: {
      ...(data.metadata || {}),
      continuity: CHARACTER_CONTINUITY_STRATEGY,
    },
  });

  const revision = await createRevisionForCharacter(ownerRef, character.id, {
    reason: 'create',
  });

  let projectLink = null;
  if (data.projectId) {
    const project = await resolveProjectId(ownerRef, data.projectId);
    projectLink = await store.linkProjectCharacter(project.id, character.id);
  }

  return {
    character: await store.getCharacter(ownerRef, character.id),
    revision,
    projectLink,
  };
}

export async function getCharacter(ownerRef, id, { includeAssets = false } = {}) {
  const store = await getPlatformStore();
  const character = await store.getCharacter(ownerRef, id);
  if (!character) return null;
  if (!includeAssets) return character;
  const assets = await store.listCharacterAssets(id);
  return { ...character, assets };
}

export async function listCharacters(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listCharacters(ownerRef, opts);
}

export async function updateCharacter(ownerRef, id, input) {
  const data = updateCharacterSchema.parse(input);
  const store = await getPlatformStore();
  const existing = await requireCharacter(store, ownerRef, id);
  const patch = {};
  for (const key of [
    'name',
    'description',
    'backstory',
    'persona',
    'systemPrompt',
    'greeting',
    'category',
    'canonicalModel',
    'config',
    'metadata',
    'status',
  ]) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  if (data.status === 'archived') {
    patch.archivedAt = new Date();
  }
  if (data.status === 'active' && existing.status === 'archived') {
    patch.archivedAt = null;
  }
  const character = await store.updateCharacter(ownerRef, id, patch);
  const revision = await createRevisionForCharacter(ownerRef, id, { reason: 'profile_update' });
  return {
    character: await store.getCharacter(ownerRef, id),
    revision,
  };
}

export async function archiveCharacter(ownerRef, id) {
  return updateCharacter(ownerRef, id, { status: 'archived' });
}

export async function addCharacterAsset(ownerRef, characterId, input) {
  const data = linkCharacterAssetSchema.parse(input);
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  await requireOwnedAsset(store, ownerRef, data.assetId);

  const existing = await store.listCharacterAssets(characterId);
  const sortOrder = data.sortOrder ?? existing.length;

  if (data.isPrimary) {
    for (const link of existing) {
      if (link.isPrimary) {
        await store.linkCharacterAsset({
          characterId,
          assetId: link.assetId,
          role: link.role,
          sortOrder: link.sortOrder,
          isPrimary: false,
        });
      }
    }
  }

  const link = await store.linkCharacterAsset({
    characterId,
    assetId: data.assetId,
    role: data.role,
    sortOrder,
    isPrimary: Boolean(data.isPrimary),
  });

  if (data.isPrimary) {
    await store.updateCharacter(ownerRef, characterId, {
      primaryAssetId: data.assetId,
    });
  }

  let revision = null;
  if (data.createRevision) {
    revision = await createRevisionForCharacter(ownerRef, characterId, {
      reason: 'asset_link',
    });
  }

  return { link, revision, character: await store.getCharacter(ownerRef, characterId) };
}

export async function removeCharacterAsset(ownerRef, characterId, assetId) {
  const store = await getPlatformStore();
  const character = await requireCharacter(store, ownerRef, characterId);
  const removed = await store.unlinkCharacterAsset(characterId, assetId);
  if (!removed) throw notFound('CHARACTER_ASSET_NOT_FOUND', 'Character asset link not found');
  const patch = {};
  if (character.primaryAssetId === assetId) {
    patch.primaryAssetId = null;
  }
  if (Object.keys(patch).length) {
    await store.updateCharacter(ownerRef, characterId, patch);
  }
  const revision = await createRevisionForCharacter(ownerRef, characterId, {
    reason: 'asset_unlink',
  });
  return { removed: true, revision };
}

export async function listCharacterAssets(ownerRef, characterId) {
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  return store.listCharacterAssets(characterId);
}

/**
 * Promote a generated Asset to a Character identity/reference Asset (no image copy).
 */
export async function promoteAssetToReference(ownerRef, characterId, assetId, opts = {}) {
  return addCharacterAsset(ownerRef, characterId, {
    assetId,
    role: opts.role || 'identity_reference',
    isPrimary: opts.isPrimary !== false,
    createRevision: true,
  });
}

export async function linkCharacterToProject(ownerRef, characterId, projectId) {
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  const project = await resolveProjectId(ownerRef, projectId);
  if (project.ownerRef && project.ownerRef !== ownerRef) {
    throw forbidden('PROJECT_OWNERSHIP', 'Project ownership mismatch');
  }
  const link = await store.linkProjectCharacter(project.id, characterId);
  return { link, project };
}

export async function unlinkCharacterFromProject(ownerRef, characterId, projectId) {
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  const project = await resolveProjectId(ownerRef, projectId);
  const removed = await store.unlinkProjectCharacter(project.id, characterId);
  return { removed };
}

export async function listCharacterProjects(ownerRef, characterId) {
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  return store.listCharacterProjects(characterId);
}

export async function listCharacterRevisions(ownerRef, characterId) {
  const store = await getPlatformStore();
  await requireCharacter(store, ownerRef, characterId);
  return store.listCharacterRevisions(ownerRef, characterId);
}

export async function getCharacterRevision(ownerRef, revisionId) {
  const store = await getPlatformStore();
  return store.getCharacterRevision(ownerRef, revisionId);
}

/**
 * Build a default persona system prompt from Character fields.
 */
export function buildDefaultSystemPrompt({ name, persona, backstory }) {
  const parts = [
    `You are ${name || 'a character'}.`,
    'Stay in character. Do not claim to be a generic AI assistant.',
  ];
  if (persona) parts.push(`Persona:\n${persona}`);
  if (backstory) parts.push(`Backstory:\n${backstory}`);
  return parts.join('\n\n');
}

/**
 * Resolve the effective system prompt for chat / generation.
 */
export function buildCharacterSystemPrompt(character, revision = null) {
  const src = revision || character;
  if (src.systemPrompt && String(src.systemPrompt).trim()) {
    return String(src.systemPrompt).trim();
  }
  return buildDefaultSystemPrompt({
    name: src.name,
    persona: src.persona,
    backstory: src.backstory,
  });
}

export const characterServiceImpl = {
  create: createCharacter,
  get: getCharacter,
  list: listCharacters,
  update: updateCharacter,
  archive: archiveCharacter,
  addAsset: addCharacterAsset,
  removeAsset: removeCharacterAsset,
  listAssets: listCharacterAssets,
  promoteAsset: promoteAssetToReference,
  linkProject: linkCharacterToProject,
  unlinkProject: unlinkCharacterFromProject,
  listProjects: listCharacterProjects,
  listRevisions: listCharacterRevisions,
  createRevision: createRevisionForCharacter,
  buildSystemPrompt: buildCharacterSystemPrompt,
};
