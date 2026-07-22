/**
 * No-op stand-in for the `server-only` marker package under `node --test`.
 *
 * In Next.js, `server-only` throws when reached from the client bundle (its
 * `default` export). In the Node test runner there is no client bundler, so we
 * resolve `server-only` to this empty module (mirroring the package's
 * `react-server` → `empty.js` behaviour) WITHOUT globally switching the
 * `react-server` export condition (which would break React client APIs such as
 * `React.Component`).
 */
export {};
