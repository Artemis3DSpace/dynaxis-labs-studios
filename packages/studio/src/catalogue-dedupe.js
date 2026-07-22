/**
 * Apps catalogue helpers — suppress external template cards when a Dynaxis
 * Mini App supersedes the same upstream capability.
 */

/**
 * @param {Array<{ name?: string, repo?: string }>} templates
 * @param {Array<{ id?: string, attribution?: { upstreamRepo?: string }, replacesCatalogueRepos?: string[] }>} integratedModules
 */
export function filterCatalogueTemplates(templates, integratedModules = []) {
  const suppressedRepos = new Set();
  const suppressedNames = new Set();
  for (const mod of integratedModules || []) {
    const repo = mod?.attribution?.upstreamRepo;
    if (repo) suppressedRepos.add(String(repo).replace(/\/$/, '').toLowerCase());
    if (Array.isArray(mod?.replacesCatalogueRepos)) {
      for (const r of mod.replacesCatalogueRepos) {
        suppressedRepos.add(String(r).replace(/\/$/, '').toLowerCase());
      }
    }
    if (mod?.id === 'dynaxis.headshot') {
      suppressedNames.add('ai headshot studio');
    }
    if (mod?.id === 'dynaxis.character-studio') {
      suppressedNames.add('ai character studio');
    }
    if (mod?.id === 'dynaxis.product-studio') {
      suppressedNames.add('amazon product studio');
      suppressedNames.add('product studio');
    }
    if (mod?.id === 'dynaxis.brand-studio') {
      suppressedNames.add('open pomelli');
      suppressedNames.add('brand studio');
    }
  }
  return (templates || []).filter((app) => {
    const repo = app?.repo
      ? String(app.repo).replace(/\/$/, '').toLowerCase()
      : '';
    if (repo && suppressedRepos.has(repo)) return false;
    if (app?.name && suppressedNames.has(String(app.name).toLowerCase())) return false;
    return true;
  });
}
