/**
 * Registers the `server-only` resolve hook for the Node test runner.
 * Used via `node --import ./tests/setup/allow-server-only.mjs`.
 */
import { register } from 'node:module';

register('./server-only-loader.mjs', import.meta.url);
