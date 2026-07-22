/**
 * Lip Sync source-context helpers (Phase 5E).
 * Pure / client-safe — no server modules, no secrets.
 *
 * Continuity remains reference-based. Lip Sync does not invent Character identity;
 * it animates explicitly selected source media with optional Character provenance.
 */

import {
  IDENTITY_ROLE_PRIORITY,
  selectCharacterReferences,
  buildVisualDescription,
} from './consumer.js';

/** Roles suitable as Lip Sync portrait / identity image sources. */
export const LIPSYNC_PORTRAIT_ROLES = [
  'identity_reference',
  'portrait_reference',
  'generated_portrait',
  'character_reference',
];

/**
 * @typedef {Object} LipSyncModelCapability
 * @property {boolean} supportsImage
 * @property {boolean} supportsVideo
 * @property {boolean} hasPrompt
 * @property {boolean} hasSeed
 * @property {boolean} hasResolution
 * @property {string[]} resolutions
 * @property {string|null} defaultResolution
 * @property {'image'|'video'|'unknown'} category
 */

/**
 * Derive Lip Sync model capability from studio model metadata.
 * @param {object|null} model
 * @returns {LipSyncModelCapability}
 */
export function getLipSyncModelCapability(model) {
  if (!model) {
    return {
      supportsImage: false,
      supportsVideo: false,
      hasPrompt: false,
      hasSeed: false,
      hasResolution: false,
      resolutions: [],
      defaultResolution: null,
      category: 'unknown',
    };
  }
  const category = model.category === 'video' ? 'video' : model.category === 'image' ? 'image' : 'unknown';
  const resolutions = model.inputs?.resolution?.enum || [];
  return {
    supportsImage: category === 'image',
    supportsVideo: category === 'video',
    hasPrompt: Boolean(model.hasPrompt),
    hasSeed: Boolean(model.hasSeed),
    hasResolution: resolutions.length > 0,
    resolutions,
    defaultResolution: model.inputs?.resolution?.default || resolutions[0] || null,
    category,
  };
}

/**
 * Resolve the active visual source for IMAGE mode.
 * Precedence (explicit, non-silent): upload > project Asset > Character reference.
 *
 * @param {{
 *   uploadedImageUrl?: string|null,
 *   imageAsset?: { id?: string, url?: string }|null,
 *   characterReference?: { assetId?: string, url?: string, role?: string }|null,
 * }} inputs
 */
export function resolveImageSource(inputs = {}) {
  if (inputs.uploadedImageUrl) {
    return {
      kind: 'upload',
      url: inputs.uploadedImageUrl,
      assetId: null,
      characterReferenceAssetId: null,
    };
  }
  if (inputs.imageAsset?.url) {
    return {
      kind: 'asset',
      url: inputs.imageAsset.url,
      assetId: inputs.imageAsset.id || null,
      characterReferenceAssetId: null,
    };
  }
  if (inputs.characterReference?.url) {
    return {
      kind: 'character_reference',
      url: inputs.characterReference.url,
      assetId: inputs.characterReference.assetId || null,
      characterReferenceAssetId: inputs.characterReference.assetId || null,
    };
  }
  return { kind: 'none', url: null, assetId: null, characterReferenceAssetId: null };
}

/**
 * Resolve the active video source for VIDEO mode.
 * Precedence: upload > project Asset.
 */
export function resolveVideoSource(inputs = {}) {
  if (inputs.uploadedVideoUrl) {
    return {
      kind: 'upload',
      url: inputs.uploadedVideoUrl,
      assetId: null,
    };
  }
  if (inputs.videoAsset?.url) {
    return {
      kind: 'asset',
      url: inputs.videoAsset.url,
      assetId: inputs.videoAsset.id || null,
    };
  }
  return { kind: 'none', url: null, assetId: null };
}

/**
 * Resolve the active audio source.
 * Precedence: upload > project Asset.
 * Audio is an Asset — never a Voice Identity.
 */
export function resolveAudioSource(inputs = {}) {
  if (inputs.uploadedAudioUrl) {
    return {
      kind: 'upload',
      url: inputs.uploadedAudioUrl,
      assetId: null,
    };
  }
  if (inputs.audioAsset?.url) {
    return {
      kind: 'asset',
      url: inputs.audioAsset.url,
      assetId: inputs.audioAsset.id || null,
    };
  }
  return { kind: 'none', url: null, assetId: null };
}

/**
 * Pick a single Character portrait reference for Lip Sync image mode.
 *
 * @param {Array} assets — normalised Character asset links
 * @param {{ selectedAssetIds?: string[]|null }} [opts]
 */
export function selectLipSyncPortraitReference(assets, opts = {}) {
  const selection = selectCharacterReferences(assets, {
    maxImages: 1,
    selectedAssetIds: opts.selectedAssetIds || null,
    preferredRoles: LIPSYNC_PORTRAIT_ROLES.length
      ? LIPSYNC_PORTRAIT_ROLES
      : IDENTITY_ROLE_PRIORITY,
  });
  return selection.references[0] || null;
}

/**
 * Build a generation-safe Lip Sync source context.
 *
 * @param {{
 *   inputMode: 'image'|'video',
 *   model?: object|null,
 *   uploadedImageUrl?: string|null,
 *   uploadedVideoUrl?: string|null,
 *   uploadedAudioUrl?: string|null,
 *   imageAsset?: object|null,
 *   videoAsset?: object|null,
 *   audioAsset?: object|null,
 *   characterContext?: object|null,
 *   selectedCharRefIds?: string[]|null,
 *   prompt?: string|null,
 *   resolution?: string|null,
 * }} input
 */
export function resolveLipSyncSourceContext(input = {}) {
  const inputMode = input.inputMode === 'video' ? 'video' : 'image';
  const capability = getLipSyncModelCapability(input.model || null);

  const character = input.characterContext?.character || null;
  const revision = input.characterContext?.revision || null;
  const provenance = input.characterContext?.provenance || null;
  const allAssets = input.characterContext?.visual?.allAssets || [];

  const portraitRef =
    inputMode === 'image'
      ? selectLipSyncPortraitReference(allAssets, {
          selectedAssetIds: input.selectedCharRefIds || null,
        })
      : null;

  const imageSource =
    inputMode === 'image'
      ? resolveImageSource({
          uploadedImageUrl: input.uploadedImageUrl,
          imageAsset: input.imageAsset,
          characterReference: portraitRef,
        })
      : { kind: 'none', url: null, assetId: null, characterReferenceAssetId: null };

  const videoSource =
    inputMode === 'video'
      ? resolveVideoSource({
          uploadedVideoUrl: input.uploadedVideoUrl,
          videoAsset: input.videoAsset,
        })
      : { kind: 'none', url: null, assetId: null };

  const audioSource = resolveAudioSource({
    uploadedAudioUrl: input.uploadedAudioUrl,
    audioAsset: input.audioAsset,
  });

  // Explicit Character association (image OR video). Never inferred from appearance.
  const characterId = provenance?.characterId || character?.id || null;
  const characterRevisionId =
    provenance?.characterRevisionId ||
    revision?.id ||
    character?.currentRevisionId ||
    null;

  // Preserve Character provenance from a source video Asset only when already explicit.
  const videoAssetCharacterId = input.videoAsset?.metadata?.characterId || null;
  const videoAssetCharacterRevisionId =
    input.videoAsset?.metadata?.characterRevisionId || null;
  const effectiveCharacterId = characterId || videoAssetCharacterId || null;
  const effectiveCharacterRevisionId =
    characterRevisionId ||
    (effectiveCharacterId === videoAssetCharacterId
      ? videoAssetCharacterRevisionId
      : null) ||
    null;

  const visualDescription =
    capability.hasPrompt && character
      ? buildVisualDescription(character, revision)
      : null;

  const ready =
    Boolean(audioSource.url) &&
    (inputMode === 'image' ? Boolean(imageSource.url) : Boolean(videoSource.url));

  return {
    inputMode,
    capability,
    ready,
    imageSource,
    videoSource,
    audioSource,
    characterId: effectiveCharacterId,
    characterRevisionId: effectiveCharacterRevisionId,
    characterReferenceAssetId:
      imageSource.kind === 'character_reference'
        ? imageSource.characterReferenceAssetId
        : null,
    visualDescription,
    continuity: 'reference-based',
    provenance: {
      characterId: effectiveCharacterId,
      characterRevisionId: effectiveCharacterRevisionId,
      characterReferenceAssetId:
        imageSource.kind === 'character_reference'
          ? imageSource.characterReferenceAssetId
          : null,
      sourceImageAssetId:
        imageSource.kind === 'asset' ? imageSource.assetId : null,
      sourceVideoAssetId:
        videoSource.kind === 'asset' ? videoSource.assetId : null,
      audioAssetId: audioSource.kind === 'asset' ? audioSource.assetId : null,
      sourceImageKind: imageSource.kind,
      sourceVideoKind: videoSource.kind,
      audioKind: audioSource.kind,
      continuity: 'reference-based',
    },
  };
}

/**
 * Build MuAPI processLipSync params from a resolved source context.
 */
export function buildLipSyncRequestParams(ctx, extras = {}) {
  const params = {
    model: extras.modelId,
    audio_url: ctx.audioSource.url,
  };
  if (ctx.inputMode === 'image') {
    params.image_url = ctx.imageSource.url;
  } else {
    params.video_url = ctx.videoSource.url;
  }
  if (ctx.capability.hasPrompt) {
    const userPrompt = (extras.prompt || '').trim();
    // Visual description only — never persona/systemPrompt/greeting
    if (userPrompt && ctx.visualDescription) {
      params.prompt = `${userPrompt}. ${ctx.visualDescription}`;
    } else if (userPrompt) {
      params.prompt = userPrompt;
    } else if (ctx.visualDescription) {
      params.prompt = ctx.visualDescription;
    }
  }
  if (ctx.capability.hasResolution && extras.resolution) {
    params.resolution = extras.resolution;
  }
  if (ctx.capability.hasSeed && extras.seed !== undefined) {
    params.seed = extras.seed;
  }
  return params;
}
