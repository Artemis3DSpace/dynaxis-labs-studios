import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyAppIr, validateAppIr } from '../lib/dynaxis/app-factory/index.js';

function buildValidIr() {
  return {
    ...createEmptyAppIr({
      appId: 'app_01',
      name: 'Phase 8A Demo',
    }),
    pages: [{ id: 'page-home', name: 'Home' }],
    routes: [{ id: 'route-home', path: '/', pageId: 'page-home' }],
    dataSources: [{ id: 'ds-main', kind: 'rest' }],
    components: [
      {
        id: 'cmp-hero',
        kind: 'Hero',
        generated: true,
        provenance: { source: 'blueprint', revision: 'r1' },
      },
    ],
    actions: [{ id: 'act-submit', capabilityId: 'cap.submit.form' }],
    capabilities: ['cap.submit.form'],
    permissions: ['project:read'],
    assets: [{ id: 'asset-logo', type: 'image' }],
    environmentVariables: [{ key: 'API_BASE_URL', valueTemplate: 'https://example.test' }],
    buildTargets: [{ id: 'web', runtime: 'node' }],
    verificationState: { stage: 'EXPERIMENTAL' },
    provenance: { createdBy: 'wp-8a-scaffold' },
  };
}

test('valid App IR passes', () => {
  const result = validateAppIr(buildValidIr());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('missing version fails', () => {
  const ir = buildValidIr();
  delete ir.version;
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'version'));
});

test('invalid route fails', () => {
  const ir = buildValidIr();
  ir.routes[0].path = 'not-slash-prefixed';
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'routes[0].path'));
});

test('component without id fails', () => {
  const ir = buildValidIr();
  ir.components = [{ kind: 'Card' }];
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'components[0].id'));
});

test('action without capability fails', () => {
  const ir = buildValidIr();
  ir.actions = [{ id: 'act-missing-capability' }];
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'actions[0]'));
});

test('environment variable with raw secret value fails', () => {
  const ir = buildValidIr();
  ir.environmentVariables = [{ key: 'OPENAI_API_KEY', value: 'sk-live-raw-secret' }];
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'environmentVariables[0].value'));
});

test('provenance required for generated components', () => {
  const ir = buildValidIr();
  ir.components = [{ id: 'cmp-generated', generated: true }];
  const result = validateAppIr(ir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'components[0].provenance'));
});
