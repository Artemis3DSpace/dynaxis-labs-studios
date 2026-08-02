import { randomUUID } from 'node:crypto';
import { mapJobEventForPersistence, mapJobRecordForPersistence } from './schema-mapping.js';

function keyForIdempotency(record) {
  return `${record.workspaceId}::${record.projectId}::${record.jobKind}::${record.idempotencyKey}`;
}

export function createInMemoryJobPersistenceStore() {
  /** @type {Map<string, any>} */
  const jobs = new Map();
  /** @type {Map<string, any[]>} */
  const eventsByJob = new Map();
  /** @type {Map<string, string>} */
  const idempotencyIndex = new Map();

  return {
    createJob(input) {
      const mapped = mapJobRecordForPersistence({
        ...input,
        id: input.id || randomUUID(),
        attemptCount: input.attemptCount ?? 0,
        maxAttempts: input.maxAttempts ?? 1,
        version: input.version ?? 1,
        createdAt: input.createdAt || new Date(),
        updatedAt: input.updatedAt || new Date(),
      });

      const indexKey = keyForIdempotency(mapped);
      const existingJobId = idempotencyIndex.get(indexKey);
      if (existingJobId) {
        return jobs.get(existingJobId);
      }

      jobs.set(mapped.id, mapped);
      idempotencyIndex.set(indexKey, mapped.id);
      return mapped;
    },

    getJob(jobId) {
      return jobs.get(jobId) || null;
    },

    appendEvent(input) {
      const mapped = mapJobEventForPersistence({
        ...input,
        id: input.id || randomUUID(),
      });
      const events = eventsByJob.get(mapped.jobId) || [];
      const nextSequence = events.length + 1;
      const event = {
        ...mapped,
        sequence: nextSequence,
        createdAt: input.createdAt || new Date(),
      };
      events.push(event);
      eventsByJob.set(mapped.jobId, events);
      return event;
    },

    listEvents(jobId) {
      return [...(eventsByJob.get(jobId) || [])];
    },
  };
}
