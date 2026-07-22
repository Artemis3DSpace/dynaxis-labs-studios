import { brandStudioMiniAppManifest } from './manifest.js';
import BrandStudioMiniApp from './BrandStudioMiniApp.js';
import {
  invokeCapability,
  createBrand,
  updateBrand,
  analyzeBrandWebsite,
  saveBrandDraft,
  attachBrandAsset,
  linkProductToBrand,
  resolveBrandContextCapability,
  normaliseBrandDnaInput,
} from './capability.js';

export const manifest = brandStudioMiniAppManifest;
export const Component = BrandStudioMiniApp;
export {
  invokeCapability,
  createBrand,
  updateBrand,
  analyzeBrandWebsite,
  saveBrandDraft,
  attachBrandAsset,
  linkProductToBrand,
  resolveBrandContextCapability,
  normaliseBrandDnaInput,
};

export default {
  manifest,
  Component,
  invokeCapability,
};
