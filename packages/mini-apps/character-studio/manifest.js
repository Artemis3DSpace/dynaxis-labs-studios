/**
 * Dynaxis Mini App — AI Character Studio (production).
 * Adapted from SamurAIGPT/ai-character-studio (MIT).
 * Character domain is Dynaxis-native; source was largely an image SaaS template.
 */

export const characterStudioMiniAppManifest = {
  id: 'dynaxis.character-studio',
  name: 'AI Character Studio',
  description:
    'Create persistent reusable Characters with persona, references, portrait generation, and chat. Characters live in your Dynaxis library and can link to multiple Projects.',
  version: '1.0.0',
  category: 'creative',
  icon: 'users',
  status: 'integrated',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-character-studio',
  route: '/studio/apps/dynaxis.character-studio',
  entryKey: 'dynaxis.character-studio',
  permissions: [
    'project:read',
    'assets:read',
    'assets:write',
    'generation:create',
    'generation:read',
    'jobs:create',
    'jobs:read',
    'models:use',
    'characters:read',
    'characters:write',
  ],
  requiredCapabilities: [
    'projects',
    'assets',
    'generations',
    'jobs',
    'muapi',
    'database',
    'characters',
  ],
  assetInputs: [
    {
      type: 'image',
      role: 'identity_reference',
      required: false,
      minCount: 0,
      maxCount: 5,
      description: 'Optional identity / style reference images (up to 5)',
    },
  ],
  assetOutputs: ['image'],
  modelCapabilities: ['image', 'nano-banana-pro', 'nano-banana-pro-edit', 'llm'],
  requiresProjectContext: true,
  requiresGenerationAccess: true,
  requiresAssetWrite: true,
  requiresExternalNetwork: false,
  attribution: {
    upstreamName: 'AI Character Studio',
    upstreamRepo: 'https://github.com/SamurAIGPT/ai-character-studio',
    license: 'MIT',
    notes:
      'Visual generation (nano-banana-pro / edit, aspect ratios, resolutions) and LLM chat endpoint adapted from SamurAIGPT. Auth, Stripe, credits, and standalone shell discarded. Persistent Character domain is Dynaxis-native.',
  },
  featureFlags: {
    multiReference: true,
    characterChat: true,
    referenceBasedContinuity: true,
  },
  capabilitySummary: {
    does: 'Create and maintain persistent Characters with reference-based continuity, portrait generation/edit, and persona chat',
    inputs: [
      'character profile',
      'optional identity_reference images',
      'aspect ratio',
      'resolution',
    ],
    outputs: ['character entity', 'generated_portrait assets', 'conversation messages'],
    modality: 'multimodal',
  },
};
