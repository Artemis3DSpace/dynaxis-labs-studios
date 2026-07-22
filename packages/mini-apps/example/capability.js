/**
 * Domain/workflow capability — separable from React UI for future Skills/Agents.
 */

/**
 * Build a dry-run generation plan from user inputs.
 * @param {{ prompt: string, styleAssetUrl?: string|null }} input
 */
export function buildExampleGenerationPlan(input) {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  return {
    modelId: 'example-image',
    endpoint: 'example-image',
    prompt,
    outputType: 'image',
    parameters: {
      template: 'dynaxis.example',
    },
    referenceAssets: input.styleAssetUrl
      ? [{ url: input.styleAssetUrl, role: 'style_reference' }]
      : [],
  };
}

/**
 * Headless invoke entry for future Skills.
 * @param {string} name
 * @param {object} args
 * @param {import('../../../lib/dynaxis/mini-apps/runtime.js').createMiniAppRuntime extends Function ? any : any} runtime
 */
export async function invokeCapability(name, args, runtime) {
  if (name === 'planGeneration') {
    return buildExampleGenerationPlan(args || {});
  }
  if (name === 'readProject') {
    return runtime.getProjectContext();
  }
  if (name === 'listAssets') {
    return runtime.listAssets(args || {});
  }
  const err = new Error(`Unknown capability: ${name}`);
  err.code = 'UNKNOWN_CAPABILITY';
  throw err;
}
