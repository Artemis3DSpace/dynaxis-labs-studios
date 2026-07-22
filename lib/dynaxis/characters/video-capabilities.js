/**
 * Video model image/reference capability helpers for Character reuse.
 */

/**
 * @typedef {Object} VideoImageCapability
 * @property {boolean} supportsImageReference
 * @property {boolean} isI2V
 * @property {boolean} isExtend
 * @property {boolean} isMotionControlV2V
 * @property {number} maxImages
 * @property {string|null} imageField
 * @property {string|null} lastImageField
 * @property {boolean} usesList
 * @property {string} mode — 'i2v' | 't2v' | 'v2v' | 'extend' | 'unknown'
 * @property {boolean} characterContinuitySupported
 * @property {string|null} unsupportedReason
 */

/**
 * @param {object|null} model — from i2vModels / t2vModels / v2vModels
 * @param {{ imageMode?: boolean, v2vMode?: boolean }} studioState
 * @returns {VideoImageCapability}
 */
export function getVideoImageCapability(model, studioState = {}) {
  if (!model) {
    return {
      supportsImageReference: false,
      isI2V: false,
      isExtend: false,
      isMotionControlV2V: false,
      maxImages: 0,
      imageField: null,
      lastImageField: null,
      usesList: false,
      mode: 'unknown',
      characterContinuitySupported: false,
      unsupportedReason: 'No model selected',
    };
  }

  const isExtend = Boolean(model.inputs?.images_list && !studioState.imageMode);
  const isMotionControlV2V = Boolean(
    studioState.v2vMode && model.imageField
  );
  const isI2V = Boolean(studioState.imageMode) || Boolean(model.imageField && !studioState.v2vMode && !isExtend);

  let maxImages = 0;
  let imageField = null;
  let lastImageField = model.lastImageField || null;
  let usesList = false;

  if (studioState.imageMode || model.mode === 'i2v' || (model.imageField && !studioState.v2vMode && !isExtend)) {
    imageField = model.imageField || 'image_url';
    maxImages =
      model.maxImages ||
      (model.inputs?.images_list?.maxItems) ||
      (lastImageField ? 2 : 1);
    usesList = imageField === 'images_list' || maxImages > 2;
  } else if (isExtend) {
    imageField = 'images_list';
    maxImages = model.inputs.images_list.maxItems || 8;
    usesList = true;
  } else if (isMotionControlV2V) {
    imageField = model.imageField || 'image_url';
    maxImages = 1;
    usesList = false;
  }

  const supportsImageReference = maxImages > 0;
  const characterContinuitySupported = supportsImageReference;

  return {
    supportsImageReference,
    isI2V: Boolean(studioState.imageMode),
    isExtend,
    isMotionControlV2V,
    maxImages,
    imageField,
    lastImageField,
    usesList,
    mode: studioState.v2vMode
      ? 'v2v'
      : studioState.imageMode
        ? 'i2v'
        : isExtend
          ? 'extend'
          : 't2v',
    characterContinuitySupported,
    unsupportedReason: characterContinuitySupported
      ? null
      : 'Selected model is text-to-video and cannot use Character reference images. Switch to an image-to-video model for reference-based continuity.',
  };
}

/**
 * Pure check used by tests without full model objects.
 */
export function characterSupportedForVideoCapability(capability) {
  return Boolean(capability?.characterContinuitySupported);
}
