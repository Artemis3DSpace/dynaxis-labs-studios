import { z } from 'zod';
import { ACTIVITY_SEVERITIES, ActivitySeveritySchema } from './activity-contracts.js';

export const SIGNAL_CLASSIFICATIONS = /** @type {const} */ ([
  'operational',
  'anomaly',
  'risk',
  'opportunity',
  'milestone',
]);

export const SignalClassificationSchema = z.enum(SIGNAL_CLASSIFICATIONS);
export const SignalInputSeveritySchema = z.enum(ACTIVITY_SEVERITIES);

const defaultSeverityClassificationMap = Object.freeze({
  info: 'operational',
  notice: 'milestone',
  warning: 'anomaly',
  critical: 'risk',
});

/**
 * @param {unknown} value
 */
export function validateSignalClassification(value) {
  return SignalClassificationSchema.parse(value);
}

/**
 * Contract helper for deterministic phase-scaffold signal typing.
 *
 * @param {unknown} severity
 * @returns {'operational' | 'anomaly' | 'risk' | 'opportunity' | 'milestone'}
 */
export function classifySignalFromSeverity(severity) {
  const parsedSeverity = ActivitySeveritySchema.parse(severity);
  return defaultSeverityClassificationMap[parsedSeverity];
}
