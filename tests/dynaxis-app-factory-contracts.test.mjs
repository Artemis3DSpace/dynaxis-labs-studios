import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_IR_VERSION_V0,
  exportAppFactoryPackage,
  isAppIrVersionCompatible,
  isSupportedAppIrVersion,
} from '../lib/dynaxis/app-factory/index.js';

test('package export strips runtime-only/internal fields', () => {
  const exported = exportAppFactoryPackage({
    appId: 'app_01',
    _internal: { trace: true },
    pages: [{ id: 'page-home', _runtime: { cache: true } }],
    components: [{ id: 'cmp-hero', runtimeHints: { provider: 'local' } }],
    verificationState: { stage: 'EXPERIMENTAL', workerHints: { queue: 'local' } },
  });

  assert.deepEqual(exported, {
    appId: 'app_01',
    pages: [{ id: 'page-home' }],
    components: [{ id: 'cmp-hero' }],
    verificationState: { stage: 'EXPERIMENTAL' },
  });
});

test('version compatibility helper works', () => {
  assert.equal(APP_IR_VERSION_V0, '0.0.0');
  assert.equal(isSupportedAppIrVersion('0.0.0'), true);
  assert.equal(isSupportedAppIrVersion('0.0.7'), true);
  assert.equal(isSupportedAppIrVersion('0.1.0'), false);
  assert.equal(isSupportedAppIrVersion('1.0.0'), false);

  assert.equal(isAppIrVersionCompatible('0.0.9', APP_IR_VERSION_V0), true);
  assert.equal(isAppIrVersionCompatible('0.1.0', APP_IR_VERSION_V0), false);
  assert.equal(isAppIrVersionCompatible('1.0.0', APP_IR_VERSION_V0), false);
});
