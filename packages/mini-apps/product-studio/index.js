import { productStudioMiniAppManifest } from './manifest.js';
import ProductStudioMiniApp from './ProductStudioMiniApp.js';
import {
  invokeCapability,
  generateProductScene,
  generateProductPhotoPack,
  createProductCapability,
  updateProductCapability,
  promoteProductReference,
} from './capability.js';

export const manifest = productStudioMiniAppManifest;
export const Component = ProductStudioMiniApp;
export {
  invokeCapability,
  generateProductScene,
  generateProductPhotoPack,
  createProductCapability,
  updateProductCapability,
  promoteProductReference,
};

export default {
  manifest,
  Component,
  invokeCapability,
};
