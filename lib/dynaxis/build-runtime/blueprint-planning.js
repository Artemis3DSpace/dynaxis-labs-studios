function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

export function validateArchitecturePlanningResult(result) {
  const issues = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    issues.push({ path: '$', message: 'architecture planning result must be an object' });
    return { ok: false, issues };
  }

  if (!isNonEmptyString(result.summary)) {
    issues.push({ path: 'summary', message: 'summary is required' });
  }
  if (!isStringArray(result.appIrDeltas) || result.appIrDeltas.length === 0) {
    issues.push({
      path: 'appIrDeltas',
      message: 'appIrDeltas must include at least one App IR delta statement',
    });
  }
  if (!isStringArray(result.verificationPlan) || result.verificationPlan.length === 0) {
    issues.push({
      path: 'verificationPlan',
      message: 'verificationPlan must include at least one verification step',
    });
  }

  return { ok: issues.length === 0, issues };
}

export function validateBlueprintSelectionResult(result) {
  const issues = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    issues.push({ path: '$', message: 'blueprint selection result must be an object' });
    return { ok: false, issues };
  }

  if (!result.selectedBlueprint || typeof result.selectedBlueprint !== 'object') {
    issues.push({
      path: 'selectedBlueprint',
      message: 'selectedBlueprint object is required',
    });
  } else {
    if (!isNonEmptyString(result.selectedBlueprint.id)) {
      issues.push({
        path: 'selectedBlueprint.id',
        message: 'selected blueprint id is required',
      });
    }
    if (!isNonEmptyString(result.selectedBlueprint.rationale)) {
      issues.push({
        path: 'selectedBlueprint.rationale',
        message: 'selected blueprint rationale is required',
      });
    }
  }

  if (!Array.isArray(result.selectedComponents) || result.selectedComponents.length === 0) {
    issues.push({
      path: 'selectedComponents',
      message: 'selectedComponents must include at least one component choice',
    });
  } else {
    result.selectedComponents.forEach((component, index) => {
      if (!component || typeof component !== 'object') {
        issues.push({
          path: `selectedComponents[${index}]`,
          message: 'component selection must be an object',
        });
        return;
      }
      if (!isNonEmptyString(component.id)) {
        issues.push({
          path: `selectedComponents[${index}].id`,
          message: 'component id is required',
        });
      }
      if (!isNonEmptyString(component.rationale)) {
        issues.push({
          path: `selectedComponents[${index}].rationale`,
          message: 'component rationale is required',
        });
      }
    });
  }

  return { ok: issues.length === 0, issues };
}
