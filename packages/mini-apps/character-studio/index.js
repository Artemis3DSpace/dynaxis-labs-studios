import { characterStudioMiniAppManifest } from './manifest.js';
import CharacterStudioMiniApp from './CharacterStudioMiniApp.js';
import {
  invokeCapability,
  generateCharacterPortrait,
  refineCharacterPortrait,
  chatWithCharacter,
  createCharacterCapability,
  updateCharacterCapability,
  promoteGeneratedPortrait,
} from './capability.js';

export const manifest = characterStudioMiniAppManifest;
export const Component = CharacterStudioMiniApp;
export {
  invokeCapability,
  generateCharacterPortrait,
  refineCharacterPortrait,
  chatWithCharacter,
  createCharacterCapability,
  updateCharacterCapability,
  promoteGeneratedPortrait,
};

export default {
  manifest,
  Component,
  invokeCapability,
};
