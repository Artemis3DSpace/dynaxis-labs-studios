/**
 * In-memory Campaign-domain store methods (tests).
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
export function createCampaignMemoryMethods(maps) {
  const {
    campaigns,
    campaignRevisions,
    campaignProducts,
    campaignCharacters,
    campaignConcepts,
    campaignDeliverables,
    campaignAssets,
    assets,
    projects,
    products,
    characters,
    brands,
  } = maps;

  return {
    async createCampaign(data) {
      const row = {
        id: randomUUID(),
        ownerRef: data.ownerRef,
        projectId: data.projectId,
        brandId: data.brandId,
        brandRevisionId: data.brandRevisionId,
        name: data.name,
        goal: data.goal,
        direction: data.direction ?? null,
        status: data.status || 'draft',
        selectedConceptId: data.selectedConceptId ?? null,
        currentRevisionId: null,
        includeBrandLogo: Boolean(data.includeBrandLogo),
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      };
      campaigns.set(row.id, row);
      return clone(row);
    },

    async getCampaign(ownerRef, id) {
      const row = campaigns.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCampaigns(
      ownerRef,
      { projectId = null, includeArchived = false, limit = 100 } = {}
    ) {
      return [...campaigns.values()]
        .filter((c) => c.ownerRef === ownerRef)
        .filter((c) => !projectId || c.projectId === projectId)
        .filter((c) => includeArchived || c.status !== 'archived')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateCampaign(ownerRef, id, patch) {
      const row = campaigns.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createCampaignRevision(data) {
      const existing = [...campaignRevisions.values()].filter(
        (r) => r.campaignId === data.campaignId
      );
      const revisionNumber =
        data.revisionNumber ??
        (existing.reduce((m, r) => Math.max(m, r.revisionNumber), 0) + 1);
      const row = {
        id: randomUUID(),
        campaignId: data.campaignId,
        ownerRef: data.ownerRef,
        revisionNumber,
        snapshot: data.snapshot || {},
        createdAt: now(),
      };
      campaignRevisions.set(row.id, row);
      return clone(row);
    },

    async getCampaignRevision(ownerRef, id) {
      const row = campaignRevisions.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCampaignRevisions(ownerRef, campaignId) {
      return [...campaignRevisions.values()]
        .filter((r) => r.ownerRef === ownerRef && r.campaignId === campaignId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map(clone);
    },

    async linkCampaignProduct(data) {
      const key = `${data.campaignId}:${data.productId}`;
      const row = {
        campaignId: data.campaignId,
        productId: data.productId,
        productRevisionId: data.productRevisionId,
        sortOrder: data.sortOrder ?? 0,
        linkedAt: now(),
        metadata: data.metadata || {},
      };
      campaignProducts.set(key, row);
      return clone(row);
    },

    async unlinkCampaignProduct(campaignId, productId) {
      return campaignProducts.delete(`${campaignId}:${productId}`);
    },

    async listCampaignProducts(campaignId) {
      return [...campaignProducts.values()]
        .filter((l) => l.campaignId === campaignId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((l) => {
          const product = products?.get?.(l.productId);
          return clone({ ...l, product: product ? clone(product) : null });
        });
    },

    async linkCampaignCharacter(data) {
      const key = `${data.campaignId}:${data.characterId}`;
      const row = {
        campaignId: data.campaignId,
        characterId: data.characterId,
        characterRevisionId: data.characterRevisionId,
        role: data.role || 'presenter',
        sortOrder: data.sortOrder ?? 0,
        linkedAt: now(),
        metadata: data.metadata || {},
      };
      campaignCharacters.set(key, row);
      return clone(row);
    },

    async unlinkCampaignCharacter(campaignId, characterId) {
      return campaignCharacters.delete(`${campaignId}:${characterId}`);
    },

    async listCampaignCharacters(campaignId) {
      return [...campaignCharacters.values()]
        .filter((l) => l.campaignId === campaignId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((l) => {
          const character = characters?.get?.(l.characterId);
          return clone({ ...l, character: character ? clone(character) : null });
        });
    },

    async createCampaignConcept(data) {
      const row = {
        id: randomUUID(),
        campaignId: data.campaignId,
        campaignRevisionId: data.campaignRevisionId,
        ownerRef: data.ownerRef,
        title: data.title,
        theme: data.theme,
        keyMessage: data.keyMessage,
        hook: data.hook,
        cta: data.cta,
        recommendedFormatIds: data.recommendedFormatIds || [],
        toneNotes: data.toneNotes ?? null,
        visualDirection: data.visualDirection ?? null,
        status: data.status || 'draft',
        sortOrder: data.sortOrder ?? 0,
        provider: data.provider ?? null,
        model: data.model ?? null,
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
      };
      campaignConcepts.set(row.id, row);
      return clone(row);
    },

    async getCampaignConcept(ownerRef, id) {
      const row = campaignConcepts.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCampaignConcepts(ownerRef, campaignId) {
      return [...campaignConcepts.values()]
        .filter((c) => c.ownerRef === ownerRef && c.campaignId === campaignId)
        .sort((a, b) => {
          if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
            return (a.sortOrder || 0) - (b.sortOrder || 0);
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        })
        .map(clone);
    },

    async updateCampaignConcept(ownerRef, id, patch) {
      const row = campaignConcepts.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async createCampaignDeliverable(data) {
      const row = {
        id: randomUUID(),
        campaignId: data.campaignId,
        campaignRevisionId: data.campaignRevisionId,
        conceptId: data.conceptId,
        ownerRef: data.ownerRef,
        formatId: data.formatId,
        outputModality: data.outputModality || 'image',
        status: data.status || 'planned',
        headline: data.headline ?? null,
        body: data.body ?? null,
        cta: data.cta ?? null,
        generationId: data.generationId ?? null,
        assetId: data.assetId ?? null,
        compositionId: data.compositionId ?? null,
        finalAssetId: data.finalAssetId ?? null,
        includeBrandLogo: Boolean(data.includeBrandLogo),
        provider: data.provider ?? null,
        model: data.model ?? null,
        errorCode: data.errorCode ?? null,
        errorMessage: data.errorMessage ?? null,
        outputHistory: data.outputHistory || [],
        metadata: data.metadata || {},
        createdAt: now(),
        updatedAt: now(),
        completedAt: data.completedAt ?? null,
      };
      campaignDeliverables.set(row.id, row);
      return clone(row);
    },

    async getCampaignDeliverable(ownerRef, id) {
      const row = campaignDeliverables.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      return clone(row);
    },

    async listCampaignDeliverables(
      ownerRef,
      campaignId,
      { conceptId = null, status = null, limit = 100 } = {}
    ) {
      return [...campaignDeliverables.values()]
        .filter((d) => d.ownerRef === ownerRef && d.campaignId === campaignId)
        .filter((d) => !conceptId || d.conceptId === conceptId)
        .filter((d) => !status || d.status === status)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit)
        .map(clone);
    },

    async updateCampaignDeliverable(ownerRef, id, patch) {
      const row = campaignDeliverables.get(id);
      if (!row || row.ownerRef !== ownerRef) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return clone(row);
    },

    async linkCampaignAsset(data) {
      const key = `${data.campaignId}:${data.assetId}`;
      const row = {
        campaignId: data.campaignId,
        assetId: data.assetId,
        role: data.role || 'campaign_reference',
        conceptId: data.conceptId ?? null,
        deliverableId: data.deliverableId ?? null,
        sortOrder: data.sortOrder ?? 0,
        createdAt: now(),
      };
      campaignAssets.set(key, row);
      return clone(row);
    },

    async unlinkCampaignAsset(campaignId, assetId) {
      return campaignAssets.delete(`${campaignId}:${assetId}`);
    },

    async listCampaignAssets(campaignId) {
      const links = [...campaignAssets.values()]
        .filter((l) => l.campaignId === campaignId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      return links.map((l) => {
        const asset = assets.get(l.assetId);
        return clone({ ...l, asset: asset ? clone(asset) : null });
      });
    },
  };
}
