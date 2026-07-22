/**
 * Dynaxis Campaign goal registry (adapted from Open Pomelli CAMPAIGN_GOALS).
 * Typed code config — not stored in the database.
 */

export const CAMPAIGN_GOALS = /** @type {const} */ ([
  {
    id: 'product_launch',
    label: 'Product launch',
    description: 'Announce a new product or feature',
  },
  {
    id: 'lead_generation',
    label: 'Lead generation',
    description: 'Capture qualified prospects',
  },
  {
    id: 'brand_awareness',
    label: 'Brand awareness',
    description: 'Reach new audiences',
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'Drive replies, shares, comments',
  },
  {
    id: 'thought_leadership',
    label: 'Thought leadership',
    description: 'Establish authority and POV',
  },
  {
    id: 'sales',
    label: 'Direct sales',
    description: 'Drive purchases or sign-ups',
  },
]);

/** @typedef {(typeof CAMPAIGN_GOALS)[number]['id']} CampaignGoalId */

export const CAMPAIGN_GOAL_IDS = CAMPAIGN_GOALS.map((g) => g.id);

/**
 * @param {string} id
 */
export function getCampaignGoal(id) {
  return CAMPAIGN_GOALS.find((g) => g.id === id) || null;
}

/**
 * @param {string} id
 */
export function isCampaignGoalId(id) {
  return CAMPAIGN_GOAL_IDS.includes(/** @type {CampaignGoalId} */ (id));
}
