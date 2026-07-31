export {
  fetchWorkspaceProjectDetail,
  fetchWorkspaceProjects,
  normalizeProjectListFilters,
  sessionArchiveProject,
  sessionCreateProject,
  sessionGetProject,
  sessionListProjects,
  sessionUpdateProject,
} from './api.js';

export {
  invalidateProjectCatalogQueries,
  invalidateProjectDetailQuery,
  invalidateProjectMutationQueries,
} from './invalidation.js';

export {
  filterProjectsForWorkspace,
  isProjectInWorkspace,
  resolvePreferredProject,
} from './selection.js';

export {
  useArchiveProjectMutation,
  useCreateProjectMutation,
  useEnsureDefaultProject,
  useProjectDetail,
  useProjectsList,
  useUpdateProjectMutation,
} from './hooks.jsx';

export { ProjectSessionBridge } from './ProjectSessionBridge.jsx';
