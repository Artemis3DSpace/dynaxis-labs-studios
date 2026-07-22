/**
 * Dynaxis Labs Studios — default namespace entry (CLIENT-SAFE alias).
 *
 * Kept for backward compatibility. New client code should import from
 * `@/lib/dynaxis/client`; server code must import from `@/lib/dynaxis/server`.
 * This file only re-exports the client-safe surface and must never expose
 * server-only modules (see `client.js`).
 */

export * from './client.js';
