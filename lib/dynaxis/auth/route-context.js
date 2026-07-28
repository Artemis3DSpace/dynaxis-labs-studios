import 'server-only';
import { NextResponse } from 'next/server';
import {
  AUTH_CONTEXT_ERROR_CODES,
  AUTH_CONTEXT_SUBJECT_TYPES,
  AuthContextError,
  loadAuthContextFromRequest,
  checkAuthContextPermission,
  requireAuthContextProject,
  requireAuthContextWorkspace,
  resolveAuthContextProject,
} from './auth-context.js';
import { getDynaxisAuth } from './server.js';
import {
  NO_PRINCIPAL,
  NO_PROJECT,
  RESOURCE_SCOPE_MISMATCH,
  UNKNOWN_PERMISSION,
} from './policy.js';
import {
  PROJECT_MEMBERSHIP_ERROR_CODES,
  ProjectMembershipServiceError,
  projectMembershipService as defaultProjectMembershipService,
} from '../identity/project-membership.js';

export const DYNAXIS_ROUTE_AUTH_ERROR_CODES = Object.freeze({
  AUTHENTICATION_REQUIRED: 'DYNAXIS_ROUTE_AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'DYNAXIS_ROUTE_AUTH_FORBIDDEN',
  NOT_FOUND: 'DYNAXIS_ROUTE_AUTH_NOT_FOUND',
  INVALID_AUTH_REQUEST: 'DYNAXIS_ROUTE_AUTH_INVALID_REQUEST',
  WORKSPACE_REQUIRED: 'DYNAXIS_ROUTE_AUTH_WORKSPACE_REQUIRED',
  INTERNAL: 'DYNAXIS_ROUTE_AUTH_INTERNAL',
});

const SAFE_STATUS_CODES = new Set([400, 401, 403, 404, 500]);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStatus(status, fallback = 500) {
  const numeric = Number(status || fallback);
  if (SAFE_STATUS_CODES.has(numeric)) {
    return numeric;
  }
  if (numeric >= 400 && numeric < 500) {
    return 403;
  }
  return 500;
}

function legacyApiKeyWasPresented(request) {
  return Boolean(request?.headers?.get('x-api-key') || request?.headers?.get('X-Api-Key'));
}

function legacyCompatibilityAudit(request, authContext, enabled) {
  const compatibility = authContext?.compatibility || null;
  const used = authContext?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY;
  return Object.freeze({
    enabled: enabled === true,
    presented: legacyApiKeyWasPresented(request),
    used,
    source: 'x-api-key',
    ...(used && compatibility?.mode ? { mode: compatibility.mode } : {}),
    ...(used && compatibility?.ownerRef ? { ownerRef: compatibility.ownerRef } : {}),
  });
}

function routeContextEnvelope(request, authContext, legacyCompatibility) {
  return Object.freeze({
    request,
    method: request?.method || 'GET',
    authContext,
    context: authContext,
    legacyCompatibility: legacyCompatibilityAudit(request, authContext, legacyCompatibility),
  });
}

function isRequest(value) {
  return value?.headers && typeof value.headers.get === 'function';
}

function isRouteContext(value) {
  return value?.authContext && value?.request;
}

function routeContextWithAuthContext(routeContext, authContext) {
  return routeContextEnvelope(
    routeContext.request,
    authContext,
    routeContext.legacyCompatibility?.enabled === true
  );
}

function assertLegacyCompatibilityOption(value) {
  if (value === true || value === false || value === undefined) {
    return value === true;
  }
  throw new RouteAuthError('legacyCompatibility must be a boolean', {
    status: 400,
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
    publicMessage: 'Invalid authorization request',
  });
}

function projectMembershipCacheKey(input = {}) {
  return [
    String(input.projectId || '').trim(),
    String(input.organizationId || '').trim(),
    String(input.userId || '').trim(),
  ].join('\n');
}

function createCachedProjectMembershipService(service = defaultProjectMembershipService) {
  if (!service?.get) {
    return service;
  }
  const cache = new Map();
  return {
    async get(input) {
      const key = projectMembershipCacheKey(input);
      if (!cache.has(key)) {
        cache.set(key, service.get(input));
      }
      return cache.get(key);
    },
  };
}

function publicAuthErrorForStatus(status) {
  if (status === 401) {
    return {
      status,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      error: 'Authentication required',
    };
  }
  if (status === 404) {
    return {
      status,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.NOT_FOUND,
      error: 'Not found',
    };
  }
  if (status === 400) {
    return {
      status,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
      error: 'Invalid authorization request',
    };
  }
  if (status === 403) {
    return {
      status,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.FORBIDDEN,
      error: 'Forbidden',
    };
  }
  return {
    status: 500,
    code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INTERNAL,
    error: 'Internal authorization error',
  };
}

function publicAuthErrorForDecision(decision = {}) {
  if (decision.reason === UNKNOWN_PERMISSION) {
    return publicAuthErrorForStatus(400);
  }
  if (decision.reason === NO_PRINCIPAL) {
    return publicAuthErrorForStatus(401);
  }
  if (decision.reason === NO_PROJECT || decision.reason === RESOURCE_SCOPE_MISMATCH) {
    return publicAuthErrorForStatus(404);
  }
  return publicAuthErrorForStatus(normalizeStatus(decision.status, 403));
}

function publicAuthErrorForProjectMembershipError(err) {
  if (
    err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_NOT_FOUND ||
    err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_WORKSPACE_UNRESOLVED ||
    err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.WORKSPACE_MISMATCH
  ) {
    return publicAuthErrorForStatus(404);
  }
  if (
    err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.USER_NOT_WORKSPACE_MEMBER ||
    err?.code === PROJECT_MEMBERSHIP_ERROR_CODES.PROJECT_MEMBERSHIP_NOT_FOUND
  ) {
    return publicAuthErrorForStatus(403);
  }
  return publicAuthErrorForStatus(normalizeStatus(err?.status, 403));
}

export class RouteAuthError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'RouteAuthError';
    this.status = normalizeStatus(opts.status, 403);
    this.code = opts.code || publicAuthErrorForStatus(this.status).code;
    this.publicMessage = opts.publicMessage || publicAuthErrorForStatus(this.status).error;
    if (opts.decision) {
      this.decision = opts.decision;
    }
    if (opts.cause) {
      this.cause = opts.cause;
    }
  }
}

export function isRouteAuthError(err) {
  return (
    err instanceof RouteAuthError ||
    err instanceof AuthContextError ||
    err instanceof ProjectMembershipServiceError
  );
}

export function mapRouteAuthError(err) {
  if (err instanceof RouteAuthError) {
    return {
      status: err.status,
      code: err.code,
      error: err.publicMessage,
    };
  }

  if (err instanceof AuthContextError) {
    if (err.decision) {
      return publicAuthErrorForDecision(err.decision);
    }
    if (err.code === AUTH_CONTEXT_ERROR_CODES.WORKSPACE_REQUIRED) {
      return {
        status: normalizeStatus(err.status, 403),
        code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.WORKSPACE_REQUIRED,
        error: 'Workspace access required',
      };
    }
    if (err.code === AUTH_CONTEXT_ERROR_CODES.PROJECT_REQUIRED) {
      return publicAuthErrorForStatus(404);
    }
    if (err.code === AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT) {
      return publicAuthErrorForStatus(403);
    }
    return publicAuthErrorForStatus(normalizeStatus(err.status, 403));
  }

  if (err instanceof ProjectMembershipServiceError) {
    return publicAuthErrorForProjectMembershipError(err);
  }

  return null;
}

export function jsonRouteAuthError(err) {
  const mapped = mapRouteAuthError(err) || publicAuthErrorForStatus(500);
  return NextResponse.json(
    {
      error: mapped.error,
      code: mapped.code,
    },
    { status: mapped.status }
  );
}

async function loadDefaultRouteAuthContext(request, opts = {}) {
  return loadAuthContextFromRequest(request, {
    ...opts,
    auth: opts.auth || (opts.sessionLoader ? undefined : getDynaxisAuth()),
  });
}

export async function loadRouteAuthContext(request, opts = {}) {
  const {
    legacyCompatibility = false,
    authContextLoader = loadDefaultRouteAuthContext,
    projectId,
    project,
    projectMembershipService,
    ...authContextOptions
  } = opts;
  const legacyCompatibilityEnabled = assertLegacyCompatibilityOption(legacyCompatibility);
  const cachedProjectMembershipService = createCachedProjectMembershipService(
    projectMembershipService || defaultProjectMembershipService
  );
  let authContext = await authContextLoader(request, {
    ...authContextOptions,
    legacyCompatibility: legacyCompatibilityEnabled,
  });

  if (hasText(projectId) || project) {
    authContext = await resolveAuthContextProject(authContext, {
      projectId,
      project,
      projectMembershipService: cachedProjectMembershipService,
    });
  }

  return routeContextEnvelope(request, authContext, legacyCompatibilityEnabled);
}

async function ensureRouteContext(requestOrRouteContext, opts = {}) {
  if (isRouteContext(requestOrRouteContext)) {
    return requestOrRouteContext;
  }
  if (!isRequest(requestOrRouteContext)) {
    throw new RouteAuthError('A Next.js Request is required', {
      status: 400,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
      publicMessage: 'Invalid authorization request',
    });
  }
  return loadRouteAuthContext(requestOrRouteContext, opts);
}

export async function requireRouteAuthContext(requestOrRouteContext, opts = {}) {
  const routeContext = await ensureRouteContext(requestOrRouteContext, opts);
  if (routeContext.authContext?.isAuthenticated !== true) {
    throw new RouteAuthError('Route requires an authenticated AuthContext', {
      status: 401,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      publicMessage: 'Authentication required',
    });
  }
  return routeContext;
}

export async function requireRouteWorkspace(requestOrRouteContext, opts = {}) {
  const routeContext = await requireRouteAuthContext(requestOrRouteContext, opts);
  requireAuthContextWorkspace(routeContext.authContext);
  return routeContext;
}

export async function resolveRouteProject(requestOrRouteContext, opts = {}) {
  const { projectId, project, projectMembershipService, ...authContextOptions } = opts;
  const routeContext = await ensureRouteContext(requestOrRouteContext, authContextOptions);
  const cachedProjectMembershipService = createCachedProjectMembershipService(
    projectMembershipService || defaultProjectMembershipService
  );
  const authContext = await resolveAuthContextProject(routeContext.authContext, {
    projectId,
    project,
    projectMembershipService: cachedProjectMembershipService,
  });
  return routeContextWithAuthContext(routeContext, authContext);
}

export async function requireRouteProject(requestOrRouteContext, opts = {}) {
  const { projectId, project, projectMembershipService, ...authContextOptions } = opts;
  const routeContext = await requireRouteAuthContext(requestOrRouteContext, authContextOptions);
  const withProject =
    hasText(projectId) || project
      ? await resolveRouteProject(routeContext, { projectId, project, projectMembershipService })
      : routeContext;
  requireAuthContextProject(withProject.authContext);
  return withProject;
}

export async function requireRoutePermission(requestOrRouteContext, opts = {}) {
  const {
    permission,
    projectId,
    project,
    projectMembershipService,
    resource,
    resourceId,
    resourceType,
    resourceRepository,
    ...authContextOptions
  } = opts;
  if (!hasText(permission)) {
    throw new RouteAuthError('Route permission is required', {
      status: 400,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.INVALID_AUTH_REQUEST,
      publicMessage: 'Invalid authorization request',
    });
  }

  const routeContext = await ensureRouteContext(requestOrRouteContext, authContextOptions);
  if (routeContext.authContext?.isAuthenticated !== true) {
    throw new RouteAuthError('Route requires an authenticated AuthContext', {
      status: 401,
      code: DYNAXIS_ROUTE_AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED,
      publicMessage: 'Authentication required',
    });
  }
  const cachedProjectMembershipService = createCachedProjectMembershipService(
    projectMembershipService || defaultProjectMembershipService
  );
  const withProject =
    hasText(projectId) || project
      ? await resolveRouteProject(routeContext, {
          projectId,
          project,
          projectMembershipService: cachedProjectMembershipService,
        })
      : routeContext;
  const decision = await checkAuthContextPermission(withProject.authContext, permission, {
    projectMembershipService: cachedProjectMembershipService,
    resource,
    resourceId,
    resourceType,
    resourceRepository,
  });

  if (!decision.allowed) {
    const mapped = publicAuthErrorForDecision(decision);
    throw new RouteAuthError('Route AuthContext permission denied', {
      ...mapped,
      publicMessage: mapped.error,
      decision,
    });
  }

  return Object.freeze({
    ...withProject,
    authorization: Object.freeze(decision),
  });
}

export async function withAuthContextRoute(request, handler, opts = {}) {
  try {
    const routeContext = opts.permission
      ? await requireRoutePermission(request, opts)
      : opts.requireProject
        ? await requireRouteProject(request, opts)
        : opts.requireWorkspace
          ? await requireRouteWorkspace(request, opts)
          : opts.requireAuthenticated === false
            ? await loadRouteAuthContext(request, opts)
            : await requireRouteAuthContext(request, opts);

    return await handler(routeContext);
  } catch (err) {
    if (isRouteAuthError(err)) {
      return jsonRouteAuthError(err);
    }
    throw err;
  }
}
