/**
 * Central TanStack Query key factory for Dynaxis Studio.
 * Keys are deterministic, workspace-aware, and project-aware where required.
 */

import {
  assertNoOwnerRefScope,
  normalizeProjectScope,
  normalizeWorkspaceScope,
  requireOrganizationId,
  requireProjectId,
  stableFilterScope,
} from './scope.js';

export const DYNAXIS_QUERY_ROOT = ['dynaxis'];


function workspaceRoot(organizationId) {
  return [...DYNAXIS_QUERY_ROOT, 'workspace', requireOrganizationId(organizationId)];
}

function projectRoot(organizationId, projectId) {
  return [...workspaceRoot(organizationId), 'project', requireProjectId(projectId)];
}

function resourceList(root, filters) {
  return [...root, 'list', stableFilterScope(filters)];
}

function resourceDetail(root, id, suffix = 'detail') {
  return [...root, suffix, String(id)];
}

export const dynaxisQueryKeys = {
  all: DYNAXIS_QUERY_ROOT,

  session(organizationId) {
    return [...DYNAXIS_QUERY_ROOT, 'session', requireOrganizationId(organizationId)];
  },

  workspace(organizationId) {
    return workspaceRoot(organizationId);
  },

  projects: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'projects'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.projects.all(organizationId), filters);
    },
    detail(organizationId, projectId) {
      return resourceDetail(dynaxisQueryKeys.projects.all(organizationId), projectId);
    },
  },

  assets: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'assets'];
    },
    list(organizationId, projectId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.assets.all(organizationId, projectId), filters);
    },
    detail(organizationId, projectId, assetId) {
      return resourceDetail(
        dynaxisQueryKeys.assets.all(organizationId, projectId),
        assetId
      );
    },
    content(organizationId, projectId, assetId) {
      return [
        ...dynaxisQueryKeys.assets.detail(organizationId, projectId, assetId),
        'content',
      ];
    },
  },

  generations: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'generations'];
    },
    list(organizationId, projectId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.generations.all(organizationId, projectId), filters);
    },
    detail(organizationId, projectId, generationId) {
      return resourceDetail(
        dynaxisQueryKeys.generations.all(organizationId, projectId),
        generationId
      );
    },
  },

  jobs: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'jobs'];
    },
    detail(organizationId, projectId, jobId) {
      return resourceDetail(dynaxisQueryKeys.jobs.all(organizationId, projectId), jobId);
    },
  },

  characters: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'characters'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.characters.all(organizationId), filters);
    },
    detail(organizationId, characterId) {
      return resourceDetail(dynaxisQueryKeys.characters.all(organizationId), characterId);
    },
    revisions(organizationId, characterId) {
      return [...dynaxisQueryKeys.characters.detail(organizationId, characterId), 'revisions'];
    },
    projects(organizationId, characterId) {
      return [...dynaxisQueryKeys.characters.detail(organizationId, characterId), 'projects'];
    },
    assets(organizationId, characterId) {
      return [...dynaxisQueryKeys.characters.detail(organizationId, characterId), 'assets'];
    },
  },

  products: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'products'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.products.all(organizationId), filters);
    },
    detail(organizationId, productId) {
      return resourceDetail(dynaxisQueryKeys.products.all(organizationId), productId);
    },
    revisions(organizationId, productId) {
      return [...dynaxisQueryKeys.products.detail(organizationId, productId), 'revisions'];
    },
    projects(organizationId, productId) {
      return [...dynaxisQueryKeys.products.detail(organizationId, productId), 'projects'];
    },
    assets(organizationId, productId) {
      return [...dynaxisQueryKeys.products.detail(organizationId, productId), 'assets'];
    },
    brands(organizationId, productId) {
      return [...dynaxisQueryKeys.products.detail(organizationId, productId), 'brands'];
    },
  },

  brands: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'brands'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.brands.all(organizationId), filters);
    },
    detail(organizationId, brandId) {
      return resourceDetail(dynaxisQueryKeys.brands.all(organizationId), brandId);
    },
    revisions(organizationId, brandId) {
      return [...dynaxisQueryKeys.brands.detail(organizationId, brandId), 'revisions'];
    },
    projects(organizationId, brandId) {
      return [...dynaxisQueryKeys.brands.detail(organizationId, brandId), 'projects'];
    },
    assets(organizationId, brandId) {
      return [...dynaxisQueryKeys.brands.detail(organizationId, brandId), 'assets'];
    },
    products(organizationId, brandId) {
      return [...dynaxisQueryKeys.brands.detail(organizationId, brandId), 'products'];
    },
  },

  campaigns: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'campaigns'];
    },
    list(organizationId, projectId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.campaigns.all(organizationId, projectId), filters);
    },
    detail(organizationId, projectId, campaignId) {
      return resourceDetail(
        dynaxisQueryKeys.campaigns.all(organizationId, projectId),
        campaignId
      );
    },
    revisions(organizationId, projectId, campaignId) {
      return [
        ...dynaxisQueryKeys.campaigns.detail(organizationId, projectId, campaignId),
        'revisions',
      ];
    },
    concepts(organizationId, projectId, campaignId) {
      return [
        ...dynaxisQueryKeys.campaigns.detail(organizationId, projectId, campaignId),
        'concepts',
      ];
    },
    deliverables(organizationId, projectId, campaignId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return [
        ...dynaxisQueryKeys.campaigns.detail(organizationId, projectId, campaignId),
        'deliverables',
        stableFilterScope(filters),
      ];
    },
  },

  compositions: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'compositions'];
    },
    list(organizationId, projectId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.compositions.all(organizationId, projectId), filters);
    },
    detail(organizationId, projectId, compositionId) {
      return resourceDetail(
        dynaxisQueryKeys.compositions.all(organizationId, projectId),
        compositionId
      );
    },
    revisions(organizationId, projectId, compositionId) {
      return [
        ...dynaxisQueryKeys.compositions.detail(organizationId, projectId, compositionId),
        'revisions',
      ];
    },
  },

  designAgent: {
    context(organizationId, projectId, compositionId) {
      return [
        ...projectRoot(organizationId, projectId),
        'design-agent',
        'context',
        String(compositionId),
      ];
    },
  },

  designTemplates: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'design-templates'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.designTemplates.all(organizationId), filters);
    },
    detail(organizationId, templateId) {
      return resourceDetail(dynaxisQueryKeys.designTemplates.all(organizationId), templateId);
    },
    revisions(organizationId, templateId) {
      return [
        ...dynaxisQueryKeys.designTemplates.detail(organizationId, templateId),
        'revisions',
      ];
    },
  },

  designComponents: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'design-components'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.designComponents.all(organizationId), filters);
    },
    detail(organizationId, componentId) {
      return resourceDetail(dynaxisQueryKeys.designComponents.all(organizationId), componentId);
    },
    revisions(organizationId, componentId) {
      return [
        ...dynaxisQueryKeys.designComponents.detail(organizationId, componentId),
        'revisions',
      ];
    },
    usage(organizationId, componentId) {
      return [
        ...dynaxisQueryKeys.designComponents.detail(organizationId, componentId),
        'usage',
      ];
    },
  },

  designComponentSets: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'design-component-sets'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.designComponentSets.all(organizationId), filters);
    },
    detail(organizationId, setId) {
      return resourceDetail(dynaxisQueryKeys.designComponentSets.all(organizationId), setId);
    },
    variants(organizationId, setId) {
      return [
        ...dynaxisQueryKeys.designComponentSets.detail(organizationId, setId),
        'variants',
      ];
    },
  },

  designSystems: {
    all(organizationId) {
      return [...workspaceRoot(organizationId), 'design-systems'];
    },
    list(organizationId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return resourceList(dynaxisQueryKeys.designSystems.all(organizationId), filters);
    },
    detail(organizationId, designSystemId) {
      return resourceDetail(
        dynaxisQueryKeys.designSystems.all(organizationId),
        designSystemId
      );
    },
    revisions(organizationId, designSystemId) {
      return [
        ...dynaxisQueryKeys.designSystems.detail(organizationId, designSystemId),
        'revisions',
      ];
    },
  },

  miniApps: {
    all(organizationId, projectId) {
      return [...projectRoot(organizationId, projectId), 'mini-apps'];
    },
    execution(organizationId, projectId, miniAppId, filters = {}) {
      assertNoOwnerRefScope(filters);
      return [
        ...dynaxisQueryKeys.miniApps.all(organizationId, projectId),
        'execution',
        String(miniAppId),
        stableFilterScope(filters),
      ];
    },
  },
};

export { normalizeProjectScope, normalizeWorkspaceScope, stableFilterScope };
