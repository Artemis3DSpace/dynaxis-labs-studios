export async function invokeCapability(name, args = {}, runtime) {
  if (name === 'listDesignTemplates') {
    return runtime.listDesignTemplates(args);
  }
  if (name === 'instantiateDesignTemplate') {
    return runtime.instantiateDesignTemplate(args);
  }
  if (name === 'createTemplateFromComposition') {
    return runtime.createTemplateFromComposition(args);
  }
  if (name === 'adaptComposition') {
    return runtime.adaptComposition(args);
  }
  if (name === 'listDesignComponents') {
    return runtime.listDesignComponents(args);
  }
  if (name === 'instantiateDesignComponent') {
    return runtime.instantiateDesignComponent(args);
  }
  if (name === 'createComponentFromLayers') {
    return runtime.createComponentFromLayers(args);
  }
  if (name === 'archiveDesignComponent') {
    return runtime.archiveDesignComponent(args);
  }
  const err = new Error(`Unknown Design Library capability: ${name}`);
  err.code = 'MINI_APP_CAPABILITY_MISSING';
  throw err;
}
