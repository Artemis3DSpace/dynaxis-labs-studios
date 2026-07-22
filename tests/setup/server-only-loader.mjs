/**
 * ESM resolve hook: remap the bare specifier `server-only` to a no-op module
 * during Node tests. Surgical — it touches ONLY `server-only` and leaves all
 * other packages (notably `react`) resolving normally.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      url: new URL('./server-only-empty.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
