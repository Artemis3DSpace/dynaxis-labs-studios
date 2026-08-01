const RUNTIME_ONLY_FIELD_NAMES = new Set([
  '_internal',
  '_runtime',
  'runtimeHints',
  'runtimeCache',
  'workerHints',
]);

function stripRuntimeOnlyFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripRuntimeOnlyFields(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    if (RUNTIME_ONLY_FIELD_NAMES.has(key)) continue;
    next[key] = stripRuntimeOnlyFields(entry);
  }
  return next;
}

export function exportAppFactoryPackage(appIr) {
  return stripRuntimeOnlyFields(appIr);
}
