/**
 * Dynaxis Labs Studios — feature registry.
 * Describes existing capabilities. Does not own studio business logic.
 */

/** @typedef {'create' | 'build' | 'apps' | 'connect' | 'account'} FeatureCategory */
/** @typedef {'studio' | 'catalogue' | 'integration' | 'platform'} CapabilityType */
/** @typedef {'available' | 'web-only' | 'desktop-only' | 'catalogue'} FeatureAvailability */

/**
 * @typedef {Object} DynaxisFeature
 * @property {string} id
 * @property {string} name
 * @property {FeatureCategory} category
 * @property {string} viewId - Studio shell tab / view identifier
 * @property {string} [route] - Primary web route
 * @property {FeatureAvailability} availability
 * @property {CapabilityType} capabilityType
 * @property {string} description
 * @property {string} [navLabel] - Compact nav label
 * @property {boolean} [shellMounted] - Mounted in Next.js StandaloneShell
 */

/** @type {DynaxisFeature[]} */
export const DYNAXIS_FEATURES = [
  {
    id: 'image-studio',
    name: 'Image Studio',
    navLabel: 'Image',
    category: 'create',
    viewId: 'image',
    route: '/studio/image',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Text-to-image and image-to-image generation across MuAPI models.',
    shellMounted: true,
  },
  {
    id: 'video-studio',
    name: 'Video Studio',
    navLabel: 'Video',
    category: 'create',
    viewId: 'video',
    route: '/studio/video',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Text-to-video, image-to-video, and video-to-video workflows.',
    shellMounted: true,
  },
  {
    id: 'cinema-studio',
    name: 'Cinema Studio',
    navLabel: 'Cinema',
    category: 'create',
    viewId: 'cinema',
    route: '/studio/cinema',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Cinematic framing and shot-oriented generation controls.',
    shellMounted: true,
  },
  {
    id: 'audio-studio',
    name: 'Audio Studio',
    navLabel: 'Audio',
    category: 'create',
    viewId: 'audio',
    route: '/studio/audio',
    availability: 'available',
    capabilityType: 'studio',
    description: 'AI audio generation and related creative controls.',
    shellMounted: true,
  },
  {
    id: 'lipsync-studio',
    name: 'Lip Sync',
    navLabel: 'Lip Sync',
    category: 'create',
    viewId: 'lipsync',
    route: '/studio/lipsync',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Audio-driven lip sync video generation.',
    shellMounted: true,
  },
  {
    id: 'vibe-motion',
    name: 'Vibe Motion',
    navLabel: 'Vibe Motion',
    category: 'create',
    viewId: 'vibe-motion',
    route: '/studio/vibe-motion',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Motion graphics generation and edit flows.',
    shellMounted: true,
  },
  {
    id: 'clipping-studio',
    name: 'AI Clipping',
    navLabel: 'Clipping',
    category: 'create',
    viewId: 'clipping',
    route: '/studio/clipping',
    availability: 'available',
    capabilityType: 'studio',
    description: 'AI-assisted highlight clipping from source video.',
    shellMounted: true,
  },
  {
    id: 'body-swap',
    name: 'Body Swap',
    navLabel: 'Body Swap',
    category: 'create',
    viewId: 'body-swap',
    route: '/studio/body-swap',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Recast / body-swap video transformation.',
    shellMounted: true,
  },
  {
    id: 'ai-influencer',
    name: 'AI Influencer',
    navLabel: 'Influencer',
    category: 'create',
    viewId: 'ai-influencer',
    route: '/studio/ai-influencer',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Character/influencer prompt builder and image generation.',
    shellMounted: true,
  },
  {
    id: 'marketing-studio',
    name: 'Marketing Studio',
    navLabel: 'Marketing',
    category: 'create',
    viewId: 'marketing',
    route: '/studio/marketing',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Marketing creative generation workflows.',
    shellMounted: true,
  },
  {
    id: 'workflow-studio',
    name: 'Workflows',
    navLabel: 'Workflows',
    category: 'build',
    viewId: 'workflows',
    route: '/studio/workflows',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Node-based generative pipelines (Vibe Workflow).',
    shellMounted: true,
  },
  {
    id: 'agent-studio',
    name: 'Agents',
    navLabel: 'Agents',
    category: 'build',
    viewId: 'agents',
    route: '/studio/agents',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Agent catalogue and chat (Open-Poe agents package).',
    shellMounted: true,
  },
  {
    id: 'design-agent',
    name: 'Design Agent',
    navLabel: 'Design Agent',
    category: 'build',
    viewId: 'design-agent',
    route: '/studio/design-agent',
    availability: 'available',
    capabilityType: 'studio',
    description: 'Autonomous creative design canvas.',
    shellMounted: true,
  },
  {
    id: 'apps',
    name: 'Apps Catalogue',
    navLabel: 'Apps',
    category: 'apps',
    viewId: 'apps',
    route: '/studio/apps',
    availability: 'catalogue',
    capabilityType: 'catalogue',
    description:
      'External templates and interest catalogue, plus Dynaxis Mini App modules when integrated. Catalogue entries are not installed modules.',
    shellMounted: true,
  },
  {
    id: 'mcp-cli',
    name: 'MCP & CLI',
    navLabel: 'MCP / CLI',
    category: 'connect',
    viewId: 'mcp-cli',
    route: '/studio/mcp-cli',
    availability: 'available',
    capabilityType: 'integration',
    description: 'Documentation and links for MuAPI CLI, MCP server, and generative media skills.',
    shellMounted: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    navLabel: 'Settings',
    category: 'account',
    viewId: 'settings',
    route: null,
    availability: 'available',
    capabilityType: 'platform',
    description: 'API key and studio preferences.',
    shellMounted: false,
  },
];

export function getFeatureById(id) {
  return DYNAXIS_FEATURES.find((f) => f.id === id) || null;
}

export function getFeatureByViewId(viewId) {
  return DYNAXIS_FEATURES.find((f) => f.viewId === viewId) || null;
}

export function getFeaturesByCategory(category) {
  return DYNAXIS_FEATURES.filter((f) => f.category === category);
}

export function getShellFeatures() {
  return DYNAXIS_FEATURES.filter((f) => f.shellMounted);
}
