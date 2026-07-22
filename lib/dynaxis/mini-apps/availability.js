/**
 * Mini App availability checks (platform readiness vs module requirements).
 */

/**
 * @typedef {Object} AvailabilityContext
 * @property {boolean} [databaseOk]
 * @property {boolean} [muapiKeyPresent]
 * @property {boolean} [projectContextPresent]
 * @property {string[]} [availableModelCapabilities]
 */

/**
 * @param {import('./manifest.js').MiniAppManifest} manifest
 * @param {AvailabilityContext} ctx
 */
export function checkMiniAppAvailability(manifest, ctx = {}) {
  /** @type {{ ok: boolean, reasons: string[], usable: boolean, presentation: string }} */
  const result = {
    ok: true,
    reasons: [],
    usable: true,
    presentation: 'usable',
  };

  if (manifest.status === 'disabled') {
    return {
      ok: false,
      reasons: ['Module is disabled'],
      usable: false,
      presentation: 'disabled',
    };
  }
  if (manifest.status === 'catalogue' || manifest.status === 'external') {
    return {
      ok: true,
      reasons: [],
      usable: false,
      presentation: 'catalogue',
    };
  }
  if (manifest.status === 'experimental') {
    result.presentation = 'experimental';
  }

  const caps = manifest.requiredCapabilities || [];
  if (caps.includes('database') && ctx.databaseOk === false) {
    result.ok = false;
    result.reasons.push('PostgreSQL platform persistence unavailable');
  }
  if ((caps.includes('muapi') || caps.includes('jobs') || caps.includes('generations')) &&
      ctx.muapiKeyPresent === false) {
    result.ok = false;
    result.reasons.push('MuAPI API key required');
  }
  if (manifest.requiresProjectContext && ctx.projectContextPresent === false) {
    result.ok = false;
    result.reasons.push('Active project context required');
  }
  if (manifest.modelCapabilities?.length && ctx.availableModelCapabilities) {
    const missing = manifest.modelCapabilities.filter(
      (c) => !ctx.availableModelCapabilities.includes(c)
    );
    if (missing.length) {
      result.ok = false;
      result.reasons.push(`Missing model capabilities: ${missing.join(', ')}`);
    }
  }

  result.usable = result.ok && ['integrated', 'available', 'experimental'].includes(manifest.status);
  if (!result.ok && result.presentation === 'usable') {
    result.presentation = 'unavailable';
  }
  return result;
}
