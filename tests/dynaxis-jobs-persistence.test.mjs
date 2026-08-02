import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  assertWorkerProviderConnectionBlocked,
  JOB_ENGINE_ERROR_CODES,
  JOB_STATES,
  TERMINAL_JOB_STATES,
  WORKER_PROVIDER_CONNECTION_POLICY,
  createInMemoryJobPersistenceStore,
  dynaxisJobRecords,
  DYNAXIS_JOB_DRIZZLE_SCHEMA,
  mapJobRecordForPersistence,
} from '../lib/dynaxis/jobs/index.js'
import { DRIZZLE_SCHEMA } from '../lib/dynaxis/db/client.js'

const ROOT = new URL('..', import.meta.url)

function source(path) {
  return readFileSync(new URL(path, ROOT), 'utf8')
}

function listFilesRecursive(dir) {
  const entries = readdirSync(new URL(dir, ROOT), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const next = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(next))
      continue
    }
    files.push(next)
  }
  return files
}

const MIGRATION = source('drizzle/0016_phase_7e_4_job_persistence.sql')
const JOURNAL = JSON.parse(source('drizzle/meta/_journal.json'))

test('WP-7E-04 migration 0016 exists and is registered in drizzle journal', () => {
  assert.equal(existsSync(new URL('drizzle/0016_phase_7e_4_job_persistence.sql', ROOT)), true)
  assert.equal((MIGRATION.match(/CREATE TABLE "dynaxis_job_records"/g) || []).length, 1)
  assert.equal((MIGRATION.match(/CREATE TABLE "dynaxis_job_events"/g) || []).length, 1)

  const entry = JOURNAL.entries.find((item) => item.tag === '0016_phase_7e_4_job_persistence')
  assert.ok(entry, 'journal must register migration 0016')
  assert.equal(entry.idx, 16)
  assert.equal(JOURNAL.entries.at(-1).tag, '0016_phase_7e_4_job_persistence')
})

test('WP-7E-04 exports job persistence tables through canonical Drizzle schema', () => {
  assert.equal(getTableName(dynaxisJobRecords), 'dynaxis_job_records')
  assert.ok('dynaxisJobRecords' in DYNAXIS_JOB_DRIZZLE_SCHEMA)
  assert.ok('dynaxisJobEvents' in DYNAXIS_JOB_DRIZZLE_SCHEMA)
  assert.ok('dynaxisJobRecords' in DRIZZLE_SCHEMA)
  assert.ok('dynaxisJobEvents' in DRIZZLE_SCHEMA)
})

test('job record schema includes canonical state, idempotency boundary, and optimistic versioning', () => {
  const columns = getTableColumns(dynaxisJobRecords)
  for (const name of [
    'id',
    'workspace_id',
    'project_id',
    'job_kind',
    'state',
    'idempotency_key',
    'attempt_count',
    'max_attempts',
    'cancel_requested_at',
    'timeout_at',
    'failure_kind',
    'terminal_state_at',
    'version',
    'created_at',
    'updated_at',
  ]) {
    assert.ok(
      Object.values(columns).some((column) => column.name === name),
      `missing job record column ${name}`
    )
  }

  const config = getTableConfig(dynaxisJobRecords)
  const indexNames = config.indexes.map((idx) => idx.config.name)
  assert.ok(indexNames.includes('dynaxis_job_records_idempotency_boundary_uidx'))
  assert.ok(indexNames.includes('dynaxis_job_records_provider_lookup_idx'))
  assert.ok(indexNames.includes('dynaxis_job_records_workspace_state_idx'))
})

test('D1 and D2 are preserved in persistence vocabulary', () => {
  assert.deepEqual(TERMINAL_JOB_STATES, ['completed', 'failed', 'cancelled'])
  assert.equal(TERMINAL_JOB_STATES.includes(JOB_STATES.TIMED_OUT), false)
  assert.equal(Object.values(JOB_STATES).includes('cancelling'), false)

  const timedOut = mapJobRecordForPersistence({
    id: 'f0195e5a-b4ee-4f11-8af7-24e6dc6d059f',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.TIMED_OUT,
    idempotencyKey: '  Request::Timed Out  ',
  })
  assert.equal(timedOut.state, JOB_STATES.TIMED_OUT)
  assert.equal(timedOut.terminalStateAt, null)
  assert.equal(timedOut.idempotencyKey, 'request::timed-out')

  assert.throws(
    () =>
      mapJobRecordForPersistence({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        projectId: '22222222-2222-4222-8222-222222222222',
        jobKind: 'generation',
        state: 'cancelling',
        idempotencyKey: 'x',
      }),
    /cancelling/
  )
})

test('job record metadata, failureMetadata, and providerCorrelation are recursively redacted', () => {
  const mapped = mapJobRecordForPersistence({
    id: '3037b287-6f10-4fcb-a7d6-cf9ff65ffbb6',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.RUNNING,
    idempotencyKey: 'job-redaction',
    metadata: {
      apiKey: 'raw-value',
      nested: {
        accessToken: 'access-value',
        safe: 'ok',
      },
    },
    failureMetadata: {
      provider: {
        secretRef: 'secret-ref',
        token: 'provider-token',
      },
      errorCode: 'E_FAIL',
    },
    providerCorrelation: {
      providerJobId: 'provider-job',
      oauth: {
        refreshToken: 'refresh-value',
      },
    },
  })

  assert.equal(mapped.metadata.apiKey, '[REDACTED]')
  assert.equal(mapped.metadata.nested.accessToken, '[REDACTED]')
  assert.equal(mapped.metadata.nested.safe, 'ok')
  assert.equal(mapped.failureMetadata.provider.secretRef, '[REDACTED]')
  assert.equal(mapped.failureMetadata.provider.token, '[REDACTED]')
  assert.equal(mapped.failureMetadata.errorCode, 'E_FAIL')
  assert.equal(mapped.providerCorrelation.oauth, '[REDACTED]')
})

test('failureMessage is bounded before persistence', () => {
  const longFailure = 'x'.repeat(5000)
  const mapped = mapJobRecordForPersistence({
    id: '6d378bbc-dbf4-4c95-8c23-8ce64b8f89fd',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.FAILED,
    idempotencyKey: 'job-failure-message',
    failureMessage: longFailure,
  })

  assert.equal(mapped.failureMessage.length, 1024)
  assert.equal(mapped.failureMessage, longFailure.slice(0, 1024))
})

test('idempotency key normalization and persistence boundary are enforced', () => {
  const store = createInMemoryJobPersistenceStore()
  const first = store.createJob({
    id: '1eb5f95d-fccd-4b09-b2a0-0554b7486541',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.QUEUED,
    idempotencyKey: '  REQUEST::Create   Generation  ',
  })
  const duplicate = store.createJob({
    id: '9402cf36-dde9-44c8-8bdd-5607f6ac8fdb',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    jobKind: 'generation',
    state: JOB_STATES.QUEUED,
    idempotencyKey: 'request::create-generation',
  })

  assert.equal(first.id, duplicate.id)
  assert.equal(first.idempotencyKey, 'request::create-generation')
})

test('ProviderConnection worker use remains blocked by R1 guard', () => {
  assert.equal(WORKER_PROVIDER_CONNECTION_POLICY.status, 'blocked')
  assert.throws(
    () => assertWorkerProviderConnectionBlocked(),
    (error) => error?.code === JOB_ENGINE_ERROR_CODES.WORKER_PROVIDER_CONNECTION_BLOCKED
  )
})

test('jobs persistence modules do not import ProviderConnection, secrets, queue, workers, providers, or OAuth', () => {
  const persistenceFiles = [
    'lib/dynaxis/jobs/persistence.js',
    'lib/dynaxis/jobs/schema-mapping.js',
    'lib/dynaxis/jobs/schema.js',
    'lib/dynaxis/jobs/store.js',
  ]
  const merged = persistenceFiles.map((file) => source(file)).join('\n')

  assert.doesNotMatch(merged, /provider-connections|ProviderConnection/)
  assert.doesNotMatch(merged, /lib\/dynaxis\/secrets|\/secrets\//)
  assert.doesNotMatch(merged, /lib\/dynaxis\/providers|provider adapter|adapter runtime/i)
  assert.doesNotMatch(merged, /oauth2|redirect_uri|refreshAccessToken/i)
})

test('job persistence package adds no queue-dispatch or worker-runtime modules', () => {
  const files = listFilesRecursive('lib/dynaxis/jobs').map((file) => file.replace(/^lib\/dynaxis\/jobs\//, ''))
  const forbiddenNames = [/dispatch/i, /dispatcher/i, /queue/i, /worker/i, /adapter/i]

  for (const file of files) {
    if (['README.md', 'contracts.js'].includes(file)) {
      continue
    }
    for (const pattern of forbiddenNames) {
      assert.equal(pattern.test(file), false, `unexpected runtime module "${file}" matched ${pattern}`)
    }
  }
})
