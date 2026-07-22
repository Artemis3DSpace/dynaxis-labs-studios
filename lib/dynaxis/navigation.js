/**
 * Dynaxis Labs Studios — top-level information architecture.
 */

import { getShellFeatures } from './features.js';

/** @type {{ id: string, label: string, description: string }[]} */
export const DYNAXIS_NAV_SECTIONS = [
  {
    id: 'create',
    label: 'Create',
    description: 'Generation studios for media and creative output.',
  },
  {
    id: 'build',
    label: 'Build',
    description: 'Workflows, agents, and design automation.',
  },
  {
    id: 'apps',
    label: 'Apps',
    description: 'External templates and catalogue (not installed modules).',
  },
  {
    id: 'connect',
    label: 'Connect',
    description: 'CLI, MCP, and external developer integrations.',
  },
];

/**
 * Shell navigation model: sections with features for the web product shell.
 * Account/settings are handled separately in the shell chrome.
 */
export function getShellNavigation() {
  const features = getShellFeatures();
  return DYNAXIS_NAV_SECTIONS.map((section) => ({
    ...section,
    items: features
      .filter((f) => f.category === section.id)
      .map((f) => ({
        id: f.viewId,
        featureId: f.id,
        label: f.navLabel || f.name,
        name: f.name,
        href: f.route || `/studio/${f.viewId}`,
        capabilityType: f.capabilityType,
        availability: f.availability,
      })),
  })).filter((section) => section.items.length > 0);
}

/** Flat list of shell view ids (for URL / active tab resolution). */
export function getShellViewIds() {
  return getShellFeatures().map((f) => f.viewId);
}
