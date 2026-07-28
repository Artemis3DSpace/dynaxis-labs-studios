import 'server-only';
import { getApiKeyFromRequest, ownerRefFromApiKey } from '../ownership.js';
import { resolveActiveSessionWorkspace } from '../identity/session-workspace.js';
import { projectMembershipService as defaultProjectMembershipService } from '../identity/project-membership.js';
import { getPermissionDefinition } from './permissions.js';
import { authorizeDynaxis } from './policy.js';
import { isProjectPolicyPermission, authorizeProjectPolicy } from './project-policy.js';
import { authorizeResourceInheritance } from './resource-policy.js';

export const AUTH_CONTEXT_SUBJECT_TYPES = Object.freeze({
  ANONYMOUS: 'anonymous',
  USER: 'user',
  LEGACY: 'legacy',
  SERVICE_ACCOUNT: 'service-account',
});

export const AUTH_CONTEXT_AUTH_METHODS = Object.freeze({
  NONE: 'none',
  SESSION: 'session',
  LEGACY_MUAPI_KEY: 'legacy-muapi-key',
  INTERNAL: 'internal',
});

export const AUTH_CONTEXT_ERROR_CODES = Object.freeze({
  UNSUPPORTED_SUBJECT: 'DYNAXIS_AUTH_CONTEXT_UNSUPPORTED_SUBJECT',
  WORKSPACE_REQUIRED: 'DYNAXIS_AUTH_CONTEXT_WORKSPACE_REQUIRED',
  PROJECT_REQUIRED: 'DYNAXIS_AUTH_CONTEXT_PROJECT_REQUIRED',
  PERMISSION_DENIED: 'DYNAXIS_AUTH_CONTEXT_PERMISSION_DENIED',
});

const FORBIDDEN_SUBJECT_TYPES = Object.freeze([
  'provider-credential',
  'provider_connection',
  'provider-connection',
  'model-account',
  'model_account',
  'worker-adapter',
  'worker_adapter',
]);

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function textOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function freezePlain(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.freeze({ ...value });
}

export class AuthContextError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'AuthContextError';
    this.code = opts.code || AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED;
    this.status = opts.status || 403;
    if (opts.decision) {
      this.decision = opts.decision;
    }
  }
}

function rejectForbiddenSubjectType(type) {
  const normalizedType = textOrNull(type);
  if (!normalizedType || !FORBIDDEN_SUBJECT_TYPES.includes(normalizedType)) {
    return;
  }
  throw new AuthContextError('Provider credentials, model accounts, and worker adapters are not identity subjects', {
    code: AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT,
    status: 403,
  });
}

function safeSessionProjection(session) {
  if (!session) {
    return null;
  }
  const sessionId = textOrNull(session.id);
  const userId = textOrNull(session.userId || session.user?.id);
  const activeOrganizationId = textOrNull(
    session.activeOrganizationId || session.activeOrganization?.id
  );
  if (!sessionId && !userId && !activeOrganizationId) {
    return null;
  }
  return freezePlain({
    ...(sessionId ? { sessionId } : {}),
    ...(userId ? { userId } : {}),
    ...(activeOrganizationId ? { activeOrganizationId } : {}),
    ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}),
  });
}

function safeWorkspaceProjection(workspace) {
  const organizationId = textOrNull(workspace?.organizationId);
  if (!organizationId) {
    return null;
  }
  return freezePlain({
    organizationId,
    ...(workspace.role ? { role: workspace.role } : {}),
    isMember: workspace.isMember === true,
    isPersonal: workspace.isPersonal === true,
    ...(workspace.name ? { name: workspace.name } : {}),
    ...(workspace.slug ? { slug: workspace.slug } : {}),
  });
}

function safeProjectProjection(project) {
  const projectId = textOrNull(project?.projectId || project?.id);
  if (!projectId) {
    return null;
  }
  return freezePlain({
    projectId,
    ...(textOrNull(project.organizationId) ? { organizationId: textOrNull(project.organizationId) } : {}),
    ...(project.role ? { role: project.role } : {}),
    ...(project.isMember !== undefined ? { isMember: project.isMember === true } : {}),
    ...(textOrNull(project.ownerRef) ? { ownerRef: textOrNull(project.ownerRef) } : {}),
    ...(project.compatibility ? { compatibility: project.compatibility } : {}),
  });
}

function anonymousSubject() {
  return freezePlain({
    type: AUTH_CONTEXT_SUBJECT_TYPES.ANONYMOUS,
    authMethod: AUTH_CONTEXT_AUTH_METHODS.NONE,
    isAuthenticated: false,
  });
}

function userSubject({ userId, sessionId }) {
  const id = textOrNull(userId);
  if (!id) {
    return anonymousSubject();
  }
  return freezePlain({
    type: AUTH_CONTEXT_SUBJECT_TYPES.USER,
    subjectId: `user:${id}`,
    userId: id,
    authMethod: AUTH_CONTEXT_AUTH_METHODS.SESSION,
    isAuthenticated: true,
    ...(sessionId ? { sessionId } : {}),
  });
}

function legacySubject(legacyOwnerRef) {
  const ownerRef = textOrNull(legacyOwnerRef);
  if (!ownerRef) {
    return anonymousSubject();
  }
  return freezePlain({
    type: AUTH_CONTEXT_SUBJECT_TYPES.LEGACY,
    subjectId: `legacy:${ownerRef}`,
    legacyOwnerRef: ownerRef,
    authMethod: AUTH_CONTEXT_AUTH_METHODS.LEGACY_MUAPI_KEY,
    isAuthenticated: true,
  });
}

export function createServiceAccountSubject({ serviceAccountId, principalId, scopes = [] } = {}) {
  const id = textOrNull(serviceAccountId || principalId);
  if (!id) {
    throw new AuthContextError('Service account subject requires an id', {
      code: AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT,
      status: 403,
    });
  }
  return freezePlain({
    type: AUTH_CONTEXT_SUBJECT_TYPES.SERVICE_ACCOUNT,
    subjectId: `service-account:${id}`,
    serviceAccountId: id,
    principalId: id,
    scopes: Object.freeze([...scopes]),
    authMethod: AUTH_CONTEXT_AUTH_METHODS.INTERNAL,
    isAuthenticated: true,
  });
}

function principalForSubject(subject) {
  if (subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.USER && hasText(subject.userId)) {
    return freezePlain({
      type: 'human',
      principalId: subject.subjectId,
      userId: subject.userId,
      authMethod: 'session',
    });
  }
  if (subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY && hasText(subject.legacyOwnerRef)) {
    return freezePlain({
      type: 'legacy',
      legacyOwnerRef: subject.legacyOwnerRef,
      authMethod: 'legacy-muapi-key',
    });
  }
  if (
    subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.SERVICE_ACCOUNT &&
    hasText(subject.principalId)
  ) {
    return freezePlain({
      type: 'service',
      principalId: subject.principalId,
      authMethod: 'internal',
    });
  }
  return null;
}

function authContext({ subject, session = null, workspace = null, project = null, compatibility = null }) {
  const normalizedSubject = freezePlain(subject || anonymousSubject());
  const principal = principalForSubject(normalizedSubject);
  return Object.freeze({
    subject: normalizedSubject,
    principal,
    session: safeSessionProjection(session),
    workspace: safeWorkspaceProjection(workspace),
    project: safeProjectProjection(project),
    permissions: Object.freeze({
      principal,
      workspace: safeWorkspaceProjection(workspace),
      project: safeProjectProjection(project),
    }),
    compatibility: compatibility ? freezePlain(compatibility) : null,
    isAuthenticated: normalizedSubject.isAuthenticated === true,
  });
}

export function createAnonymousAuthContext() {
  return authContext({ subject: anonymousSubject() });
}

export function createLegacyAuthContext({ legacyOwnerRef } = {}) {
  const ownerRef = textOrNull(legacyOwnerRef);
  const subject = legacySubject(ownerRef);
  return authContext({
    subject,
    compatibility: ownerRef
      ? {
          mode: 'legacy-owner-ref-route',
          ownerRef,
          legacyOwnerRef: ownerRef,
        }
      : null,
  });
}

export function createLegacyAuthContextFromRequest(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return createAnonymousAuthContext();
  }
  return createLegacyAuthContext({ legacyOwnerRef: ownerRefFromApiKey(apiKey) });
}

export function createServiceAccountAuthContext(input = {}) {
  return authContext({ subject: createServiceAccountSubject(input) });
}

export async function createUserAuthContextFromSession(
  sessionPayload,
  { workspace = undefined, workspaceResolver = resolveActiveSessionWorkspace } = {}
) {
  const session = sessionPayload?.session || sessionPayload;
  const user = sessionPayload?.user || session?.user || null;
  const userId = textOrNull(session?.userId || user?.id);
  const sessionId = textOrNull(session?.id);
  const resolvedWorkspace =
    workspace === undefined ? await workspaceResolver(sessionPayload) : workspace;

  return authContext({
    subject: userSubject({ userId, sessionId }),
    session,
    workspace: resolvedWorkspace,
  });
}

async function loadSessionFromAuth(request, auth) {
  if (!auth?.api?.getSession) {
    return null;
  }
  return auth.api.getSession({ headers: request.headers });
}

export async function loadAuthContextFromRequest(
  request,
  {
    auth,
    sessionLoader = loadSessionFromAuth,
    workspaceResolver = resolveActiveSessionWorkspace,
    legacyCompatibility = false,
  } = {}
) {
  const sessionPayload = await sessionLoader(request, auth);
  if (sessionPayload?.session || sessionPayload?.user || sessionPayload?.userId) {
    return createUserAuthContextFromSession(sessionPayload, { workspaceResolver });
  }

  if (legacyCompatibility) {
    return createLegacyAuthContextFromRequest(request);
  }

  return createAnonymousAuthContext();
}

export function assertSupportedAuthSubjectInput(input = {}) {
  rejectForbiddenSubjectType(input.type || input.subjectType || input.kind);
  return true;
}

export function createAuthContextFromSubject(input = {}) {
  assertSupportedAuthSubjectInput(input);
  const type = textOrNull(input.type || input.subjectType || input.kind);
  if (!type || type === AUTH_CONTEXT_SUBJECT_TYPES.ANONYMOUS) {
    return createAnonymousAuthContext();
  }
  if (type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY || type === 'legacy') {
    return createLegacyAuthContext({ legacyOwnerRef: input.legacyOwnerRef || input.ownerRef });
  }
  if (type === AUTH_CONTEXT_SUBJECT_TYPES.USER || type === 'human') {
    return authContext({
      subject: userSubject({ userId: input.userId, sessionId: input.sessionId }),
      session: input.session || null,
      workspace: input.workspace || null,
    });
  }
  if (type === AUTH_CONTEXT_SUBJECT_TYPES.SERVICE_ACCOUNT || type === 'service') {
    return createServiceAccountAuthContext(input);
  }
  throw new AuthContextError('Unsupported AuthContext subject type', {
    code: AUTH_CONTEXT_ERROR_CODES.UNSUPPORTED_SUBJECT,
    status: 403,
  });
}

export function requireAuthContextWorkspace(context) {
  if (!context?.workspace?.organizationId || context.workspace.isMember !== true) {
    throw new AuthContextError('AuthContext requires an active Workspace membership', {
      code: AUTH_CONTEXT_ERROR_CODES.WORKSPACE_REQUIRED,
      status: 403,
    });
  }
  return context.workspace;
}

export function requireAuthContextProject(context) {
  if (!context?.project?.projectId) {
    throw new AuthContextError('AuthContext requires a Project context', {
      code: AUTH_CONTEXT_ERROR_CODES.PROJECT_REQUIRED,
      status: 404,
    });
  }
  return context.project;
}

export async function resolveAuthContextProject(
  context,
  { projectId, project = null, projectMembershipService = defaultProjectMembershipService } = {}
) {
  const id = textOrNull(projectId || project?.projectId || project?.id);
  if (!id) {
    return context;
  }

  if (context?.subject?.type === AUTH_CONTEXT_SUBJECT_TYPES.LEGACY) {
    return authContext({
      ...context,
      project: {
        projectId: id,
        ownerRef: context.subject.legacyOwnerRef,
        compatibility: 'legacy-owner-ref-route',
      },
    });
  }

  requireAuthContextWorkspace(context);
  if (!context?.principal?.userId) {
    return authContext({ ...context, project: { projectId: id, organizationId: context.workspace.organizationId } });
  }

  const membership = projectMembershipService
    ? await projectMembershipService.get({
        projectId: id,
        organizationId: context.workspace.organizationId,
        userId: context.principal.userId,
      })
    : null;

  return authContext({
    ...context,
    project: {
      projectId: id,
      organizationId: membership?.organizationId || project?.organizationId || context.workspace.organizationId,
      role: membership?.role,
      isMember: Boolean(membership),
    },
  });
}

export function authContextAuthorizationInput(context, input = {}) {
  return {
    ...input,
    principal: context?.principal || null,
    workspace: input.workspace || context?.workspace || null,
    project: input.project || context?.project || null,
  };
}

export async function checkAuthContextPermission(context, permission, input = {}) {
  const authorizationInput = authContextAuthorizationInput(context, {
    ...input,
    permission,
  });
  const definition = getPermissionDefinition(permission);
  const resource = input.resource || null;
  const hasProjectScopedResource = Boolean(
    authorizationInput.project?.projectId ||
      resource?.projectId ||
      resource?.project?.projectId ||
      resource?.project?.id
  );
  const isProjectScopedWorkspaceOrProjectPermission = Boolean(
    definition?.scopeMode === 'workspace-or-project' && authorizationInput.project?.projectId
  );
  if (
    definition?.policyLayer === 'resource-inheritance' ||
    isProjectScopedWorkspaceOrProjectPermission ||
    ((input.resource || input.resourceId || input.resourceType) && hasProjectScopedResource)
  ) {
    return authorizeResourceInheritance(authorizationInput);
  }
  if (isProjectPolicyPermission(permission, authorizationInput)) {
    return authorizeProjectPolicy(authorizationInput);
  }
  return authorizeDynaxis(authorizationInput);
}

export async function assertAuthContextPermission(context, permission, input = {}) {
  const decision = await checkAuthContextPermission(context, permission, input);
  if (!decision.allowed) {
    throw new AuthContextError('AuthContext permission denied', {
      code: AUTH_CONTEXT_ERROR_CODES.PERMISSION_DENIED,
      status: decision.status || 403,
      decision,
    });
  }
  return decision;
}
