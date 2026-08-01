/**
 * ESM resolve hook used only by `npm run test:dynaxis`.
 *
 * - Remaps `server-only` to a no-op module for Node tests.
 * - Remaps `next/server` to `next/server.js` because bare `next/server`
 *   does not resolve under the Node test runner's ESM resolution.
 *
 * This keeps production route code unchanged and limits behavior to test env.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      url: new URL('./server-only-empty.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }
  return nextResolve(specifier, context);
}
