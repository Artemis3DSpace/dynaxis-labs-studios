/**
 * Phase 6G — Design Agent → Composition bridge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetMemoryStore, getMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';
import { createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import {
  createCompositionFromAsset,
  updateCompositionDraft,
  exportComposition,
} from '../lib/dynaxis/services/compositions.js';
import {
  createDesignTemplate,
  generateTemplatePreview,
  instantiateDesignTemplate,
} from '../lib/dynaxis/services/templates.js';
import {
  applyDesignAgentOperations,
  planDesignChanges,
  prepareImageGeneration,
  attachGeneratedAsset,
  readDesignAgentContext,
  designAgentAdaptComposition,
} from '../lib/dynaxis/services/design-agent.js';
import {
  applyDesignOperations,
  parseDesignActionPlan,
  DESIGN_AGENT_MAX_OPERATIONS,
  DESIGN_AGENT_STALE_CODE,
} from '../lib/dynaxis/design-agent/operations.js';
import { COMPOSITION_DOCUMENT_VERSION } from '../lib/dynaxis/types.js';
import { renderCompositionSvg } from '../lib/dynaxis/compositions/svg-renderer.js';
import { readDataUrlBytes } from '../lib/dynaxis/compositions/asset-fetch.js';
import {
  resetAssetBlobStoreCache,
} from '../lib/dynaxis/storage/blob-store.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OWNER = ownerRefFromApiKey('test-design-agent-key');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function mockRasterize() {
  return async () => Buffer.from(readDataUrlBytes(TINY_PNG).bytes);
}

async function seed() {
  const project = await createProject(OWNER, { name: 'DA Proj' });
  const asset = await registerAsset(OWNER, {
    projectId: project.id,
    type: 'image',
    source: 'uploaded',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
  });
  const logo = await registerAsset(OWNER, {
    projectId: project.id,
    type: 'image',
    source: 'uploaded',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 256,
    height: 256,
  });
  const { composition } = await createCompositionFromAsset(OWNER, {
    assetId: asset.id,
    projectId: project.id,
    name: 'DA Comp',
  });
  const headlineId = randomUUID();
  const updated = await updateCompositionDraft(OWNER, composition.id, {
    documentVersion: composition.documentVersion,
    document: {
      version: COMPOSITION_DOCUMENT_VERSION,
      canvas: { width: 1080, height: 1080, transparent: false, backgroundColor: '#000000' },
      background: {
        kind: 'asset',
        assetId: asset.id,
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [
        {
          id: headlineId,
          type: 'text',
          role: 'headline',
          name: 'Headline',
          text: 'Hello World',
          x: 100,
          y: 100,
          width: 400,
          height: 80,
          zIndex: 1,
          fontSize: 48,
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          textAlign: 'left',
          locked: false,
          visible: true,
          opacity: 1,
          rotation: 0,
        },
      ],
    },
  });
  return { project, asset, logo, composition: updated.composition, headlineId };
}

test.beforeEach(() => {
  resetMemoryStore();
  resetAssetBlobStoreCache();
});

test('operation protocol: valid move + colour; locked/invalid rejected', () => {
  const layerId = randomUUID();
  const doc = {
    version: 1,
    canvas: { width: 1080, height: 1080, transparent: false },
    background: { kind: 'color', color: '#111111', fit: 'cover', position: 'middle-center', opacity: 1 },
    layers: [
      {
        id: layerId,
        type: 'text',
        text: 'Hi',
        x: 10,
        y: 10,
        width: 200,
        height: 40,
        zIndex: 1,
        fontSize: 24,
        fontFamily: 'system-ui, sans-serif',
        color: '#ffffff',
        locked: false,
        visible: true,
        opacity: 1,
        rotation: 0,
      },
    ],
  };
  const ok = applyDesignOperations(doc, [
    { type: 'move_layer', layerId, x: 40, y: 40 },
    { type: 'set_colour', layerId, color: '#ff0000' },
  ]);
  assert.equal(ok.document.layers[0].x, 40);
  assert.equal(ok.document.layers[0].color, '#ff0000');

  assert.throws(
    () =>
      applyDesignOperations(doc, [
        { type: 'set_locked', layerId, locked: true },
        { type: 'update_text', layerId, text: 'nope' },
      ]),
    /locked/i
  );

  assert.throws(
    () => applyDesignOperations(doc, [{ type: 'set_colour', layerId, color: '<script>' }]),
    /invalid|color/i
  );

  assert.throws(
    () =>
      applyDesignOperations(doc, [
        { type: 'update_text', layerId: randomUUID(), text: 'x' },
      ]),
    /not found/i
  );

  assert.throws(() => {
    const ops = Array.from({ length: DESIGN_AGENT_MAX_OPERATIONS + 1 }, () => ({
      type: 'list_layers',
    }));
    applyDesignOperations(doc, ops);
  }, /too many/i);
});

test('atomic batch: one invalid rejects whole batch; document unchanged', async () => {
  const { composition, headlineId } = await seed();
  const before = composition.document;
  await assert.rejects(
    () =>
      applyDesignAgentOperations(OWNER, {
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        operations: [
          { type: 'move_layer', layerId: headlineId, x: 20, y: 20 },
          { type: 'update_text', layerId: randomUUID(), text: 'bad' },
        ],
      }),
    /not found/i
  );
  const still = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(still.document.layers[0].x, before.layers[0].x);
  assert.equal(still.documentVersion, composition.documentVersion);
});

test('concurrency: stale agent plan cannot overwrite human edit', async () => {
  const { composition, headlineId } = await seed();
  const staleVersion = composition.documentVersion;
  await updateCompositionDraft(OWNER, composition.id, {
    documentVersion: staleVersion,
    document: {
      ...composition.document,
      layers: [{ ...composition.document.layers[0], text: 'Human edit' }],
    },
  });
  await assert.rejects(
    () =>
      applyDesignAgentOperations(OWNER, {
        compositionId: composition.id,
        documentVersion: staleVersion,
        operations: [{ type: 'update_text', layerId: headlineId, text: 'Agent' }],
      }),
    (err) => err.code === DESIGN_AGENT_STALE_CODE
  );
  const row = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(row.document.layers[0].text, 'Human edit');
});

test('planDesignChanges uses mocked LLM and returns validated plan', async () => {
  const { composition, headlineId } = await seed();
  const { plan } = await planDesignChanges(
    OWNER,
    {
      compositionId: composition.id,
      message: 'Move headline to top left',
      documentVersion: composition.documentVersion,
    },
    {
      llmExecutor: async () => ({
        reply: JSON.stringify({
          summary: 'Move headline',
          intent: 'layout',
          operations: [{ type: 'move_layer', layerId: headlineId, x: 48, y: 48 }],
          warnings: [],
          assumptions: [],
        }),
        provider: 'mock',
        model: 'mock',
      }),
    }
  );
  assert.equal(plan.operations[0].type, 'move_layer');
  parseDesignActionPlan(plan);
});

test('hallucinated Asset ID rejected', async () => {
  const { composition } = await seed();
  await assert.rejects(
    () =>
      applyDesignAgentOperations(OWNER, {
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        operations: [
          {
            type: 'add_image_layer',
            assetId: randomUUID(),
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
        allowedAssetIds: [],
      }),
    /not found|not approved|ASSET/i
  );
});

test('prepareImage + attachGeneratedAsset success; failed attach leaves doc', async () => {
  const { composition, project } = await seed();
  const prep = await prepareImageGeneration(OWNER, {
    compositionId: composition.id,
    prompt: 'luxury studio scene',
    target: 'background',
  });
  assert.ok(prep.generationRequest.prompt);
  assert.equal(prep.attachHint.target, 'background');

  const newAsset = await registerAsset(OWNER, {
    projectId: project.id,
    type: 'image',
    source: 'generated',
    url: TINY_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
  });

  const attached = await attachGeneratedAsset(OWNER, {
    compositionId: composition.id,
    documentVersion: composition.documentVersion,
    assetId: newAsset.id,
    target: 'background',
  });
  assert.equal(attached.composition.document.background.assetId, newAsset.id);

  // Failure path: wrong version leaves last good doc
  const version = attached.composition.documentVersion;
  await assert.rejects(() =>
    attachGeneratedAsset(OWNER, {
      compositionId: composition.id,
      documentVersion: version - 1,
      assetId: newAsset.id,
      target: 'background',
    })
  );
  const row = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(row.document.background.assetId, newAsset.id);
});

test('Design Agent adaptation reuses engine; source unchanged', async () => {
  const { composition } = await seed();
  const { composition: adapted, warnings } = await designAgentAdaptComposition(OWNER, {
    compositionId: composition.id,
    targetAspectRatio: '9:16',
  });
  assert.notEqual(adapted.id, composition.id);
  assert.equal(adapted.sourceCompositionId, composition.id);
  assert.ok(Array.isArray(warnings));
  const src = await getMemoryStore().getComposition(OWNER, composition.id);
  assert.equal(src.canvasWidth, composition.canvasWidth);
});

test('Template instantiate + agent edit does not mutate Template', async () => {
  const { project, asset, logo } = await seed();
  const headlineId = randomUUID();
  const { template, revision } = await createDesignTemplate(OWNER, {
    name: 'DA Tmpl',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false },
      background: {
        kind: 'asset',
        assetId: asset.id,
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [
        {
          id: headlineId,
          type: 'text',
          role: 'headline',
          text: 'T',
          x: 40,
          y: 40,
          width: 400,
          height: 80,
          zIndex: 1,
          fontSize: 40,
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
        },
      ],
      slots: [
        {
          id: randomUUID(),
          type: 'text',
          role: 'headline',
          required: true,
          targetLayerId: headlineId,
          defaultText: 'T',
        },
      ],
    },
  });
  const { composition } = await instantiateDesignTemplate(OWNER, {
    templateId: template.id,
    templateRevisionId: revision.id,
    projectId: project.id,
    binding: { projectId: project.id, headline: 'Bound HL' },
  });
  assert.equal(composition.templateId, template.id);

  await applyDesignAgentOperations(OWNER, {
    compositionId: composition.id,
    documentVersion: composition.documentVersion,
    operations: [{ type: 'update_text', layerId: headlineId, text: 'Agent HL' }],
    allowedAssetIds: [asset.id, logo.id],
  });

  const tmpl = await getMemoryStore().getDesignTemplateRevision(OWNER, revision.id);
  assert.equal(tmpl.document.layers[0].text, 'T');
});

test('colour-only Template preview renders without image Assets', async () => {
  const project = await createProject(OWNER, { name: 'Thumb' });
  const { template } = await createDesignTemplate(OWNER, {
    name: 'Colour only',
    document: {
      version: 1,
      canvas: { width: 1080, height: 1080, transparent: false, backgroundColor: '#112233' },
      background: {
        kind: 'color',
        color: '#334455',
        fit: 'cover',
        position: 'middle-center',
        opacity: 1,
      },
      layers: [
        {
          id: randomUUID(),
          type: 'text',
          text: 'No images',
          x: 100,
          y: 100,
          width: 400,
          height: 80,
          zIndex: 1,
          fontSize: 48,
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
        },
      ],
      slots: [],
    },
  });
  const { asset } = await generateTemplatePreview(OWNER, template.id, {
    projectId: project.id,
    rasterizeFn: mockRasterize(),
  });
  assert.ok(asset?.id);
});

test('rendering after Design Agent mutation includes updated text in SVG', async () => {
  const { composition, headlineId } = await seed();
  const { composition: next } = await applyDesignAgentOperations(OWNER, {
    compositionId: composition.id,
    documentVersion: composition.documentVersion,
    operations: [{ type: 'update_text', layerId: headlineId, text: 'SVG Check' }],
  });
  const svg = renderCompositionSvg(next.document, {});
  assert.ok(svg.includes('SVG Check'));

  const exported = await exportComposition(OWNER, next.id, {
    rasterizeFn: mockRasterize(),
  });
  assert.ok(exported.asset?.id);
});

test('DesignAgentStudio no longer sets localStorage.token or MuAPI balance auth', () => {
  const src = readFileSync(
    resolve(ROOT, 'packages/studio/src/components/DesignAgentStudio.jsx'),
    'utf8'
  );
  assert.ok(!src.includes('localStorage.setItem("token"'));
  assert.ok(!src.includes("localStorage.setItem('token'"));
  assert.ok(!src.includes('getUserBalance'));
  assert.ok(!src.includes("from 'design-agent'"));
  assert.ok(!src.includes('import { CreativeCanvas'));
  assert.ok(src.includes('Open in Creative Editor'));
});

test('context read exposes Brand colours without Character chat history', async () => {
  const { composition } = await seed();
  const ctx = await readDesignAgentContext(OWNER, composition.id);
  assert.equal(ctx.composition.compositionId, composition.id);
  assert.ok(ctx.capabilityKinds.write.includes('applyDesignOperations'));
  assert.ok(!JSON.stringify(ctx).includes('systemPrompt'));
});

test('cross-owner Composition rejected', async () => {
  const { composition, headlineId } = await seed();
  const other = ownerRefFromApiKey('other-da-key');
  await assert.rejects(
    () =>
      applyDesignAgentOperations(other, {
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        operations: [{ type: 'update_text', layerId: headlineId, text: 'x' }],
      }),
    /not found/i
  );
});
