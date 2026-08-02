import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createInMemoryJobPersistenceStore,
  JOB_EVENT_NAMES,
  JOB_STATES,
  mapJobEventForPersistence,
} from '../lib/dynaxis/jobs/index.js'

function createBaseJob(store, id) {
  return store.createJob({
    id,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.QUEUED,
    idempotencyKey: `job-${id}`,
  })
}

test('job event sequence is monotonic per job', () => {
  const store = createInMemoryJobPersistenceStore()
  const jobA = createBaseJob(store, '1df85a2b-d32a-42ce-a376-ce2f4a5626a9')
  const jobB = createBaseJob(store, 'fce363df-f74f-47f8-a4f1-c4b6c6528fef')

  const a1 = store.appendEvent({
    jobId: jobA.id,
    workspaceId: jobA.workspaceId,
    projectId: jobA.projectId,
    kind: JOB_EVENT_NAMES.CREATED,
    actorType: 'service',
    actorId: 'svc-generation',
    source: 'gateway',
    payload: { requestId: 'req-1' },
  })
  const a2 = store.appendEvent({
    jobId: jobA.id,
    workspaceId: jobA.workspaceId,
    projectId: jobA.projectId,
    kind: JOB_EVENT_NAMES.DISPATCHED,
    actorType: 'worker',
    actorId: 'worker-1',
    source: 'dispatcher',
    payload: { lease: 'lease-1' },
  })
  const b1 = store.appendEvent({
    jobId: jobB.id,
    workspaceId: jobB.workspaceId,
    projectId: jobB.projectId,
    kind: JOB_EVENT_NAMES.CREATED,
    actorType: 'service',
    actorId: 'svc-generation',
    source: 'gateway',
    payload: { requestId: 'req-2' },
  })
  const a3 = store.appendEvent({
    jobId: jobA.id,
    workspaceId: jobA.workspaceId,
    projectId: jobA.projectId,
    kind: JOB_EVENT_NAMES.PROVIDER_UPDATED,
    actorType: 'provider',
    actorId: 'muapi',
    source: 'webhook',
    payload: { providerJobId: 'provider-123' },
  })

  assert.deepEqual([a1.sequence, a2.sequence, a3.sequence], [1, 2, 3])
  assert.equal(b1.sequence, 1)
  assert.deepEqual(
    store.listEvents(jobA.id).map((event) => event.sequence),
    [1, 2, 3]
  )
})

test('event payload projection redacts secret-like keys before persistence', () => {
  const mapped = mapJobEventForPersistence({
    jobId: 'cb3578cc-f131-491a-a236-fe6d638230ca',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    kind: JOB_EVENT_NAMES.FAILED,
    actorType: 'provider',
    source: 'webhook',
    payload: {
      token: 'sensitive',
      nested: { secretRef: 'top-secret', safe: true },
    },
    correlation: {
      requestId: 'req-redact',
      providerJobId: 'provider-job-redact',
    },
    idempotencyKey: '  EVENT::FAILED  ',
  })

  assert.equal(mapped.payload.token, '[REDACTED]')
  assert.equal(mapped.payload.nested.secretRef, '[REDACTED]')
  assert.equal(mapped.payload.nested.safe, true)
  assert.equal(mapped.idempotencyKey, 'event::failed')
  assert.equal(mapped.correlation.providerJobId, 'provider-job-redact')
})

test('event vocabulary remains closed and rejects unknown kinds', () => {
  assert.throws(
    () =>
      mapJobEventForPersistence({
        jobId: '23d547e6-074f-4ff3-aa83-2975c50c30c1',
        workspaceId: '11111111-1111-4111-8111-111111111111',
        projectId: '22222222-2222-4222-8222-222222222222',
        kind: 'job.cancelling',
        actorType: 'system',
        source: 'reconciler',
        payload: {},
      }),
    /Unknown job event/
  )
})
