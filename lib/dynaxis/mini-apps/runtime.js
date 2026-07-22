/**
 * Mini App runtime — permission-gated access to Dynaxis platform services.
 * Modules must not import Drizzle / raw SQL / secrets.
 */

import { hasPermission } from './permissions.js';
import { parseGenerationRequest } from './generation-request.js';
import { createPlatformClient } from '../client/platform-api.js';
import { readProjectContext } from '../client/project-context.js';

export class MiniAppPermissionError extends Error {
  /**
   * @param {string} permission
   * @param {string} [action]
   */
  constructor(permission, action = 'access') {
    super(`Mini App denied ${action}: missing permission ${permission}`);
    this.name = 'MiniAppPermissionError';
    this.code = 'MINI_APP_PERMISSION_DENIED';
    this.permission = permission;
  }
}

/**
 * @param {object} opts
 * @param {import('./manifest.js').MiniAppManifest} opts.manifest
 * @param {string} opts.apiKey
 * @param {ReturnType<typeof createPlatformClient>} [opts.platformClient]
 * @param {() => { projectId?: string|null, featureId?: string|null }} [opts.getProjectContext]
 * @param {(req: object, apiKey: string) => Promise<any>} [opts.executeGeneration]
 *   Injected generation executor (defaults to studio muapi path via optional inject).
 */
export function createMiniAppRuntime(opts) {
  const manifest = opts.manifest;
  const apiKey = opts.apiKey;
  const client = opts.platformClient || createPlatformClient(apiKey);
  const getCtx = opts.getProjectContext || readProjectContext;
  const permissions = manifest.permissions || [];

  function requirePerm(permission) {
    if (!hasPermission(permissions, permission)) {
      throw new MiniAppPermissionError(permission);
    }
  }

  const runtime = {
    miniAppId: manifest.id,
    manifest,
    permissions: [...permissions],

    getProjectContext() {
      requirePerm('project:read');
      const ctx = getCtx();
      return {
        projectId: ctx.projectId || null,
        featureId: ctx.featureId || null,
        miniAppId: manifest.id,
      };
    },

    async listProjects() {
      requirePerm('project:read');
      return client.listProjects({ ensureDefault: 'true' });
    },

    async listAssets(query = {}) {
      requirePerm('assets:read');
      const ctx = getCtx();
      return client.listAssets({
        projectId: query.projectId || ctx.projectId || undefined,
        generationId: query.generationId,
        limit: query.limit,
      });
    },

    async getAsset(id) {
      requirePerm('assets:read');
      return client.getAsset(id);
    },

    async getAssetContentBlob(id) {
      requirePerm('assets:read');
      return client.getAssetContent(id);
    },

    async registerAsset(body) {
      requirePerm('assets:write');
      const ctx = getCtx();
      return client.registerAsset({
        ...body,
        projectId: body.projectId || ctx.projectId,
        metadata: {
          ...(body.metadata || {}),
          miniAppId: manifest.id,
          ...(body.role ? { semanticRole: body.role } : {}),
        },
      });
    },

    async listGenerations(query = {}) {
      requirePerm('generation:read');
      const ctx = getCtx();
      return client.listGenerations({
        projectId: query.projectId || ctx.projectId || undefined,
        limit: query.limit,
      });
    },

    async getJob(jobId) {
      requirePerm('jobs:read');
      return client.getJob(jobId);
    },

    async listCharacters(query = {}) {
      requirePerm('characters:read');
      return client.listCharacters(query);
    },

    async getCharacter(characterId, query = {}) {
      requirePerm('characters:read');
      return client.getCharacter(characterId, query);
    },

    async createCharacter(body) {
      requirePerm('characters:write');
      const ctx = getCtx();
      return client.createCharacter({
        ...body,
        projectId: body.projectId || ctx.projectId || undefined,
      });
    },

    async updateCharacter(characterId, body) {
      requirePerm('characters:write');
      return client.updateCharacter(characterId, body);
    },

    async listCharacterAssets(characterId) {
      requirePerm('characters:read');
      requirePerm('assets:read');
      return client.listCharacterAssets(characterId);
    },

    async addCharacterAsset(characterId, body) {
      requirePerm('characters:write');
      requirePerm('assets:write');
      return client.addCharacterAsset(characterId, body);
    },

    async promoteCharacterAsset(characterId, body) {
      requirePerm('characters:write');
      requirePerm('assets:write');
      return client.promoteCharacterAsset(characterId, body);
    },

    async linkCharacterToProject(characterId, projectId) {
      requirePerm('characters:write');
      requirePerm('project:read');
      return client.linkCharacterToProject(characterId, { projectId });
    },

    async listCharacterRevisions(characterId) {
      requirePerm('characters:read');
      return client.listCharacterRevisions(characterId);
    },

    async startCharacterConversation(body) {
      requirePerm('characters:read');
      const ctx = getCtx();
      return client.startCharacterConversation({
        ...body,
        projectId: body.projectId || ctx.projectId || undefined,
      });
    },

    async sendCharacterMessage(conversationId, body) {
      requirePerm('characters:read');
      return client.sendCharacterMessage(conversationId, body);
    },

    async getCharacterConversation(conversationId) {
      requirePerm('characters:read');
      return client.getCharacterConversation(conversationId);
    },

    async listProducts(query = {}) {
      requirePerm('products:read');
      return client.listProducts(query);
    },

    async getProduct(productId, query = {}) {
      requirePerm('products:read');
      return client.getProduct(productId, query);
    },

    async createProduct(body) {
      requirePerm('products:write');
      const ctx = getCtx();
      return client.createProduct({
        ...body,
        projectId: body.projectId || ctx.projectId || undefined,
      });
    },

    async updateProduct(productId, body) {
      requirePerm('products:write');
      return client.updateProduct(productId, body);
    },

    async listProductAssets(productId) {
      requirePerm('products:read');
      requirePerm('assets:read');
      return client.listProductAssets(productId);
    },

    async addProductAsset(productId, body) {
      requirePerm('products:write');
      requirePerm('assets:write');
      return client.addProductAsset(productId, body);
    },

    async promoteProductAsset(productId, body) {
      requirePerm('products:write');
      requirePerm('assets:write');
      return client.promoteProductAsset(productId, body);
    },

    async removeProductAsset(productId, assetId) {
      requirePerm('products:write');
      requirePerm('assets:write');
      return client.removeProductAsset(productId, assetId);
    },

    async linkProductToProject(productId, projectId) {
      requirePerm('products:write');
      requirePerm('project:read');
      return client.linkProductToProject(productId, { projectId });
    },

    async listProductRevisions(productId) {
      requirePerm('products:read');
      return client.listProductRevisions(productId);
    },

    async listProductBrands(productId) {
      requirePerm('products:read');
      requirePerm('brands:read');
      return client.listProductBrands(productId);
    },

    async linkProductToBrand(productId, body) {
      requirePerm('products:write');
      requirePerm('brands:write');
      return client.linkProductToBrand(productId, body);
    },

    async unlinkProductFromBrand(productId, brandId) {
      requirePerm('products:write');
      requirePerm('brands:write');
      return client.unlinkProductFromBrand(productId, brandId);
    },

    async listBrands(query = {}) {
      requirePerm('brands:read');
      return client.listBrands(query);
    },

    async getBrand(brandId, query = {}) {
      requirePerm('brands:read');
      return client.getBrand(brandId, query);
    },

    async createBrand(body) {
      requirePerm('brands:write');
      const ctx = getCtx();
      return client.createBrand({
        ...body,
        projectId: body.projectId || ctx.projectId || undefined,
      });
    },

    async updateBrand(brandId, body) {
      requirePerm('brands:write');
      return client.updateBrand(brandId, body);
    },

    async archiveBrand(brandId) {
      requirePerm('brands:write');
      return client.archiveBrand(brandId);
    },

    async listBrandAssets(brandId) {
      requirePerm('brands:read');
      requirePerm('assets:read');
      return client.listBrandAssets(brandId);
    },

    async addBrandAsset(brandId, body) {
      requirePerm('brands:write');
      requirePerm('assets:write');
      return client.addBrandAsset(brandId, body);
    },

    async promoteBrandAsset(brandId, body) {
      requirePerm('brands:write');
      requirePerm('assets:write');
      return client.promoteBrandAsset(brandId, body);
    },

    async removeBrandAsset(brandId, assetId) {
      requirePerm('brands:write');
      requirePerm('assets:write');
      return client.removeBrandAsset(brandId, assetId);
    },

    async linkBrandToProject(brandId, projectId) {
      requirePerm('brands:write');
      requirePerm('project:read');
      return client.linkBrandToProject(brandId, { projectId });
    },

    async linkBrandToProduct(brandId, body) {
      requirePerm('brands:write');
      requirePerm('products:write');
      return client.linkBrandToProduct(brandId, body);
    },

    async unlinkBrandFromProduct(brandId, productId) {
      requirePerm('brands:write');
      requirePerm('products:write');
      return client.unlinkBrandFromProduct(brandId, productId);
    },

    async listBrandRevisions(brandId) {
      requirePerm('brands:read');
      return client.listBrandRevisions(brandId);
    },

    async analyzeBrandWebsite(body) {
      requirePerm('brands:write');
      requirePerm('models:use');
      return client.analyzeBrandWebsite(body);
    },

    async listCampaigns(query = {}) {
      requirePerm('campaigns:read');
      return client.listCampaigns(query);
    },

    async getCampaign(campaignId, query = {}) {
      requirePerm('campaigns:read');
      return client.getCampaign(campaignId, query);
    },

    async createCampaign(body) {
      requirePerm('campaigns:write');
      const ctx = getCtx();
      return client.createCampaign({
        ...body,
        projectId: body.projectId || ctx.projectId || undefined,
      });
    },

    async updateCampaign(campaignId, body) {
      requirePerm('campaigns:write');
      return client.updateCampaign(campaignId, body);
    },

    async generateCampaignConcepts(campaignId, body = {}) {
      requirePerm('campaigns:write');
      requirePerm('models:use');
      return client.generateCampaignConcepts(campaignId, body);
    },

    async listCampaignConcepts(campaignId) {
      requirePerm('campaigns:read');
      return client.listCampaignConcepts(campaignId);
    },

    async updateCampaignConcept(campaignId, conceptId, body) {
      requirePerm('campaigns:write');
      return client.updateCampaignConcept(campaignId, conceptId, body);
    },

    async selectCampaignConcept(campaignId, conceptId) {
      requirePerm('campaigns:write');
      return client.selectCampaignConcept(campaignId, conceptId);
    },

    async createCampaignDeliverables(campaignId, body) {
      requirePerm('campaigns:write');
      return client.createCampaignDeliverables(campaignId, body);
    },

    async listCampaignDeliverables(campaignId, query = {}) {
      requirePerm('campaigns:read');
      return client.listCampaignDeliverables(campaignId, query);
    },

    async campaignDeliverableAction(campaignId, deliverableId, body) {
      requirePerm('campaigns:write');
      if (body?.action === 'generateCopy' || body?.action === 'prepareImage') {
        requirePerm('models:use');
      }
      if (body?.action === 'prepareImage' || body?.action === 'complete') {
        requirePerm('generation:create');
      }
      return client.campaignDeliverableAction(campaignId, deliverableId, body);
    },

    async attachCampaignAsset(campaignId, body) {
      requirePerm('campaigns:write');
      requirePerm('assets:write');
      return client.attachCampaignAsset(campaignId, body);
    },

    async listCompositions(query) {
      requirePerm('compositions:read');
      return client.listCompositions(query);
    },

    async getComposition(id) {
      requirePerm('compositions:read');
      return client.getComposition(id);
    },

    async createCompositionFromAsset(body) {
      requirePerm('compositions:write');
      requirePerm('assets:read');
      return client.createCompositionFromAsset(body);
    },

    async createCompositionFromDeliverable(body) {
      requirePerm('compositions:read');
      requirePerm('compositions:write');
      requirePerm('campaigns:read');
      return client.createCompositionFromDeliverable(body);
    },

    async updateCompositionDraft(id, body) {
      requirePerm('compositions:write');
      return client.updateCompositionDraft(id, body);
    },

    async saveCompositionRevision(id, body) {
      requirePerm('compositions:write');
      return client.saveCompositionRevision(id, body);
    },

    async exportComposition(id) {
      requirePerm('compositions:write');
      requirePerm('assets:write');
      return client.exportComposition(id);
    },

    async compositionAction(id, body) {
      requirePerm('compositions:write');
      if (body?.action === 'setFinalAsset') requirePerm('campaigns:write');
      if (body?.action === 'prepareCleanBackground') {
        requirePerm('generation:create');
        requirePerm('jobs:create');
      }
      return client.compositionAction(id, body);
    },

    async adaptComposition(body) {
      requirePerm('compositions:write');
      requirePerm('compositions:read');
      return client.adaptComposition(body);
    },

    async listDesignTemplates(query = {}) {
      requirePerm('templates:read');
      return client.listDesignTemplates(query);
    },

    async getDesignTemplate(id) {
      requirePerm('templates:read');
      return client.getDesignTemplate(id);
    },

    async createDesignTemplate(body) {
      requirePerm('templates:write');
      return client.createDesignTemplate(body);
    },

    async createTemplateFromComposition(body) {
      requirePerm('templates:write');
      requirePerm('compositions:read');
      return client.createTemplateFromComposition(body);
    },

    async updateDesignTemplate(id, body) {
      requirePerm('templates:write');
      return client.updateDesignTemplate(id, body);
    },

    async archiveDesignTemplate(id) {
      requirePerm('templates:write');
      return client.archiveDesignTemplate(id);
    },

    async listDesignTemplateRevisions(id) {
      requirePerm('templates:read');
      return client.listDesignTemplateRevisions(id);
    },

    async createDesignTemplateRevision(id, body) {
      requirePerm('templates:write');
      return client.createDesignTemplateRevision(id, body);
    },

    async getDesignTemplateRevision(id, revisionId) {
      requirePerm('templates:read');
      return client.getDesignTemplateRevision(id, revisionId);
    },

    async instantiateDesignTemplate(body) {
      requirePerm('templates:read');
      requirePerm('compositions:write');
      requirePerm('project:read');
      return client.instantiateDesignTemplate(body);
    },

    async setDesignTemplateThumbnail(id, body) {
      requirePerm('templates:write');
      requirePerm('assets:write');
      return client.setDesignTemplateThumbnail(id, body);
    },

    async listDesignComponents(query = {}) {
      requirePerm('components:read');
      return client.listDesignComponents(query);
    },

    async getDesignComponent(id) {
      requirePerm('components:read');
      return client.getDesignComponent(id);
    },

    async createDesignComponent(body) {
      requirePerm('components:write');
      return client.createDesignComponent(body);
    },

    async createComponentFromLayers(body) {
      requirePerm('components:write');
      requirePerm('compositions:read');
      if (body?.replaceSelectedLayers) requirePerm('compositions:write');
      return client.createComponentFromLayers(body);
    },

    async updateDesignComponent(id, body) {
      requirePerm('components:write');
      return client.updateDesignComponent(id, body);
    },

    async archiveDesignComponent(id) {
      requirePerm('components:write');
      return client.archiveDesignComponent(id);
    },

    async listDesignComponentRevisions(id) {
      requirePerm('components:read');
      return client.listDesignComponentRevisions(id);
    },

    async createDesignComponentRevision(id, body) {
      requirePerm('components:write');
      return client.createDesignComponentRevision(id, body);
    },

    async getDesignComponentRevision(id, revisionId) {
      requirePerm('components:read');
      return client.getDesignComponentRevision(id, revisionId);
    },

    async instantiateDesignComponent(body) {
      requirePerm('components:read');
      requirePerm('compositions:write');
      return client.instantiateDesignComponent(body);
    },

    async detachComponentInstance(body) {
      requirePerm('components:read');
      requirePerm('compositions:write');
      return client.detachComponentInstance(body);
    },

    async updateComponentInstanceRevision(body) {
      requirePerm('components:read');
      requirePerm('compositions:write');
      return client.updateComponentInstanceRevision(body);
    },

    async generateDesignComponentThumbnail(id, body = {}) {
      requirePerm('components:write');
      requirePerm('assets:write');
      return client.generateDesignComponentThumbnail(id, body);
    },

    async listDesignComponentUsage(id) {
      requirePerm('components:read');
      return client.listDesignComponentUsage(id);
    },

    async listDesignSystems(query = {}) {
      requirePerm('designSystems:read');
      return client.listDesignSystems(query);
    },

    async getDesignSystem(id) {
      requirePerm('designSystems:read');
      return client.getDesignSystem(id);
    },

    async createDesignSystem(body) {
      requirePerm('designSystems:write');
      return client.createDesignSystem(body);
    },

    async createDesignSystemFromBrand(body) {
      requirePerm('designSystems:write');
      requirePerm('brands:read');
      return client.createDesignSystemFromBrand(body);
    },

    async updateDesignSystem(id, body) {
      requirePerm('designSystems:write');
      return client.updateDesignSystem(id, body);
    },

    async archiveDesignSystem(id) {
      requirePerm('designSystems:write');
      return client.archiveDesignSystem(id);
    },

    async listDesignSystemRevisions(id) {
      requirePerm('designSystems:read');
      return client.listDesignSystemRevisions(id);
    },

    async createDesignSystemRevision(id, body) {
      requirePerm('designSystems:write');
      return client.createDesignSystemRevision(id, body);
    },

    async getDesignSystemRevision(id, revisionId) {
      requirePerm('designSystems:read');
      return client.getDesignSystemRevision(id, revisionId);
    },

    async listDesignComponentSets(query = {}) {
      requirePerm('componentSets:read');
      return client.listDesignComponentSets(query);
    },

    async getDesignComponentSet(id) {
      requirePerm('componentSets:read');
      return client.getDesignComponentSet(id);
    },

    async createDesignComponentSet(body) {
      requirePerm('componentSets:write');
      return client.createDesignComponentSet(body);
    },

    async updateDesignComponentSet(id, body) {
      requirePerm('componentSets:write');
      return client.updateDesignComponentSet(id, body);
    },

    async archiveDesignComponentSet(id) {
      requirePerm('componentSets:write');
      return client.archiveDesignComponentSet(id);
    },

    async listDesignComponentSetVariants(id) {
      requirePerm('componentSets:read');
      return client.listDesignComponentSetVariants(id);
    },

    async upsertDesignComponentSetVariant(id, body) {
      requirePerm('componentSets:write');
      return client.upsertDesignComponentSetVariant(id, body);
    },

    async resolveDesignComponentSetVariant(id, body) {
      requirePerm('componentSets:read');
      return client.resolveDesignComponentSetVariant(id, body);
    },

    async switchComponentInstanceVariant(body) {
      requirePerm('componentSets:read');
      requirePerm('compositions:write');
      return client.switchComponentInstanceVariant(body);
    },

    async instantiateDesignComponentSet(body) {
      requirePerm('componentSets:read');
      requirePerm('compositions:write');
      return client.instantiateDesignComponentSet(body);
    },

    /**
     * Request generation through Dynaxis lifecycle + approved executor.
     * Does not open raw DB access.
     */
    async createGeneration(input) {
      requirePerm('generation:create');
      requirePerm('jobs:create');
      requirePerm('models:use');
      const request = parseGenerationRequest(input);
      const ctx = getCtx();
      const projectId = request.projectId || ctx.projectId || null;

      const start = await client.lifecycleStart({
        projectId,
        featureId: manifest.id,
        model: request.modelId,
        prompt: request.prompt,
        endpoint: request.endpoint || request.modelId,
        characterId: request.characterId || null,
        characterRevisionId: request.characterRevisionId || null,
        productId: request.productId || null,
        productRevisionId: request.productRevisionId || null,
        brandId: request.brandId || null,
        brandRevisionId: request.brandRevisionId || null,
        campaignId: request.campaignId || null,
        campaignRevisionId: request.campaignRevisionId || null,
        parameters: {
          ...request.parameters,
          referenceAssets: request.referenceAssets,
          miniAppId: manifest.id,
        },
        assetHint: request.outputType,
        metadata: {
          miniAppId: manifest.id,
          miniAppVersion: manifest.version,
          provenance: 'mini-app',
          ...(request.characterId ? { characterId: request.characterId } : {}),
          ...(request.characterRevisionId
            ? { characterRevisionId: request.characterRevisionId }
            : {}),
          ...(request.productId ? { productId: request.productId } : {}),
          ...(request.productRevisionId
            ? { productRevisionId: request.productRevisionId }
            : {}),
          ...(request.brandId ? { brandId: request.brandId } : {}),
          ...(request.brandRevisionId
            ? { brandRevisionId: request.brandRevisionId }
            : {}),
          ...(request.campaignId ? { campaignId: request.campaignId } : {}),
          ...(request.campaignRevisionId
            ? { campaignRevisionId: request.campaignRevisionId }
            : {}),
        },
      });

      if (typeof opts.executeGeneration !== 'function') {
        // Lifecycle record created; executor optional for dry-run / tests
        return {
          generation: start.generation,
          job: start.job,
          project: start.project,
          executed: false,
          message:
            'Lifecycle started. Provide executeGeneration to run MuAPI through Dynaxis adapter.',
        };
      }

      try {
        if (typeof window !== 'undefined') {
          window.__dynaxisFeatureId = manifest.id;
          window.__dynaxisAssetHint = request.outputType;
          if (projectId) window.__dynaxisProjectId = projectId;
        }
        const result = await opts.executeGeneration(request, apiKey);
        const urls = collectUrls(result);
        const completed = await client.lifecycleComplete({
          generationId: start.generation.id,
          jobId: start.job.id,
          providerJobId: result?.request_id || result?.id || result?.dynaxisJobId || null,
          result: sanitizeResult(result),
          urls,
        });
        return {
          generation: completed.generation,
          job: completed.job,
          assets: completed.assets,
          project: start.project,
          executed: true,
          providerResult: result,
        };
      } catch (err) {
        await client.lifecycleFail({
          generationId: start.generation.id,
          jobId: start.job.id,
          errorCode: 'MINI_APP_GENERATION_FAILED',
          errorMessage: String(err?.message || err).slice(0, 400),
        });
        throw err;
      }
    },

    /** Headless-friendly capability invoke (Skills/Agents later) */
    async invokeCapability(name, args = {}) {
      if (typeof opts.invokeCapability === 'function') {
        return opts.invokeCapability(name, args, runtime);
      }
      const err = new Error(`Capability not available: ${name}`);
      err.code = 'MINI_APP_CAPABILITY_MISSING';
      throw err;
    },
  };

  return Object.freeze(runtime);
}

function collectUrls(result) {
  if (!result) return [];
  if (Array.isArray(result.outputs)) {
    return result.outputs
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.url === 'string') {
          return item.url;
        }
        return null;
      })
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  }
  if (Array.isArray(result.urls)) {
    return result.urls.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  }
  const u = result.url || result.output?.url;
  return u && /^https?:\/\//i.test(u) ? [u] : [];
}

function sanitizeResult(result) {
  if (!result || typeof result !== 'object') return {};
  const clone = { ...result };
  delete clone.apiKey;
  delete clone.api_key;
  return clone;
}
