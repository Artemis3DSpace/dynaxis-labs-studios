import { campaignStudioMiniAppManifest } from './manifest.js';
import CampaignStudioMiniApp from './CampaignStudioMiniApp.js';
import {
  invokeCapability,
  createCampaign,
  generateCampaignConcepts,
  updateCampaignConcept,
  selectCampaignConcept,
  createCampaignDeliverables,
  generateCampaignDeliverable,
  generateCampaignDeliverableBatch,
  attachCampaignAsset,
} from './capability.js';

export const manifest = campaignStudioMiniAppManifest;
export const Component = CampaignStudioMiniApp;
export {
  invokeCapability,
  createCampaign,
  generateCampaignConcepts,
  updateCampaignConcept,
  selectCampaignConcept,
  createCampaignDeliverables,
  generateCampaignDeliverable,
  generateCampaignDeliverableBatch,
  attachCampaignAsset,
};

export default {
  manifest,
  Component,
  invokeCapability,
};
