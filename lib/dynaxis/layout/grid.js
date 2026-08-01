export const GRID_TRACK_TYPES = Object.freeze(['fixed', 'fr', 'auto', 'minmax']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function validateGridTracks(grid, { path = 'grid' } = {}) {
  const issues = [];
  if (!isPlainObject(grid)) {
    pushIssue(issues, path, 'grid must be an object');
    return { ok: false, issues };
  }

  if (!isPositiveInteger(grid.columns)) {
    pushIssue(issues, `${path}.columns`, 'columns must be a positive integer');
  }
  if (grid.columns > 24) {
    pushIssue(issues, `${path}.columns`, 'columns must be <= 24');
  }
  if (!isPositiveInteger(grid.rows)) {
    pushIssue(issues, `${path}.rows`, 'rows must be a positive integer');
  }
  if (!Array.isArray(grid.tracks)) {
    pushIssue(issues, `${path}.tracks`, 'tracks must be an array');
    return { ok: false, issues };
  }

  for (let i = 0; i < grid.tracks.length; i += 1) {
    const track = grid.tracks[i];
    const trackPath = `${path}.tracks[${i}]`;
    if (!isPlainObject(track)) {
      pushIssue(issues, trackPath, 'track must be an object');
      continue;
    }
    if (!['columns', 'rows'].includes(track.axis)) {
      pushIssue(issues, `${trackPath}.axis`, 'axis must be "columns" or "rows"');
    }
    if (!GRID_TRACK_TYPES.includes(track.type)) {
      pushIssue(issues, `${trackPath}.type`, `type must be one of: ${GRID_TRACK_TYPES.join(', ')}`);
    }
  }

  return { ok: issues.length === 0, issues };
}
