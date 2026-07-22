import { headshotMiniAppManifest } from './manifest.js';
import HeadshotMiniApp from './HeadshotMiniApp.js';
import {
  invokeCapability,
  generateHeadshot,
  buildHeadshotGenerationRequest,
  validateHeadshotRequest,
} from './capability.js';

export const manifest = headshotMiniAppManifest;
export const Component = HeadshotMiniApp;
export {
  invokeCapability,
  generateHeadshot,
  buildHeadshotGenerationRequest,
  validateHeadshotRequest,
};

export default {
  manifest,
  Component,
  invokeCapability,
};
