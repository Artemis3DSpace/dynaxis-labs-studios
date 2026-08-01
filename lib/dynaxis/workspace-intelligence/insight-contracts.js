import { z } from 'zod';
import { ActivityVisibilitySchema } from './activity-contracts.js';
import { SignalClassificationSchema } from './signal-classification.js';

const isoTimestampSchema = z.string().datetime({ offset: true });

export const EvidenceReferenceSchema = z.object({
  eventId: z.string().trim().min(1),
  source: z.string().trim().min(1),
  reference: z.string().trim().min(1),
});

export const InsightProvenanceSchema = z.object({
  derivedFrom: z.string().trim().min(1),
  generatedAt: isoTimestampSchema,
  method: z.string().trim().min(1),
});

export const InsightCandidateSchema = z.object({
  id: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  classification: SignalClassificationSchema,
  visibility: ActivityVisibilitySchema.default('internal'),
  confidence: z.number().min(0).max(1).default(0.5),
  provenance: InsightProvenanceSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1),
  notes: z.string().trim().optional(),
});

export const IntelligenceValidationResultSchema = z.object({
  valid: z.boolean(),
  violations: z.array(z.string().trim().min(1)).default([]),
  redactedFields: z.array(z.string().trim().min(1)).default([]),
  contract: z.string().trim().min(1),
});

/**
 * @param {unknown} input
 */
export function validateInsightCandidate(input) {
  return InsightCandidateSchema.parse(input);
}

/**
 * @param {unknown} input
 */
export function validateIntelligenceValidationResult(input) {
  return IntelligenceValidationResultSchema.parse(input);
}
