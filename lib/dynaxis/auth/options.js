/**
 * Dynaxis Better Auth configuration contract.
 *
 * Better Auth is infrastructure here, not the Dynaxis identity domain model.
 */

export const DYNAXIS_AUTH_APP_NAME = 'Dynaxis Labs Studios';
export const DYNAXIS_AUTH_BASE_PATH = '/api/auth';
export const DYNAXIS_AUTH_MIN_PASSWORD_LENGTH = 12;
export const DYNAXIS_AUTH_MAX_PASSWORD_LENGTH = 128;

export class DynaxisAuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DynaxisAuthConfigurationError';
    this.code = 'DYNAXIS_AUTH_CONFIGURATION_ERROR';
    this.status = 500;
  }
}

export function resolveDynaxisAuthEnvironment(env = process.env) {
  const secret = String(env.BETTER_AUTH_SECRET || '').trim();
  const baseURL = String(env.BETTER_AUTH_URL || '').trim();
  const isProduction = env.NODE_ENV === 'production';
  const allowTestFallback =
    env.NODE_ENV === 'test' || env.DYNAXIS_AUTH_ALLOW_INSECURE_TEST_SECRET === '1';

  if (isProduction && !secret) {
    throw new DynaxisAuthConfigurationError('BETTER_AUTH_SECRET is required in production');
  }
  if (isProduction && !baseURL) {
    throw new DynaxisAuthConfigurationError('BETTER_AUTH_URL is required in production');
  }
  if (!secret && !allowTestFallback) {
    throw new DynaxisAuthConfigurationError(
      'BETTER_AUTH_SECRET is required. Set DYNAXIS_AUTH_ALLOW_INSECURE_TEST_SECRET=1 only for local/test execution.'
    );
  }

  return {
    secret: secret || 'dynaxis-insecure-test-auth-secret-do-not-use-in-production',
    baseURL: baseURL || 'http://localhost:3000',
    usedFallbackSecret: !secret,
    usedFallbackBaseURL: !baseURL,
  };
}

export function createDynaxisAuthOptions({ database, env = process.env } = {}) {
  const authEnv = resolveDynaxisAuthEnvironment(env);
  const options = {
    appName: DYNAXIS_AUTH_APP_NAME,
    basePath: DYNAXIS_AUTH_BASE_PATH,
    secret: authEnv.secret,
    baseURL: authEnv.baseURL,
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: DYNAXIS_AUTH_MIN_PASSWORD_LENGTH,
      maxPasswordLength: DYNAXIS_AUTH_MAX_PASSWORD_LENGTH,
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
    },
    account: {
      accountLinking: {
        enabled: false,
      },
    },
    session: {
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: false,
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 10,
      max: 100,
    },
    telemetry: {
      enabled: false,
    },
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    plugins: [],
  };

  return options;
}

export function summarizeDynaxisAuthOptions(options) {
  return {
    appName: options.appName,
    basePath: options.basePath,
    emailAndPassword: {
      enabled: Boolean(options.emailAndPassword?.enabled),
      disableSignUp: Boolean(options.emailAndPassword?.disableSignUp),
      autoSignIn: Boolean(options.emailAndPassword?.autoSignIn),
      minPasswordLength: options.emailAndPassword?.minPasswordLength,
      maxPasswordLength: options.emailAndPassword?.maxPasswordLength,
    },
    session: {
      storeSessionInDatabase: Boolean(options.session?.storeSessionInDatabase),
      cookieCacheEnabled: Boolean(options.session?.cookieCache?.enabled),
    },
    rateLimit: {
      enabled: Boolean(options.rateLimit?.enabled),
      storage: options.rateLimit?.storage,
      window: options.rateLimit?.window,
      max: options.rateLimit?.max,
    },
    telemetry: {
      enabled: Boolean(options.telemetry?.enabled),
    },
    advanced: {
      database: {
        generateId: options.advanced?.database?.generateId,
      },
    },
    plugins: (options.plugins || []).map((plugin) => plugin.id || plugin.name || 'unknown'),
  };
}
