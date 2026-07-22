/**
 * Character Studio domain capability — headless-friendly.
 */

import {
  CHARACTER_ASPECT_RATIOS,
  CHARACTER_EDIT_ENDPOINT,
  CHARACTER_GENERATE_ENDPOINT,
  CHARACTER_RESOLUTIONS,
  CHARACTER_VISUAL_SYSTEM_PREFIX,
  MAX_REFERENCE_IMAGES,
  isValidAspectRatio,
  isValidResolution,
} from './presets.js';

/**
 * @typedef {Object} PortraitRequest
 * @property {string} characterId
 * @property {string} [prompt]
 * @property {string} [aspectRatio]
 * @property {string} [resolution]
 * @property {Array<{ assetId?: string, url?: string, role?: string }>} [referenceAssets]
 * @property {boolean} [forceEdit]
 */

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export function validatePortraitRequest(input) {
  const characterId = String(input?.characterId || '').trim();
  if (!characterId) throw err('CHARACTER_ID_REQUIRED', 'characterId is required');

  const aspectRatio = String(input?.aspectRatio || '1:1').trim();
  const resolution = String(input?.resolution || '1k').trim();
  if (!isValidAspectRatio(aspectRatio)) {
    throw err('INVALID_ASPECT', `Unsupported aspect ratio: ${aspectRatio}`);
  }
  if (!isValidResolution(resolution)) {
    throw err('INVALID_RESOLUTION', `Unsupported resolution: ${resolution}`);
  }

  const refs = Array.isArray(input?.referenceAssets) ? input.referenceAssets : [];
  if (refs.length > MAX_REFERENCE_IMAGES) {
    throw err('TOO_MANY_REFERENCES', `At most ${MAX_REFERENCE_IMAGES} reference images`);
  }

  return {
    characterId,
    prompt: input?.prompt ? String(input.prompt).trim() : '',
    aspectRatio,
    resolution,
    referenceAssets: refs,
    forceEdit: Boolean(input?.forceEdit),
  };
}

/**
 * Build visual prompt combining character profile + user visual description.
 */
export function buildVisualPrompt(character, userPrompt) {
  const parts = [CHARACTER_VISUAL_SYSTEM_PREFIX];
  if (character?.name) parts.push(`Character name: ${character.name}.`);
  if (character?.description) parts.push(character.description);
  if (character?.persona) parts.push(`Persona cues: ${character.persona}`);
  if (userPrompt) parts.push(userPrompt);
  else parts.push('Professional character portrait, consistent identity, high detail.');
  return parts.join(' ').trim();
}

/**
 * Resolve reference image URLs for nano-banana-pro-edit.
 */
export async function resolveReferenceUrls(runtime, characterId, explicitRefs = []) {
  const urls = [];
  const refs = [];

  for (const ref of explicitRefs) {
    if (ref.url && /^https?:\/\//i.test(ref.url)) {
      urls.push(ref.url);
      refs.push(ref);
      continue;
    }
    if (ref.assetId) {
      const listed = await runtime.listAssets({ limit: 100 });
      const assets = listed?.assets || [];
      const found = assets.find((a) => a.id === ref.assetId);
      if (found?.url) {
        urls.push(found.url);
        refs.push({ ...ref, url: found.url });
      }
    }
  }

  if (!urls.length && characterId) {
    const data = await runtime.listCharacterAssets(characterId);
    const links = data?.assets || data || [];
    for (const link of links) {
      const url = link.asset?.url || link.url;
      if (url && /^https?:\/\//i.test(url) && urls.length < MAX_REFERENCE_IMAGES) {
        urls.push(url);
        refs.push({
          assetId: link.assetId || link.asset?.id,
          url,
          role: link.role || 'identity_reference',
        });
      }
    }
  }

  return { urls, refs };
}

export function buildPortraitGenerationRequest({
  character,
  prompt,
  aspectRatio,
  resolution,
  referenceUrls,
  referenceAssets,
}) {
  const useEdit = referenceUrls.length > 0;
  const endpoint = useEdit ? CHARACTER_EDIT_ENDPOINT : CHARACTER_GENERATE_ENDPOINT;
  const fullPrompt = buildVisualPrompt(character, prompt);

  return {
    modelId: endpoint,
    endpoint,
    prompt: fullPrompt,
    outputType: 'image',
    characterId: character.id,
    characterRevisionId: character.currentRevisionId || null,
    parameters: {
      prompt: fullPrompt,
      aspect_ratio: aspectRatio,
      resolution,
      ...(useEdit ? { images_list: referenceUrls } : {}),
      characterId: character.id,
      characterRevisionId: character.currentRevisionId || null,
    },
    referenceAssets: (referenceAssets || []).map((r) => ({
      assetId: r.assetId,
      url: r.url,
      role: r.role || 'identity_reference',
    })),
  };
}

export async function generateCharacterPortrait(runtime, input) {
  if (!runtime?.createGeneration) {
    throw err('RUNTIME_MISSING', 'Mini App runtime is required');
  }
  const req = validatePortraitRequest(input);
  const charRes = await runtime.getCharacter(req.characterId, { includeAssets: 'true' });
  const character = charRes?.character || charRes;
  if (!character?.id) throw err('CHARACTER_NOT_FOUND', 'Character not found');

  const { urls, refs } = await resolveReferenceUrls(
    runtime,
    character.id,
    req.referenceAssets
  );
  if (req.forceEdit && !urls.length) {
    throw err('REFERENCES_REQUIRED', 'Edit mode requires at least one reference image');
  }

  // Ensure Character is linked to active project when generating
  try {
    const ctx = runtime.getProjectContext();
    if (ctx?.projectId) {
      await runtime.linkCharacterToProject(character.id, ctx.projectId);
    }
  } catch {
    // non-fatal
  }

  const generationRequest = buildPortraitGenerationRequest({
    character,
    prompt: req.prompt,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    referenceUrls: urls,
    referenceAssets: refs,
  });

  const outcome = await runtime.createGeneration(generationRequest);

  // Associate successful outputs as generated_portrait (not auto-promoted to identity)
  const assets = outcome?.assets || [];
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (!asset?.id) continue;
    try {
      await runtime.addCharacterAsset(character.id, {
        assetId: asset.id,
        role: 'generated_portrait',
        sortOrder: i,
        isPrimary: false,
        createRevision: i === assets.length - 1,
      });
    } catch {
      // Asset may already be linked / platform optional
    }
  }

  return outcome;
}

export async function refineCharacterPortrait(runtime, input) {
  return generateCharacterPortrait(runtime, { ...input, forceEdit: true });
}

export async function createCharacterCapability(runtime, input) {
  return runtime.createCharacter(input);
}

export async function updateCharacterCapability(runtime, characterId, input) {
  return runtime.updateCharacter(characterId, input);
}

export async function chatWithCharacter(runtime, input) {
  const characterId = input?.characterId;
  if (!characterId) throw err('CHARACTER_ID_REQUIRED', 'characterId is required');
  let conversationId = input?.conversationId || null;

  if (!conversationId) {
    const started = await runtime.startCharacterConversation({
      characterId,
      includeGreeting: input?.includeGreeting !== false,
      title: input?.title,
    });
    conversationId = started?.conversation?.id;
    if (input?.message == null) {
      return started;
    }
  }

  if (!input?.message) {
    return runtime.getCharacterConversation(conversationId);
  }

  return runtime.sendCharacterMessage(conversationId, {
    content: input.message,
    model: input.model,
  });
}

export async function promoteGeneratedPortrait(runtime, characterId, assetId, opts = {}) {
  return runtime.promoteCharacterAsset(characterId, {
    assetId,
    role: opts.role || 'identity_reference',
    isPrimary: opts.isPrimary !== false,
  });
}

export async function invokeCapability(name, args, runtime) {
  switch (name) {
    case 'createCharacter':
      return createCharacterCapability(runtime, args || {});
    case 'updateCharacter':
      return updateCharacterCapability(runtime, args?.characterId, args || {});
    case 'generateCharacterPortrait':
    case 'generate':
      return generateCharacterPortrait(runtime, args || {});
    case 'refineCharacterPortrait':
    case 'refine':
      return refineCharacterPortrait(runtime, args || {});
    case 'chatWithCharacter':
    case 'chat':
      return chatWithCharacter(runtime, args || {});
    case 'promoteReference':
      return promoteGeneratedPortrait(
        runtime,
        args?.characterId,
        args?.assetId,
        args || {}
      );
    case 'listAspectRatios':
      return { aspectRatios: CHARACTER_ASPECT_RATIOS };
    case 'listResolutions':
      return { resolutions: CHARACTER_RESOLUTIONS };
    case 'buildPlan':
      return buildPortraitGenerationRequest(args || {});
    default: {
      throw err('UNKNOWN_CAPABILITY', `Unknown Character Studio capability: ${name}`);
    }
  }
}

export {
  CHARACTER_ASPECT_RATIOS,
  CHARACTER_RESOLUTIONS,
  CHARACTER_GENERATE_ENDPOINT,
  CHARACTER_EDIT_ENDPOINT,
};
