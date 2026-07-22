/**
 * Dynaxis Labs Studios — central product configuration.
 * Client-safe only. No secrets.
 */

export const DYNAXIS_PRODUCT = {
  name: 'Dynaxis Labs Studios',
  shortName: 'Dynaxis',
  description:
    'Production-grade AI creative platform for image, video, cinema, audio, workflows, agents, and design.',
  tagline: 'Create. Build. Connect.',
  /** Upstream fork attribution (MIT / provenance — keep visible in settings/about) */
  attribution: {
    basedOn: 'Open Generative AI',
    upstreamRepo: 'https://github.com/Anil-matcha/Open-Generative-AI',
    license: 'MIT',
  },
  /** Current generation provider (do not rename domains) */
  providers: {
    muapi: {
      name: 'MuAPI',
      apiHost: 'https://api.muapi.ai',
      accessKeysUrl: 'https://muapi.ai/access-keys',
    },
  },
  /** Storage key for the MuAPI access credential (unchanged for compatibility) */
  session: {
    apiKeyStorageKey: 'muapi_key',
    /**
     * Legacy Design Agent package (CreativeCanvas) read `token`.
     * Phase 6G Design Agent Studio no longer depends on this key for auth.
     * Session helper may still mirror for unrelated MuAPI proxy compatibility —
     * Design Agent authorization is Dynaxis platform ownership, not MuAPI balance.
     */
    designAgentTokenKey: 'token',
    cookieName: 'muapi_key',
    cookieMaxAgeSeconds: 31536000,
  },
};

export const DYNAXIS_METADATA = {
  titleDefault: `${DYNAXIS_PRODUCT.name} — AI Creative Platform`,
  titleStudio: `Studio — ${DYNAXIS_PRODUCT.name}`,
  titleWorkflow: `Workflow — ${DYNAXIS_PRODUCT.name}`,
  titleAgents: `Agents — ${DYNAXIS_PRODUCT.name}`,
  description: DYNAXIS_PRODUCT.description,
};
