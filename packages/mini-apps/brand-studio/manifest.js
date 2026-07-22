/**
 * Dynaxis Mini App — Brand Studio (production).
 * Persistent Brand DNA domain; website analysis via secured server endpoint.
 */

export const brandStudioMiniAppManifest = {
  id: 'dynaxis.brand-studio',
  name: 'Brand Studio',
  description:
    'Create and maintain persistent Brand DNA — identity, messaging, colours, typography, and logos. Analyze public websites securely or enter Brand DNA manually. Brands live in your Dynaxis library and can link to Products and Projects.',
  version: '1.0.0',
  category: 'marketing',
  icon: 'sparkles',
  status: 'integrated',
  moduleType: 'capability',
  viewId: 'mini-dynaxis-brand-studio',
  route: '/studio/apps/dynaxis.brand-studio',
  entryKey: 'dynaxis.brand-studio',
  permissions: [
    'project:read',
    'assets:read',
    'assets:write',
    'models:use',
    'brands:read',
    'brands:write',
  ],
  requiredCapabilities: ['projects', 'assets', 'database', 'brands', 'muapi'],
  assetInputs: [
    {
      type: 'image',
      role: 'primary_logo',
      required: false,
      minCount: 0,
      maxCount: 8,
      description: 'Brand logos and visual references',
    },
  ],
  assetOutputs: ['image'],
  modelCapabilities: ['llm', 'vision'],
  requiresProjectContext: true,
  requiresGenerationAccess: false,
  requiresAssetWrite: true,
  requiresExternalNetwork: false,
  attribution: {
    upstreamName: 'Open Pomelli',
    upstreamRepo: 'https://github.com/SamurAIGPT/Open-Pomelli',
    license: 'MIT',
    notes:
      'Brand DNA field concepts and scrape→text+vision+CSS merge strategy adapted from Open Pomelli. Auth-less SQLite/Prisma, Campaigns, canvas editor, Photoshoot/Animation models, and vendored MuAPI client discarded. SSRF-hardened analysis and Dynaxis Asset/Brand persistence are platform-native.',
  },
  replacesCatalogueRepos: [],
  featureFlags: {
    websiteAnalysis: true,
    manualBrandDna: true,
    brandRevisions: true,
    productLinking: true,
  },
  capabilitySummary: {
    does: 'Create and edit persistent Brands with optional secure website Brand DNA extraction',
    inputs: ['brand profile', 'website URL (optional)', 'logo/reference assets'],
    outputs: ['brand entity', 'brand revision', 'brand assets'],
    modality: 'other',
  },
};
