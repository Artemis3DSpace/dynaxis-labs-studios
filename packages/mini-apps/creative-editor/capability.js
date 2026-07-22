/**
 * Creative Editor headless capabilities.
 */

export async function createCompositionFromAsset(runtime, body) {
  return runtime.createCompositionFromAsset(body);
}

export async function createCompositionFromDeliverable(runtime, body) {
  return runtime.createCompositionFromDeliverable(body);
}

export async function updateCompositionDraft(runtime, id, body) {
  return runtime.updateCompositionDraft(id, body);
}

export async function saveCompositionRevision(runtime, id, body) {
  return runtime.saveCompositionRevision(id, body);
}

export async function exportComposition(runtime, id) {
  return runtime.exportComposition(id);
}

export async function regenerateCleanBackground(runtime, compositionId) {
  const prep = await runtime.compositionAction(compositionId, {
    action: 'prepareCleanBackground',
  });
  const gen = await runtime.createGeneration(prep.generationRequest);
  const assetId = gen.assets?.[0]?.id;
  if (!assetId || !gen.executed) {
    throw Object.assign(new Error('Clean background generation did not produce an Asset'), {
      code: 'CLEAN_BG_FAILED',
    });
  }
  return runtime.compositionAction(compositionId, {
    action: 'applyBackground',
    assetId,
  });
}

export async function invokeCapability(runtime, name, args = {}) {
  switch (name) {
    case 'createComposition':
      return createCompositionFromAsset(runtime, args);
    case 'createCompositionFromAsset':
      return createCompositionFromAsset(runtime, args);
    case 'createCompositionFromDeliverable':
      return createCompositionFromDeliverable(runtime, args);
    case 'updateCompositionDraft':
      return updateCompositionDraft(runtime, args.compositionId, args);
    case 'saveCompositionRevision':
      return saveCompositionRevision(runtime, args.compositionId, args);
    case 'renderComposition':
    case 'exportComposition':
      return exportComposition(runtime, args.compositionId || args.id);
    case 'regenerateCleanBackground':
      return regenerateCleanBackground(runtime, args.compositionId || args.id);
    default:
      throw Object.assign(new Error(`Unknown capability: ${name}`), {
        code: 'CAPABILITY_UNKNOWN',
      });
  }
}
