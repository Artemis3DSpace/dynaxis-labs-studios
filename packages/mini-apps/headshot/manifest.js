/**
 * Dynaxis Mini App — AI Headshot (production).
 * Adapted from SamurAIGPT/ai-headshot-generator (MIT).
 */

export const headshotMiniAppManifest = {
  id: 'dynaxis.headshot',
  name: 'AI Headshot',
  description:
    'Professional portrait packs from a reference photo. Choose a style category and aspect ratio; Dynaxis manages projects, assets, and generation history.',
  version: '1.0.0',
  category: 'creative',
  icon: 'user-tie',
  status: 'integrated',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-headshot',
  route: '/studio/apps/dynaxis.headshot',
  entryKey: 'dynaxis.headshot',
  permissions: [
    'project:read',
    'assets:read',
    'assets:write',
    'generation:create',
    'generation:read',
    'jobs:create',
    'jobs:read',
    'models:use',
  ],
  requiredCapabilities: ['projects', 'assets', 'generations', 'jobs', 'muapi', 'database'],
  assetInputs: [
    {
      type: 'image',
      role: 'portrait_reference',
      required: true,
      minCount: 1,
      maxCount: 1,
      description: 'Single portrait / face reference photo',
    },
  ],
  assetOutputs: ['image'],
  modelCapabilities: ['image', 'photo-pack', 'headshot'],
  requiresProjectContext: true,
  requiresGenerationAccess: true,
  requiresAssetWrite: true,
  requiresExternalNetwork: false,
  attribution: {
    upstreamName: 'AI Headshot Generator',
    upstreamRepo: 'https://github.com/SamurAIGPT/ai-headshot-generator',
    license: 'MIT',
    notes:
      'Domain workflow (categories, aspect ratios, photo-pack params) adapted from SamurAIGPT. Auth, Stripe, Prisma, and standalone shell discarded.',
  },
  featureFlags: { multiOutputPack: true },
  capabilitySummary: {
    does: 'Generate a professional headshot photo pack from one portrait reference using MuAPI photo-pack styles',
    inputs: ['portrait_reference image', 'style category', 'aspect ratio'],
    outputs: ['image pack (multiple variants)'],
    modality: 'image',
  },
};
