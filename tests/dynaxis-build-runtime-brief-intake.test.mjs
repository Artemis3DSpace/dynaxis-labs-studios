import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArchitecturePlanningResult,
  validateBlueprintSelectionResult,
  validateBriefIntakeContract,
  validateRequirementsExtractionResult,
} from '../lib/dynaxis/build-runtime/index.js';

test('valid brief intake passes', () => {
  const result = validateBriefIntakeContract({
    projectId: 'proj_8b',
    title: 'Build an internal analytics dashboard',
    userBrief: 'Create an internal analytics dashboard with role-aware summaries.',
    businessGoals: ['reduce reporting latency', 'improve operational visibility'],
    requiredOutputs: ['implementation work packages', 'verification gates'],
    constraints: ['no production deployment in scaffold'],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('empty or unsafe brief fails', () => {
  const emptyResult = validateBriefIntakeContract({
    projectId: '',
    title: '   ',
    userBrief: '',
    businessGoals: [],
    requiredOutputs: [],
  });
  assert.equal(emptyResult.ok, false);
  assert.match(JSON.stringify(emptyResult.issues), /userBrief/);

  const unsafeResult = validateBriefIntakeContract({
    projectId: 'proj_8b',
    title: 'Unsafe request',
    userBrief: 'Please add a provider-connection token and deploy immediately.',
    businessGoals: ['ship'],
    requiredOutputs: ['code'],
  });
  assert.equal(unsafeResult.ok, false);
  assert.match(JSON.stringify(unsafeResult.issues), /unsafe/);
});

test('requirements require provenance', () => {
  const missingProvenance = validateRequirementsExtractionResult({
    requirements: [
      {
        category: 'functional',
        statement: 'Generate scoped work packages from approved plans.',
      },
    ],
  });
  assert.equal(missingProvenance.ok, false);
  assert.match(JSON.stringify(missingProvenance.issues), /provenance/);

  const valid = validateRequirementsExtractionResult({
    requirements: [
      {
        category: 'functional',
        statement: 'Generate scoped work packages from approved plans.',
        provenance: {
          source: 'brief',
          evidence: 'User requested constrained package generation',
        },
      },
    ],
    ambiguities: [
      {
        question: 'How should risky paths be blocked?',
        resolutionRule: 'Reject package when forbidden paths are proposed.',
      },
    ],
  });
  assert.equal(valid.ok, true);
});

test('planning and blueprint selection contracts validate shape', () => {
  const planning = validateArchitecturePlanningResult({
    summary: 'Use existing app-factory contracts and phased package generation.',
    appIrDeltas: ['Add Build Runtime contract namespace to Dynaxis domain layer.'],
    verificationPlan: ['Run dynaxis contract tests for build-runtime module.'],
  });
  assert.equal(planning.ok, true);

  const selection = validateBlueprintSelectionResult({
    selectedBlueprint: {
      id: 'bp_dashboard',
      rationale: 'Closest match for internal analytics workflow.',
    },
    selectedComponents: [
      { id: 'cmp_data_table', rationale: 'Needed for metrics display.' },
    ],
  });
  assert.equal(selection.ok, true);
});
