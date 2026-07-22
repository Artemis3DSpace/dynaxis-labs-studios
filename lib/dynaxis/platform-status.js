/**
 * Platform service status notes (client-safe; no DB imports).
 */

export const PLATFORM_SERVICE_STATUS = {
  identity: 'PARTIAL',
  workspace: 'MISSING',
  projects: 'IMPLEMENTED',
  assets: 'IMPLEMENTED',
  history: 'IMPLEMENTED',
  billing: 'MISSING',
  credits: 'PARTIAL',
  storage: 'PARTIAL',
  jobs: 'IMPLEMENTED',
  modelGateway: 'PARTIAL',
};

export const PLATFORM_SERVICE_NOTES = {
  identity:
    'Phase 3 ownership uses hashed MuAPI API-key ownerRef. Full Dynaxis accounts deferred.',
  workspace: 'No org/workspace model yet.',
  projects: 'PostgreSQL-backed Dynaxis projects with Default Project auto-resolution.',
  assets: 'Unified metadata catalogue; MuAPI/CDN URLs remain storage locations in Phase 3.',
  history:
    'Durable dynaxis_generations records. hg_* localStorage retained for compatibility/import.',
  billing: 'No Dynaxis billing. MuAPI account billing is external.',
  credits: 'Display via studio getUserBalance → MuAPI. No Dynaxis ledger.',
  storage: 'Asset Blob Store (filesystem/S3) + MuAPI/CDN external URLs. No data-URL PNG persistence.',
  jobs: 'Persistent job lifecycle wrapping MuAPI submit/poll; MuAPI executes models.',
  modelGateway:
    'MuAPIProvider adapter exists for status/result normalisation. Studio still uses muapi.js client path.',
};
