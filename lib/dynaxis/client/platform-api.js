/**
 * Browser client for Dynaxis platform HTTP APIs.
 */

/**
 * @param {string} apiKey
 * @param {string} path
 * @param {RequestInit & { query?: Record<string, string|undefined> }} [opts]
 */
export async function platformFetch(apiKey, path, opts = {}) {
  const { query, ...init } = opts;
  let url = path.startsWith('/') ? path : `/api/dynaxis/${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', apiKey);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Platform API ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.payload = data;
    throw err;
  }
  return data;
}

export function createPlatformClient(apiKey) {
  return {
    health: () => fetch('/api/dynaxis/health').then((r) => r.json()),
    listProjects: (query) => platformFetch(apiKey, '/api/dynaxis/projects', { query }),
    createProject: (body) =>
      platformFetch(apiKey, '/api/dynaxis/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateProject: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    listAssets: (query) => platformFetch(apiKey, '/api/dynaxis/assets', { query }),
    getAsset: (id) => platformFetch(apiKey, `/api/dynaxis/assets/${id}`),
    getAssetContent: async (id) => {
      const res = await fetch(`/api/dynaxis/assets/${id}/content`, {
        headers: { 'x-api-key': apiKey },
      });
      if (!res.ok) {
        const err = new Error(`Asset content fetch failed: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.blob();
    },
    registerAsset: (body) =>
      platformFetch(apiKey, '/api/dynaxis/assets', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    listGenerations: (query) => platformFetch(apiKey, '/api/dynaxis/generations', { query }),
    getJob: (id) => platformFetch(apiKey, `/api/dynaxis/jobs/${id}`),
    importHistory: (body) =>
      platformFetch(apiKey, '/api/dynaxis/history/import', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    lifecycleStart: (body) =>
      platformFetch(apiKey, '/api/dynaxis/lifecycle/start', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    lifecycleProviderId: (body) =>
      platformFetch(apiKey, '/api/dynaxis/lifecycle/provider-id', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    lifecycleComplete: (body) =>
      platformFetch(apiKey, '/api/dynaxis/lifecycle/complete', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    lifecycleFail: (body) =>
      platformFetch(apiKey, '/api/dynaxis/lifecycle/fail', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listCharacters: (query) => platformFetch(apiKey, '/api/dynaxis/characters', { query }),
    createCharacter: (body) =>
      platformFetch(apiKey, '/api/dynaxis/characters', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCharacter: (id, query) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}`, { query }),
    updateCharacter: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    listCharacterAssets: (id) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}/assets`),
    addCharacterAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    promoteCharacterAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify({ ...body, promote: true }),
      }),
    linkCharacterToProject: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}/projects`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    listCharacterRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/characters/${id}/revisions`),
    startCharacterConversation: (body) =>
      platformFetch(apiKey, '/api/dynaxis/character-conversations', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCharacterConversation: (id) =>
      platformFetch(apiKey, `/api/dynaxis/character-conversations/${id}`),
    sendCharacterMessage: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/character-conversations/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listProducts: (query) => platformFetch(apiKey, '/api/dynaxis/products', { query }),
    createProduct: (body) =>
      platformFetch(apiKey, '/api/dynaxis/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getProduct: (id, query) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}`, { query }),
    updateProduct: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveProduct: (id) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}`, {
        method: 'DELETE',
      }),
    listProductAssets: (id) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/assets`),
    addProductAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    promoteProductAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify({ ...body, promote: true }),
      }),
    removeProductAsset: (id, assetId) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/assets`, {
        method: 'DELETE',
        query: { assetId },
      }),
    linkProductToProject: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/projects`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkProductFromProject: (id, projectId) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/projects`, {
        method: 'DELETE',
        query: { projectId },
      }),
    listProductRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/revisions`),
    listProductBrands: (id) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/brands`),
    linkProductToBrand: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/brands`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkProductFromBrand: (id, brandId) =>
      platformFetch(apiKey, `/api/dynaxis/products/${id}/brands`, {
        method: 'DELETE',
        query: { brandId },
      }),

    listBrands: (query) => platformFetch(apiKey, '/api/dynaxis/brands', { query }),
    createBrand: (body) =>
      platformFetch(apiKey, '/api/dynaxis/brands', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getBrand: (id, query) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}`, { query }),
    updateBrand: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveBrand: (id) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}`, {
        method: 'DELETE',
      }),
    listBrandAssets: (id) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/assets`),
    addBrandAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    promoteBrandAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify({ ...body, promote: true }),
      }),
    removeBrandAsset: (id, assetId) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/assets`, {
        method: 'DELETE',
        query: { assetId },
      }),
    linkBrandToProject: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/projects`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkBrandFromProject: (id, projectId) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/projects`, {
        method: 'DELETE',
        query: { projectId },
      }),
    linkBrandToProduct: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/products`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkBrandFromProduct: (id, productId) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/products`, {
        method: 'DELETE',
        query: { productId },
      }),
    listBrandProducts: (id) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/products`),
    listBrandProjects: (id) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/projects`),
    listBrandRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/brands/${id}/revisions`),
    analyzeBrandWebsite: (body) =>
      platformFetch(apiKey, '/api/dynaxis/brands/analyze', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listCampaigns: (query) =>
      platformFetch(apiKey, '/api/dynaxis/campaigns', { query }),
    createCampaign: (body) =>
      platformFetch(apiKey, '/api/dynaxis/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCampaign: (id, query) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}`, { query }),
    updateCampaign: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveCampaign: (id) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}`, {
        method: 'DELETE',
      }),
    listCampaignConcepts: (id) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/concepts`),
    generateCampaignConcepts: (id, body = {}) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/concepts`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCampaignConcept: (id, conceptId) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/concepts/${conceptId}`),
    updateCampaignConcept: (id, conceptId, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/concepts/${conceptId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    selectCampaignConcept: (id, conceptId) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/concepts/${conceptId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'select' }),
      }),
    listCampaignDeliverables: (id, query) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/deliverables`, { query }),
    createCampaignDeliverables: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/deliverables`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCampaignDeliverable: (id, deliverableId) =>
      platformFetch(
        apiKey,
        `/api/dynaxis/campaigns/${id}/deliverables/${deliverableId}`
      ),
    campaignDeliverableAction: (id, deliverableId, body) =>
      platformFetch(
        apiKey,
        `/api/dynaxis/campaigns/${id}/deliverables/${deliverableId}`,
        { method: 'POST', body: JSON.stringify(body) }
      ),
    linkCampaignProduct: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/products`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkCampaignProduct: (id, productId) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/products`, {
        method: 'DELETE',
        query: { productId },
      }),
    linkCampaignCharacter: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/characters`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    unlinkCampaignCharacter: (id, characterId) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/characters`, {
        method: 'DELETE',
        query: { characterId },
      }),
    listCampaignAssets: (id) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/assets`),
    attachCampaignAsset: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    removeCampaignAsset: (id, assetId) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/assets`, {
        method: 'DELETE',
        query: { assetId },
      }),
    listCampaignRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/campaigns/${id}/revisions`),

    listCompositions: (query) =>
      platformFetch(apiKey, '/api/dynaxis/compositions', { query }),
    createCompositionFromAsset: (body) =>
      platformFetch(apiKey, '/api/dynaxis/compositions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createCompositionFromDeliverable: (body) =>
      platformFetch(apiKey, '/api/dynaxis/compositions/from-deliverable', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getComposition: (id) => platformFetch(apiKey, `/api/dynaxis/compositions/${id}`),
    updateCompositionDraft: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/compositions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveComposition: (id) =>
      platformFetch(apiKey, `/api/dynaxis/compositions/${id}`, { method: 'DELETE' }),
    saveCompositionRevision: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/compositions/${id}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    exportComposition: (id) =>
      platformFetch(apiKey, `/api/dynaxis/compositions/${id}/export`, { method: 'POST' }),
    compositionAction: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/compositions/${id}/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    adaptComposition: (body) =>
      platformFetch(apiKey, '/api/dynaxis/compositions/adapt', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listDesignTemplates: (query) =>
      platformFetch(apiKey, '/api/dynaxis/design-templates', { query }),
    createDesignTemplate: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-templates', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createTemplateFromComposition: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-templates', {
        method: 'POST',
        body: JSON.stringify({ ...body, fromComposition: true }),
      }),
    getDesignTemplate: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}`),
    updateDesignTemplate: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveDesignTemplate: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}`, {
        method: 'DELETE',
      }),
    listDesignTemplateRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}/revisions`),
    createDesignTemplateRevision: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignTemplateRevision: (id, revisionId) =>
      platformFetch(
        apiKey,
        `/api/dynaxis/design-templates/${id}/revisions/${revisionId}`
      ),
    instantiateDesignTemplate: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-templates/instantiate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    setDesignTemplateThumbnail: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-templates/${id}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listDesignComponents: (query) =>
      platformFetch(apiKey, '/api/dynaxis/design-components', { query }),
    createDesignComponent: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-components', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createComponentFromLayers: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-components/from-layers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignComponent: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}`),
    updateDesignComponent: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveDesignComponent: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}`, {
        method: 'DELETE',
      }),
    listDesignComponentRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}/revisions`),
    createDesignComponentRevision: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignComponentRevision: (id, revisionId) =>
      platformFetch(
        apiKey,
        `/api/dynaxis/design-components/${id}/revisions/${revisionId}`
      ),
    instantiateDesignComponent: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-components/instantiate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    detachComponentInstance: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-components/detach', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateComponentInstanceRevision: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-components/update-instance-revision', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    generateDesignComponentThumbnail: (id, body = {}) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    listDesignComponentUsage: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-components/${id}/usage`),

    listDesignSystems: (query) =>
      platformFetch(apiKey, '/api/dynaxis/design-systems', { query }),
    createDesignSystem: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-systems', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createDesignSystemFromBrand: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-systems/from-brand', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignSystem: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-systems/${id}`),
    updateDesignSystem: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-systems/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveDesignSystem: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-systems/${id}`, {
        method: 'DELETE',
      }),
    listDesignSystemRevisions: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-systems/${id}/revisions`),
    createDesignSystemRevision: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-systems/${id}/revisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignSystemRevision: (id, revisionId) =>
      platformFetch(
        apiKey,
        `/api/dynaxis/design-systems/${id}/revisions/${revisionId}`
      ),

    listDesignComponentSets: (query) =>
      platformFetch(apiKey, '/api/dynaxis/design-component-sets', { query }),
    createDesignComponentSet: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-component-sets', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getDesignComponentSet: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}`),
    updateDesignComponentSet: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    archiveDesignComponentSet: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}`, {
        method: 'DELETE',
      }),
    listDesignComponentSetVariants: (id) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}/variants`),
    upsertDesignComponentSetVariant: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}/variants`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resolveDesignComponentSetVariant: (id, body) =>
      platformFetch(apiKey, `/api/dynaxis/design-component-sets/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    switchComponentInstanceVariant: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-component-sets/switch-instance', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    instantiateDesignComponentSet: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-component-sets/instantiate', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    designAgentAction: (body) =>
      platformFetch(apiKey, '/api/dynaxis/design-agent', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
}
