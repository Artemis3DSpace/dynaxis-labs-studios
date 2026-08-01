export const BUILD_RUNTIME_REQUIREMENT_CATEGORIES = Object.freeze([
  'functional',
  'nonfunctional',
  'security',
  'data',
  'integration',
  'deployment',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasRequirementProvenance(requirement) {
  if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
    return false;
  }
  const provenance = requirement.provenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    return false;
  }
  return isNonEmptyString(provenance.source) && isNonEmptyString(provenance.evidence);
}

export function validateRequirementsExtractionResult(result) {
  const issues = [];

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    issues.push({ path: '$', message: 'requirements extraction result must be an object' });
    return { ok: false, issues };
  }

  if (!Array.isArray(result.requirements) || result.requirements.length === 0) {
    issues.push({ path: 'requirements', message: 'requirements must contain at least one item' });
  } else {
    result.requirements.forEach((requirement, index) => {
      if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
        issues.push({
          path: `requirements[${index}]`,
          message: 'requirement must be an object',
        });
        return;
      }

      if (!BUILD_RUNTIME_REQUIREMENT_CATEGORIES.includes(requirement.category)) {
        issues.push({
          path: `requirements[${index}].category`,
          message: 'category must use supported requirement vocabulary',
        });
      }
      if (!isNonEmptyString(requirement.statement)) {
        issues.push({
          path: `requirements[${index}].statement`,
          message: 'statement is required',
        });
      }
      if (!hasRequirementProvenance(requirement)) {
        issues.push({
          path: `requirements[${index}].provenance`,
          message: 'provenance.source and provenance.evidence are required',
        });
      }
    });
  }

  if (
    result.ambiguities !== undefined &&
    (!Array.isArray(result.ambiguities) ||
      result.ambiguities.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          !isNonEmptyString(item.question) ||
          !isNonEmptyString(item.resolutionRule)
      ))
  ) {
    issues.push({
      path: 'ambiguities',
      message: 'ambiguities must be an array of {question, resolutionRule} objects',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
