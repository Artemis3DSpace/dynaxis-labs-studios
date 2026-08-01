export const APP_IR_SCHEMA_FAMILY = 'app-ir';
export const APP_IR_VERSION_V0 = '0.0.0';
export const APP_IR_SUPPORTED_VERSIONS = Object.freeze([APP_IR_VERSION_V0]);

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersionOrNull(version) {
  if (typeof version !== 'string') {
    return null;
  }
  const match = version.trim().match(VERSION_RE);
  if (!match) {
    return null;
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function parseAppIrVersion(version) {
  const parsed = parseVersionOrNull(version);
  if (!parsed) {
    const err = new Error(`Invalid App IR version "${version}"`);
    err.code = 'APP_IR_VERSION_INVALID';
    throw err;
  }
  return parsed;
}

export function isSupportedAppIrVersion(version) {
  const parsed = parseVersionOrNull(version);
  if (!parsed) return false;
  return parsed.major === 0 && parsed.minor === 0;
}

export function isAppIrVersionCompatible(sourceVersion, targetVersion = APP_IR_VERSION_V0) {
  const source = parseVersionOrNull(sourceVersion);
  const target = parseVersionOrNull(targetVersion);
  if (!source || !target) return false;
  if (target.major !== 0 || target.minor !== 0) return false;
  return source.major === target.major && source.minor === target.minor;
}

export function assertAppIrVersionCompatible(sourceVersion, targetVersion = APP_IR_VERSION_V0) {
  if (!isAppIrVersionCompatible(sourceVersion, targetVersion)) {
    const err = new Error(
      `App IR version "${sourceVersion}" is not compatible with target "${targetVersion}"`
    );
    err.code = 'APP_IR_VERSION_INCOMPATIBLE';
    throw err;
  }
}
