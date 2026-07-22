/**
 * Dynaxis Mini App — Product Studio (production).
 * Adapted from SamurAIGPT/amazon-product-studio (MIT).
 * Persistent Product domain is Dynaxis-native; standalone SaaS shell discarded.
 */

export const productStudioMiniAppManifest = {
  id: 'dynaxis.product-studio',
  name: 'Product Studio',
  description:
    'Create persistent reusable Products with multi-image references and professional product photography scenes. Products live in your Dynaxis library and can link to multiple Projects.',
  version: '1.0.0',
  category: 'creative',
  icon: 'image',
  status: 'integrated',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-product-studio',
  route: '/studio/apps/dynaxis.product-studio',
  entryKey: 'dynaxis.product-studio',
  permissions: [
    'project:read',
    'assets:read',
    'assets:write',
    'generation:create',
    'generation:read',
    'jobs:create',
    'jobs:read',
    'models:use',
    'products:read',
    'products:write',
    'brands:read',
    'brands:write',
  ],
  requiredCapabilities: [
    'projects',
    'assets',
    'generations',
    'jobs',
    'muapi',
    'database',
    'products',
    'brands',
  ],
  assetInputs: [
    {
      type: 'image',
      role: 'product_reference',
      required: true,
      minCount: 1,
      maxCount: 14,
      description: 'Product reference images (up to model max, currently 14 for nano-banana-2-edit)',
    },
  ],
  assetOutputs: ['image'],
  modelCapabilities: ['image', 'nano-banana-2-edit'],
  requiresProjectContext: true,
  requiresGenerationAccess: true,
  requiresAssetWrite: true,
  requiresExternalNetwork: false,
  attribution: {
    upstreamName: 'Amazon Product Studio',
    upstreamRepo: 'https://github.com/SamurAIGPT/amazon-product-studio',
    license: 'MIT',
    notes:
      'Product photography workflow (nano-banana-2-edit, scene presets, aspect ratios, multi-reference) adapted from SamurAIGPT. Auth, Stripe, credits, Prisma creation history, and standalone shell discarded. Persistent Product domain is Dynaxis-native and platform-neutral.',
  },
  replacesCatalogueRepos: [
    'https://github.com/SamurAIGPT/amazon-product-studio',
  ],
  featureFlags: {
    multiReference: true,
    scenePresets: true,
    referenceBasedContinuity: true,
    explicitPromote: true,
  },
  capabilitySummary: {
    does: 'Create and maintain persistent Products with multi-reference product photography and scene presets',
    inputs: [
      'product profile',
      'product_reference images',
      'scene preset or custom prompt',
      'aspect ratio',
    ],
    outputs: ['product entity', 'generated_product_scene assets'],
    modality: 'image',
  },
};
