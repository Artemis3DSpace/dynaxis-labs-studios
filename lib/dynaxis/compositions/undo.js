/**
 * Bounded client-side undo/redo for Composition documents (client-safe).
 */

const DEFAULT_MAX = 100;

/**
 * @param {object} [opts]
 * @param {number} [opts.maxHistory]
 */
export function createUndoState(opts = {}) {
  const max = opts.maxHistory ?? DEFAULT_MAX;
  return {
    past: [],
    present: null,
    future: [],
    max,
  };
}

/**
 * @param {ReturnType<typeof createUndoState>} state
 * @param {object} document
 */
export function pushUndo(state, document) {
  const snapshot = JSON.parse(JSON.stringify(document));
  if (state.present != null) {
    state.past.push(state.present);
    if (state.past.length > state.max) state.past.shift();
  }
  state.present = snapshot;
  state.future = [];
  return snapshot;
}

/**
 * @param {ReturnType<typeof createUndoState>} state
 */
export function undo(state) {
  if (!state.past.length) return state.present;
  const prev = state.past.pop();
  if (state.present != null) state.future.unshift(state.present);
  state.present = prev;
  return prev;
}

/**
 * @param {ReturnType<typeof createUndoState>} state
 */
export function redo(state) {
  if (!state.future.length) return state.present;
  const next = state.future.shift();
  if (state.present != null) state.past.push(state.present);
  state.present = next;
  return next;
}

export function canUndo(state) {
  return state.past.length > 0;
}

export function canRedo(state) {
  return state.future.length > 0;
}
