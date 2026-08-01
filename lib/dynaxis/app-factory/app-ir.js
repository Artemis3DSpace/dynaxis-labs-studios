import { APP_IR_VERSION_V0 } from './app-ir-versioning.js';

export const APP_IR_V0_FIELD_KEYS = Object.freeze([
  'appId',
  'name',
  'version',
  'pages',
  'routes',
  'dataSources',
  'components',
  'actions',
  'capabilities',
  'permissions',
  'assets',
  'environmentVariables',
  'buildTargets',
  'verificationState',
  'provenance',
]);

export function createEmptyAppIr({ appId, name, version = APP_IR_VERSION_V0 } = {}) {
  return {
    appId: appId || '',
    name: name || '',
    version,
    pages: [],
    routes: [],
    dataSources: [],
    components: [],
    actions: [],
    capabilities: [],
    permissions: [],
    assets: [],
    environmentVariables: [],
    buildTargets: [],
    verificationState: { stage: 'EXPERIMENTAL' },
    provenance: {},
  };
}
