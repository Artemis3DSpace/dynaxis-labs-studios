/**
 * Dynaxis Mini App template — example (framework test only).
 * Status: experimental — not shown as a production Apps card by default.
 */

export const exampleMiniAppManifest = {
  id: 'dynaxis.example',
  name: 'Dynaxis Example Module',
  description:
    'Internal framework template demonstrating Mini App contracts. Not a user-facing production app.',
  version: '0.1.0',
  category: 'framework',
  icon: 'beaker',
  status: 'experimental',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-example',
  route: '/studio/apps/dynaxis.example',
  entryKey: 'dynaxis.example',
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
      role: 'style_reference',
      required: false,
      minCount: 0,
      maxCount: 1,
      description: 'Optional style reference image',
    },
  ],
  assetOutputs: ['image'],
  modelCapabilities: ['image'],
  requiresProjectContext: true,
  requiresGenerationAccess: true,
  requiresAssetWrite: true,
  requiresExternalNetwork: false,
  attribution: {
    upstreamName: 'Dynaxis Labs',
    license: 'MIT',
    notes: 'First-party framework example',
  },
  featureFlags: { template: true },
  capabilitySummary: {
    does: 'Demonstrates Mini App runtime project/asset/generation contracts',
    inputs: ['optional style_reference image'],
    outputs: ['image'],
    modality: 'image',
  },
};
