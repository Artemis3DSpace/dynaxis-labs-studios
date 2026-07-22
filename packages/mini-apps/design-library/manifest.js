/**
 * Dynaxis Mini App — Design Library (Design Templates catalogue + instantiate).
 * Not a marketplace. Not a second canvas editor.
 */

export const designLibraryMiniAppManifest = {
  id: 'dynaxis.design-library',
  name: 'Design Library',
  description:
    'Owner-scoped Design Templates and Design Components: reusable Composition blueprints and visual fragments. Opens Creative Editor for authoring.',
  version: '1.2.0',
  category: 'marketing',
  icon: 'layout',
  status: 'integrated',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-design-library',
  route: '/studio/apps/dynaxis.design-library',
  entryKey: 'dynaxis.design-library',
  permissions: [
    'project:read',
    'assets:read',
    'assets:write',
    'brands:read',
    'products:read',
    'characters:read',
    'campaigns:read',
    'compositions:read',
    'compositions:write',
    'templates:read',
    'templates:write',
    'components:read',
    'components:write',
    'designSystems:read',
    'designSystems:write',
    'componentSets:read',
    'componentSets:write',
  ],
  requiredCapabilities: [
    'projects',
    'assets',
    'database',
    'brands',
    'products',
    'characters',
    'campaigns',
    'compositions',
    'templates',
    'components',
    'designSystems',
    'componentSets',
  ],
  assetInputs: [],
  assetOutputs: ['image'],
  modelCapabilities: [],
  requiresProjectContext: true,
  requiresGenerationAccess: false,
  requiresAssetWrite: true,
  featureFlags: {
    noMarketplace: true,
    noPublishing: true,
    noSocialSharing: true,
  },
  attribution: {
    notes:
      'Native Dynaxis Design Template domain. Design Agent / CreativeCanvas remains separate.',
  },
};
