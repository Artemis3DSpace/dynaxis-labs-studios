/**
 * Phase 5B — Character domain + Character Studio Mini App tests.
 * MuAPI / LLM are mocked; no paid credits consumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../lib/dynaxis/db/memory-store.js';
import {
  createCharacter,
  updateCharacter,
  addCharacterAsset,
  promoteAssetToReference,
  linkCharacterToProject,
  listCharacterRevisions,
  getCharacter,
  buildCharacterSystemPrompt,
} from '../lib/dynaxis/services/characters.js';
import {
  startCharacterConversation,
  sendCharacterMessage,
} from '../lib/dynaxis/services/character-chat.js';
import { ensureDefaultProject, createProject } from '../lib/dynaxis/services/projects.js';
import { registerAsset } from '../lib/dynaxis/services/assets.js';
import { parseMiniAppManifest, validateManifestConsistency } from '../lib/dynaxis/mini-apps/manifest.js';
import { createMiniAppRegistry } from '../lib/dynaxis/mini-apps/registry.js';
import { createMiniAppRuntime, MiniAppPermissionError } from '../lib/dynaxis/mini-apps/runtime.js';
import { isApprovedLoaderKey } from '../lib/dynaxis/mini-apps/loader.js';
import { ASSET_SEMANTIC_ROLES, hasPermission } from '../lib/dynaxis/mini-apps/permissions.js';
import { filterCatalogueTemplates } from '../packages/studio/src/catalogue-dedupe.js';
import { characterStudioMiniAppManifest } from '../packages/mini-apps/character-studio/manifest.js';
import {
  validatePortraitRequest,
  buildPortraitGenerationRequest,
  generateCharacterPortrait,
  invokeCapability,
} from '../packages/mini-apps/character-studio/capability.js';
import { buildLlmPrompt, mockLlmChat } from '../lib/dynaxis/providers/llm.js';
import { CHARACTER_CONTINUITY_STRATEGY } from '../lib/dynaxis/types.js';
import { ownerRefFromApiKey } from '../lib/dynaxis/ownership.js';

const OWNER = ownerRefFromApiKey('test-character-key');
const OUT_A = 'https://cdn.muapi.ai/outputs/char-a.jpg';
const OUT_B = 'https://cdn.muapi.ai/outputs/char-b.jpg';
const REF_URL = 'https://cdn.muapi.ai/examples/ref.jpg';

function mockPlatformClient(overrides = {}) {
  const calls = { start: [], complete: [], fail: [] };
  return {
    calls,
    listProjects: async () => ({ projects: [] }),
    listAssets: async () => ({ assets: [] }),
    listGenerations: async () => ({ generations: [] }),
    getJob: async () => ({ job: null }),
    registerAsset: async (body) => ({ asset: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...body } }),
    listCharacters: async () => ({ characters: [] }),
    getCharacter: async () => ({ character: null }),
    createCharacter: async () => ({}),
    updateCharacter: async () => ({}),
    listCharacterAssets: async () => ({ assets: [] }),
    addCharacterAsset: async () => ({}),
    promoteCharacterAsset: async () => ({}),
    linkCharacterToProject: async () => ({}),
    listCharacterRevisions: async () => ({ revisions: [] }),
    startCharacterConversation: async () => ({}),
    sendCharacterMessage: async () => ({}),
    getCharacterConversation: async () => ({}),
    lifecycleStart: async (body) => {
      calls.start.push(body);
      return {
        generation: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          characterId: body.characterId || null,
          characterRevisionId: body.characterRevisionId || null,
          status: 'running',
        },
        job: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'running' },
        project: { id: body.projectId },
      };
    },
    lifecycleComplete: async (body) => {
      calls.complete.push(body);
      const urls = body.urls || [];
      return {
        generation: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'completed',
          characterId: calls.start[0]?.characterId,
          characterRevisionId: calls.start[0]?.characterRevisionId,
        },
        job: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'completed' },
        assets: urls.map((url, i) => ({
          id: `dddddddd-dddd-4ddd-8ddd-ddddddddddd${i}`,
          url,
          type: 'image',
        })),
      };
    },
    lifecycleFail: async (body) => {
      calls.fail.push(body);
      return {};
    },
    ...overrides,
  };
}

test('character studio manifest is valid with character permissions', () => {
  const m = parseMiniAppManifest(characterStudioMiniAppManifest);
  assert.equal(m.id, 'dynaxis.character-studio');
  assert.equal(m.status, 'integrated');
  assert.ok(m.permissions.includes('characters:read'));
  assert.ok(m.permissions.includes('characters:write'));
  assert.ok(!m.permissions.includes('external:network'));
  assert.ok(m.requiredCapabilities.includes('characters'));
  assert.equal(validateManifestConsistency(m).length, 0);
  assert.equal(isApprovedLoaderKey('dynaxis.character-studio'), true);
  assert.ok(ASSET_SEMANTIC_ROLES.includes('identity_reference'));
  assert.ok(ASSET_SEMANTIC_ROLES.includes('generated_portrait'));
});

test('catalogue dedupe hides external AI Character Studio card', () => {
  const templates = [
    { name: 'AI Character Studio', repo: 'https://github.com/SamurAIGPT/ai-character-studio' },
    { name: 'Nano Banana Studio', repo: 'https://github.com/SamurAIGPT/nano-banana-generator' },
  ];
  const filtered = filterCatalogueTemplates(templates, [characterStudioMiniAppManifest]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Nano Banana Studio');
});

test('character continuity strategy is reference-based', () => {
  assert.equal(CHARACTER_CONTINUITY_STRATEGY, 'reference-based');
});

test('character create, multi-ref assets, revisions, multi-project link', async () => {
  resetMemoryStore();
  const projectA = await ensureDefaultProject(OWNER);
  const projectB = await createProject(OWNER, { name: 'Film Project' });

  const created = await createCharacter(OWNER, {
    name: 'Aria',
    persona: 'Calm strategist',
    backstory: 'Born among the archives.',
    greeting: 'Hello, traveler.',
    category: 'Fantasy',
    projectId: projectA.id,
  });
  assert.equal(created.character.name, 'Aria');
  assert.ok(created.revision.id);
  assert.equal(created.character.currentRevisionId, created.revision.id);
  assert.equal(created.revision.snapshot.continuity, 'reference-based');

  const asset1 = await registerAsset(OWNER, {
    projectId: projectA.id,
    type: 'image',
    url: REF_URL,
    source: 'uploaded',
  });
  const asset2 = await registerAsset(OWNER, {
    projectId: projectA.id,
    type: 'image',
    url: 'https://cdn.muapi.ai/examples/ref2.jpg',
    source: 'uploaded',
  });

  await addCharacterAsset(OWNER, created.character.id, {
    assetId: asset1.id,
    role: 'identity_reference',
    isPrimary: true,
  });
  await addCharacterAsset(OWNER, created.character.id, {
    assetId: asset2.id,
    role: 'style_reference',
  });

  const withAssets = await getCharacter(OWNER, created.character.id, { includeAssets: true });
  assert.equal(withAssets.assets.length, 2);

  const beforeEdit = created.character.currentRevisionId;
  const updated = await updateCharacter(OWNER, created.character.id, {
    persona: 'Calm strategist with dry humour',
  });
  assert.notEqual(updated.revision.id, beforeEdit);
  assert.equal(updated.character.currentRevisionId, updated.revision.id);

  // Prior revision still exists (provenance preserved)
  const revisions = await listCharacterRevisions(OWNER, created.character.id);
  assert.ok(revisions.length >= 3);
  assert.ok(revisions.some((r) => r.id === beforeEdit));

  await linkCharacterToProject(OWNER, created.character.id, projectB.id);
  // Character is not duplicated — same id
  const again = await getCharacter(OWNER, created.character.id);
  assert.equal(again.id, created.character.id);

  // Promote a "generated" asset to identity reference
  const genAsset = await registerAsset(OWNER, {
    projectId: projectA.id,
    type: 'image',
    url: OUT_A,
    source: 'generated',
  });
  const promoted = await promoteAssetToReference(OWNER, created.character.id, genAsset.id, {
    isPrimary: true,
  });
  assert.equal(promoted.link.role, 'identity_reference');
  assert.equal(promoted.character.primaryAssetId, genAsset.id);
});

test('generation provenance records character + revision ids', async () => {
  resetMemoryStore();
  const project = await ensureDefaultProject(OWNER);
  const { character, revision } = await createCharacter(OWNER, {
    name: 'Kai',
    projectId: project.id,
  });

  const client = mockPlatformClient();
  const runtime = createMiniAppRuntime({
    manifest: parseMiniAppManifest(characterStudioMiniAppManifest),
    apiKey: 'test-key',
    getProjectContext: () => ({ projectId: project.id }),
    platformClient: {
      ...client,
      getCharacter: async () => ({ character }),
      listCharacterAssets: async () => ({ assets: [] }),
      addCharacterAsset: async () => ({}),
      linkCharacterToProject: async () => ({}),
      listAssets: async () => ({ assets: [] }),
    },
    executeGeneration: async () => ({ outputs: [OUT_A, OUT_B], request_id: 'mu-1' }),
  });

  // Override getCharacter on runtime path — use invoke via generateCharacterPortrait
  // Soft-stub: inject character via platform client already
  const outcome = await generateCharacterPortrait(runtime, {
    characterId: character.id,
    prompt: 'cinematic portrait',
    aspectRatio: '3:4',
    resolution: '2k',
  });

  assert.equal(outcome.executed, true);
  assert.equal(client.calls.start[0].characterId, character.id);
  assert.equal(client.calls.start[0].characterRevisionId, revision.id);
  assert.equal(client.calls.complete[0].urls.length, 2);
});

test('portrait validation and edit endpoint selection', () => {
  assert.throws(
    () => validatePortraitRequest({ category: 'x' }),
    (e) => e.code === 'CHARACTER_ID_REQUIRED'
  );
  const char = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test',
    currentRevisionId: '22222222-2222-4222-8222-222222222222',
  };
  const withRefs = buildPortraitGenerationRequest({
    character: char,
    prompt: 'noir',
    aspectRatio: '1:1',
    resolution: '1k',
    referenceUrls: [REF_URL],
    referenceAssets: [{ url: REF_URL, role: 'identity_reference' }],
  });
  assert.equal(withRefs.endpoint, 'nano-banana-pro-edit');
  assert.deepEqual(withRefs.parameters.images_list, [REF_URL]);

  const t2i = buildPortraitGenerationRequest({
    character: char,
    prompt: 'noir',
    aspectRatio: '1:1',
    resolution: '4k',
    referenceUrls: [],
    referenceAssets: [],
  });
  assert.equal(t2i.endpoint, 'nano-banana-pro');
  assert.equal(t2i.parameters.resolution, '4k');
});

test('character chat persists messages and uses system prompt', async () => {
  resetMemoryStore();
  await ensureDefaultProject(OWNER);
  const { character } = await createCharacter(OWNER, {
    name: 'Mira',
    persona: 'Witty cartographer',
    greeting: 'Maps ready.',
    systemPrompt: 'You are Mira, a witty cartographer.',
  });

  const started = await startCharacterConversation(OWNER, {
    characterId: character.id,
    includeGreeting: true,
  });
  assert.equal(started.messages[0].content, 'Maps ready.');
  assert.equal(started.messages[0].role, 'assistant');

  const sent = await sendCharacterMessage(
    OWNER,
    started.conversation.id,
    { content: 'Where is the northern pass?' },
    {
      llmExecutor: async (req) => {
        assert.ok(req.systemPrompt.includes('Mira'));
        assert.ok(buildLlmPrompt(req).includes('northern pass'));
        return mockLlmChat(req);
      },
    }
  );
  assert.equal(sent.userMessage.role, 'user');
  assert.equal(sent.assistantMessage.role, 'assistant');
  assert.ok(sent.assistantMessage.content.length > 0);
  assert.equal(sent.systemPromptRevisionId, character.currentRevisionId);
});

test('buildCharacterSystemPrompt falls back to persona fields', () => {
  const prompt = buildCharacterSystemPrompt({
    name: 'Rex',
    persona: 'Gruff mentor',
    backstory: 'Ex-pilot',
    systemPrompt: null,
  });
  assert.ok(prompt.includes('Rex'));
  assert.ok(prompt.includes('Gruff mentor'));
});

test('character permissions deny without grants', async () => {
  const limited = parseMiniAppManifest({
    ...characterStudioMiniAppManifest,
    id: 'dynaxis.character-studio.limited',
    entryKey: 'dynaxis.character-studio.limited',
    permissions: ['project:read'],
    requiresGenerationAccess: false,
    requiresAssetWrite: false,
  });
  const runtime = createMiniAppRuntime({
    manifest: limited,
    apiKey: 'k',
    getProjectContext: () => ({ projectId: null }),
    platformClient: mockPlatformClient(),
  });
  await assert.rejects(() => runtime.listCharacters(), MiniAppPermissionError);
  assert.equal(hasPermission(limited.permissions, 'characters:write'), false);
});

test('registry lists character studio as user-visible', () => {
  const reg = createMiniAppRegistry();
  reg.register(characterStudioMiniAppManifest);
  assert.ok(reg.listUserVisible().some((m) => m.id === 'dynaxis.character-studio'));
});

test('invokeCapability dispatches create and list helpers', async () => {
  const runtime = {
    createCharacter: async (args) => ({ character: { id: 'x', ...args } }),
  };
  const result = await invokeCapability('createCharacter', { name: 'Zed' }, runtime);
  assert.equal(result.character.name, 'Zed');
  const ratios = await invokeCapability('listAspectRatios', {}, runtime);
  assert.ok(ratios.aspectRatios.includes('1:1'));
});
