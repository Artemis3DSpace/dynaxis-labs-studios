/**
 * Dynaxis Character consumer public exports.
 */

export {
  IDENTITY_ROLE_PRIORITY,
  VISUAL_SOURCE_ROLES,
  normaliseCharacterAssetLinks,
  selectCharacterReferences,
  buildVisualDescription,
  buildCharacterVisualContext,
  resolveCharacterContext,
  publishCharacterGenerationContext,
  clearCharacterGenerationContext,
  readCharacterGenerationContext,
} from './consumer.js';

export {
  getVideoImageCapability,
  characterSupportedForVideoCapability,
} from './video-capabilities.js';

export {
  LIPSYNC_PORTRAIT_ROLES,
  getLipSyncModelCapability,
  resolveImageSource,
  resolveVideoSource,
  resolveAudioSource,
  selectLipSyncPortraitReference,
  resolveLipSyncSourceContext,
  buildLipSyncRequestParams,
} from './lipsync-source.js';
