/**
 * In-memory Character-domain store methods (tests).
 * Mixed into createMemoryStore().
 */

import { randomUUID } from 'node:crypto';

function now() {
  return new Date();
}

function clone(row) {
  return row == null ? row : JSON.parse(JSON.stringify(row));
}

/**
 * @param {object} maps
 */
export function createCharacterMemoryMethods(maps) {
  const {
    characters,
    characterRevisions,
    characterAssets,
    projectCharacters,
    conversations,
    messages,
    assets,
    projects,
  } = maps;

  return {
    async createCharacter(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        name: data.name,
        description: data.description ?? null,
        backstory: data.backstory ?? null,
        persona: data.persona ?? null,
        systemPrompt: data.systemPrompt ?? null,
        greeting: data.greeting ?? null,
        category: data.category ?? null,
        status: data.status || 'active',
        source: data.source || 'dynaxis',
        primaryAssetId: data.primaryAssetId ?? null,
        currentRevisionId: null,
        canonicalModel: data.canonicalModel ?? null,
        config: data.config || {},
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      characters.set(row.id, row);
      return clone(row);
    },

    async getCharacter(ownerRef, id) {
      const row = characters.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCharacters(ownerRef, { includeArchived = false, limit = 100 } = {}) {
      return [...characters.values()]
        .filter((c) => c.ownerRef === ownerRef)
        .filter((c) => includeArchived || c.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateCharacter(ownerRef, id, patch) {
      const row = characters.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createCharacterRevision(data) {
      const existing = [...characterRevisions.values()].filter(
        (r) => r.characterId === data.characterId
      );
      const revisionNumber =
        data.revisionNumber ??
        (existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1);
      const row = {
        id: randomUUID(),
        characterId: data.characterId,
        ownerRef: data.ownerRef,
        revisionNumber,
        name: data.name,
        description: data.description ?? null,
        backstory: data.backstory ?? null,
        persona: data.persona ?? null,
        systemPrompt: data.systemPrompt ?? null,
        greeting: data.greeting ?? null,
        category: data.category ?? null,
        canonicalModel: data.canonicalModel ?? null,
        config: data.config || {},
        snapshot: data.snapshot || {},
        createdAt: now(),
      };
      characterRevisions.set(row.id, row);
      return clone(row);
    },

    async getCharacterRevision(ownerRef, id) {
      const row = characterRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCharacterRevisions(ownerRef, characterId) {
      return [...characterRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.characterId === characterId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async linkCharacterAsset({
      characterId,
      assetId,
      role = 'identity_reference',
      sortOrder = 0,
      isPrimary = false,
    }) {
      const key = `${characterId}:${assetId}`;
      const row = {
        characterId,
        assetId,
        role,
        sortOrder,
        isPrimary,
        createdAt: now(),
      };
      characterAssets.set(key, row);
      return clone(row);
    },

    async unlinkCharacterAsset(characterId, assetId) {
      const key = `${characterId}:${assetId}`;
      const existed = characterAssets.has(key);
      characterAssets.delete(key);
      return existed;
    },

    async listCharacterAssets(characterId) {
      const links = [...characterAssets.values()]
        .filter((l) => l.characterId === characterId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return links.map((l) => {
        const asset = assets.get(l.assetId);
        return asset
          ? { ...clone(l), asset: clone(asset) }
          : clone(l);
      });
    },

    async linkProjectCharacter(projectId, characterId, metadata = {}) {
      const key = `${projectId}:${characterId}`;
      const row = {
        projectId,
        characterId,
        linkedAt: now(),
        metadata,
      };
      projectCharacters.set(key, row);
      return clone(row);
    },

    async unlinkProjectCharacter(projectId, characterId) {
      const key = `${projectId}:${characterId}`;
      const existed = projectCharacters.has(key);
      projectCharacters.delete(key);
      return existed;
    },

    async listProjectCharacters(projectId) {
      return [...projectCharacters.values()]
        .filter((l) => l.projectId === projectId)
        .map(clone);
    },

    async listCharacterProjects(characterId) {
      return [...projectCharacters.values()]
        .filter((l) => l.characterId === characterId)
        .map((l) => {
          const project = projects.get(l.projectId);
          return { ...clone(l), project: project ? clone(project) : null };
        });
    },

    async createCharacterConversation(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        characterId: data.characterId,
        characterRevisionId: data.characterRevisionId ?? null,
        projectId: data.projectId ?? null,
        title: data.title ?? null,
        status: data.status || 'active',
        model: data.model ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
      };
      conversations.set(row.id, row);
      return clone(row);
    },

    async getCharacterConversation(ownerRef, id) {
      const row = conversations.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCharacterConversations(ownerRef, { characterId, limit = 50 } = {}) {
      return [...conversations.values()]
        .filter((c) => c.ownerRef === ownerRef)
        .filter((c) => !characterId || c.characterId === characterId)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateCharacterConversation(ownerRef, id, patch) {
      const row = conversations.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createCharacterMessage(data) {
      const row = {
        id: randomUUID(),
        conversationId: data.conversationId,
        ownerRef: data.ownerRef,
        role: data.role,
        content: data.content,
        model: data.model ?? null,
        characterRevisionId: data.characterRevisionId ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
      };
      messages.set(row.id, row);
      return clone(row);
    },

    async listCharacterMessages(conversationId, { limit = 200 } = {}) {
      return [...messages.values()]
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, limit)
        .map(clone);
    },
  };
}
