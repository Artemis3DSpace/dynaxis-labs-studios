/**
 * Default Mini App → MuAPI generation executor.
 * Uses executeMuapiPrediction so Dynaxis lifecycle is owned only by the Mini App runtime
 * (avoids double Generation/Job records from studio submitAndPoll).
 */

/** Keys stored for Dynaxis provenance — must not be sent to MuAPI. */
const DYNAXIS_ONLY_PARAM_KEYS = new Set([
  'headshotPreset',
  'miniAppId',
  'referenceAssets',
  'semanticRole',
  'characterId',
  'characterRevisionId',
  'characterPreset',
  'productId',
  'productRevisionId',
  'productPreset',
  'scenePreset',
  'brandId',
  'brandRevisionId',
  'brandLogoAssetId',
  'campaignId',
  'campaignRevisionId',
  'campaignConceptId',
  'campaignDeliverableId',
  'campaignFormatId',
]);

/**
 * Build a provider payload from a Mini App generation request.
 * @param {import('./generation-request.js').MiniAppGenerationRequest} request
 */
export function buildProviderPayload(request) {
  const parameters =
    request?.parameters && typeof request.parameters === 'object'
      ? { ...request.parameters }
      : {};
  for (const key of DYNAXIS_ONLY_PARAM_KEYS) {
    delete parameters[key];
  }
  if (request?.prompt != null && parameters.prompt == null) {
    parameters.prompt = request.prompt;
  }
  return parameters;
}

/**
 * @param {unknown} result
 * @returns {string[]}
 */
export function collectOutputUrls(result) {
  if (!result || typeof result !== 'object') return [];
  const out = /** @type {Record<string, unknown>} */ (result);
  if (Array.isArray(out.outputs)) {
    return out.outputs
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.url === 'string') {
          return item.url;
        }
        return null;
      })
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  }
  if (Array.isArray(out.urls)) {
    return out.urls.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
  }
  const single =
    out.url ||
    (out.output && typeof out.output === 'object'
      ? /** @type {{ url?: string }} */ (out.output).url
      : null);
  return typeof single === 'string' && /^https?:\/\//i.test(single) ? [single] : [];
}

/**
 * @param {import('./generation-request.js').MiniAppGenerationRequest} request
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
export async function executeMiniAppMuapiGeneration(request, apiKey) {
  if (!apiKey || apiKey === 'dynaxis-local-preview') {
    const err = new Error('MuAPI key required. Add your key in Settings.');
    err.code = 'MUAPI_KEY_MISSING';
    throw err;
  }
  const endpoint = request?.endpoint || request?.modelId;
  if (!endpoint) {
    const err = new Error('Generation request missing endpoint / modelId');
    err.code = 'GENERATION_ENDPOINT_MISSING';
    throw err;
  }

  const { executeMuapiPrediction } = await import('studio');
  const payload = buildProviderPayload(request);
  const result = await executeMuapiPrediction(apiKey, {
    endpoint,
    payload,
  });

  const urls = collectOutputUrls(result);
  return {
    ...result,
    outputs: urls.length ? urls : result?.outputs,
    url: urls[0] || result?.url || null,
    request_id: result?.request_id || result?.id || null,
  };
}
