/**
 * Browser-safe shared Dynaxis auth constants.
 *
 * This module must not import Better Auth server plugins, database code,
 * environment resolution, secrets, or server runtime modules.
 */

export const DYNAXIS_AUTH_APP_NAME = 'Dynaxis Labs Studios';
export const DYNAXIS_AUTH_BASE_PATH = '/api/auth';
export const DYNAXIS_AUTH_MIN_PASSWORD_LENGTH = 12;
export const DYNAXIS_AUTH_MAX_PASSWORD_LENGTH = 128;
