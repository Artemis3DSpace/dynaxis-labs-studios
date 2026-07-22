/**
 * Brand Studio domain capability — headless-friendly.
 * Website scraping stays on the server analyze endpoint; this layer orchestrates CRUD + draft save.
 */

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function splitCsv(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitColors(value) {
  return splitCsv(value)
    .map((c) => {
      const t = c.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
      if (/^#[0-9a-fA-F]{3}$/.test(t)) {
        return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Normalise Brand DNA form / draft into create/update payload.
 */
export function normaliseBrandDnaInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw err('BRAND_NAME_REQUIRED', 'Brand name is required');

  return {
    name,
    industry: input.industry ? String(input.industry).trim() : null,
    tagline: input.tagline ? String(input.tagline).trim() : null,
    valueProposition: input.valueProposition
      ? String(input.valueProposition).trim()
      : null,
    targetAudience: input.targetAudience
      ? String(input.targetAudience).trim()
      : null,
    imageryStyle: input.imageryStyle ? String(input.imageryStyle).trim() : null,
    layoutStyle: input.layoutStyle ? String(input.layoutStyle).trim() : null,
    sourceUrl: input.sourceUrl ? String(input.sourceUrl).trim() : null,
    toneOfVoice: splitCsv(input.toneOfVoice),
    brandPersonality: splitCsv(input.brandPersonality),
    keyMessages: splitCsv(input.keyMessages),
    primaryColors: splitColors(input.primaryColors),
    secondaryColors: splitColors(input.secondaryColors),
    fonts: splitCsv(input.fonts),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
    projectId: input.projectId || undefined,
  };
}

export async function createBrand(runtime, input) {
  if (!runtime?.createBrand) throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  return runtime.createBrand(normaliseBrandDnaInput(input));
}

export async function updateBrand(runtime, brandId, input) {
  if (!runtime?.updateBrand) throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  if (!brandId) throw err('BRAND_ID_REQUIRED', 'brandId is required');
  return runtime.updateBrand(brandId, normaliseBrandDnaInput({ ...input, name: input.name || 'Brand' }));
}

export async function analyzeBrandWebsite(runtime, url) {
  if (!runtime?.analyzeBrandWebsite) {
    throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  }
  const href = String(url || '').trim();
  if (!href) throw err('URL_REQUIRED', 'Website URL is required');
  return runtime.analyzeBrandWebsite({ url: href });
}

/**
 * Persist an analyzed draft as a new Brand (or update existing).
 */
export async function saveBrandDraft(runtime, draft, opts = {}) {
  const payload = normaliseBrandDnaInput({
    ...draft,
    projectId: opts.projectId,
  });
  if (opts.brandId) {
    return runtime.updateBrand(opts.brandId, payload);
  }
  return runtime.createBrand(payload);
}

export async function attachBrandAsset(runtime, brandId, input) {
  if (!runtime?.addBrandAsset) throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  return runtime.addBrandAsset(brandId, input);
}

export async function linkProductToBrand(runtime, brandId, productId, opts = {}) {
  if (!runtime?.linkBrandToProduct) throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  return runtime.linkBrandToProduct(brandId, {
    productId,
    isPrimary: opts.isPrimary !== false,
  });
}

export async function resolveBrandContextCapability(runtime, brandId) {
  if (!runtime?.getBrand) throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  const data = await runtime.getBrand(brandId, { includeAssets: 'true' });
  return data;
}

export async function invokeCapability(name, args, runtime) {
  switch (name) {
    case 'createBrand':
      return createBrand(runtime, args || {});
    case 'updateBrand':
      return updateBrand(runtime, args?.brandId, args || {});
    case 'analyzeBrandWebsite':
    case 'analyze':
      return analyzeBrandWebsite(runtime, args?.url);
    case 'saveBrandDraft':
    case 'saveDraft':
      return saveBrandDraft(runtime, args?.draft || args || {}, args || {});
    case 'attachBrandAsset':
      return attachBrandAsset(runtime, args?.brandId, args || {});
    case 'linkProductToBrand':
      return linkProductToBrand(runtime, args?.brandId, args?.productId, args || {});
    case 'resolveBrandContext':
      return resolveBrandContextCapability(runtime, args?.brandId);
    default: {
      throw err('UNKNOWN_CAPABILITY', `Unknown Brand Studio capability: ${name}`);
    }
  }
}
