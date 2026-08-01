import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComposerSequence } from '../lib/dynaxis/composer/sequence.js';

function buildFixture() {
  return {
    version: 1,
    sequenceId: 'a74f4efd-c768-4a7e-95ee-4ad948f6e149',
    projectId: 'fd4d7ee4-edf9-4e57-8c1d-329fa80ff6a3',
    title: 'Composer Sequence Fixture',
    timeline: {
      frameRate: 30,
      durationMs: 12_000,
      tracks: [
        {
          id: 'c97fbcf9-cfaa-4a17-a07b-cf25c83fe66c',
          name: 'Video Main',
          kind: 'video',
          allowOverlaps: false,
          clips: [
            {
              id: '820fa595-4e20-40c5-b70f-a910619f14c7',
              trackId: 'c97fbcf9-cfaa-4a17-a07b-cf25c83fe66c',
              kind: 'media',
              startMs: 0,
              durationMs: 3_000,
              trimInMs: 100,
              trimOutMs: 200,
              mediaRef: {
                mediaId: '40f511ef-8394-4bc3-a8a1-db6b065492d8',
                mediaType: 'video',
                locator: 'asset://40f511ef-8394-4bc3-a8a1-db6b065492d8',
                provenance: {
                  source: 'asset_import',
                  sourceId: 'asset-row',
                  capturedAt: '2026-08-01T12:30:00.000Z',
                  capturedBy: 'system',
                },
              },
            },
          ],
        },
      ],
    },
    effectStacks: {},
    renderGraph: {
      nodes: [
        {
          id: '6f2a04ee-185f-4adf-a016-9dabf8ca9c45',
          kind: 'source',
          clipId: '820fa595-4e20-40c5-b70f-a910619f14c7',
        },
        {
          id: '93ce6ec6-c09c-4fc6-9fbd-2419e5f74c8d',
          kind: 'export',
        },
      ],
      edges: [
        {
          id: '93713645-5934-4e96-a95a-c51902f958ca',
          from: '6f2a04ee-185f-4adf-a016-9dabf8ca9c45',
          to: '93ce6ec6-c09c-4fc6-9fbd-2419e5f74c8d',
        },
      ],
    },
    exportTargets: [
      {
        id: '27a1fcde-3f13-4819-8d59-7261ec855aac',
        type: 'video_file',
        container: 'mp4',
        width: 1920,
        height: 1080,
        frameRate: 30,
      },
    ],
  };
}

test('valid sequence passes', () => {
  const sequence = validateComposerSequence(buildFixture());
  assert.equal(sequence.timeline.tracks.length, 1);
  assert.equal(sequence.exportTargets[0].container, 'mp4');
});

test('overlapping clips detected where track rules forbid it', () => {
  const fixture = buildFixture();
  fixture.timeline.tracks[0].clips.push({
    id: '3f818d7a-c5d4-4f1f-987f-6e89d7595512',
    trackId: fixture.timeline.tracks[0].id,
    kind: 'gap',
    startMs: 2_500,
    durationMs: 500,
  });
  assert.throws(() => validateComposerSequence(fixture), /overlapping clips are forbidden/);
});

test('invalid clip timing fails', () => {
  const fixture = buildFixture();
  fixture.timeline.tracks[0].clips[0].durationMs = 100;
  fixture.timeline.tracks[0].clips[0].trimInMs = 100;
  fixture.timeline.tracks[0].clips[0].trimOutMs = 1;
  assert.throws(() => validateComposerSequence(fixture), /must exceed trimInMs \+ trimOutMs/);
});

test('media reference must include provenance', () => {
  const fixture = buildFixture();
  delete fixture.timeline.tracks[0].clips[0].mediaRef.provenance;
  assert.throws(() => validateComposerSequence(fixture), /provenance/);
});

test('export target validation works', () => {
  const fixture = buildFixture();
  fixture.exportTargets = [
    {
      id: '90b5d352-cfc8-4b22-89f0-2f4f09f41575',
      type: 'audio_file',
      container: 'mp4',
      audioSampleRate: 48_000,
    },
  ];
  assert.throws(() => validateComposerSequence(fixture), /audio_file export targets must use wav or aac/);
});

test('generative block cannot contain raw ProviderConnection secrets', () => {
  const fixture = buildFixture();
  fixture.timeline.tracks[0].clips = [
    {
      id: 'a9a91c8b-c2e3-4d95-9160-fef9f9b79cfe',
      trackId: fixture.timeline.tracks[0].id,
      kind: 'generative',
      startMs: 0,
      durationMs: 1500,
      trimInMs: 0,
      trimOutMs: 0,
      generativeBlock: {
        blockId: 'd8175cb7-9e17-4f6f-b2d8-cc3ca39031bc',
        prompt: 'cinematic shot',
        referenceMediaIds: [],
        params: {
          providerConnectionSecret: 'Bearer very-secret-token',
        },
        provenance: {
          source: 'generated',
          sourceId: 'gen-1',
          capturedAt: '2026-08-01T12:30:00.000Z',
          capturedBy: 'system',
        },
      },
    },
  ];
  assert.throws(() => validateComposerSequence(fixture), /forbidden secret-bearing\/provider-connection fields/);
});
