import { exampleMiniAppManifest } from './manifest.js';
import ExampleMiniApp from './ExampleMiniApp.js';
import { invokeCapability, buildExampleGenerationPlan } from './capability.js';

export const manifest = exampleMiniAppManifest;
export const Component = ExampleMiniApp;
export { invokeCapability, buildExampleGenerationPlan };

export default {
  manifest,
  Component,
  invokeCapability,
};
