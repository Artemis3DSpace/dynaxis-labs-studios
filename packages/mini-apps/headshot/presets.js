/**
 * AI Headshot — style categories and aspect ratios migrated from
 * SamurAIGPT/ai-headshot-generator (MIT).
 *
 * MuAPI photo-pack accepts `category` + `aspect_ratio` + `image_url`.
 * Style names are provider-side presets (not freeform prompts).
 */

export const HEADSHOT_MUAPI_ENDPOINT = 'photo-pack';

export const HEADSHOT_ASPECT_RATIOS = [
  { label: '1:1 Square', value: '1:1' },
  { label: '4:3 Classic', value: '4:3' },
  { label: '3:4 Portrait', value: '3:4' },
  { label: '16:9 Landscape', value: '16:9' },
  { label: '9:16 Portrait', value: '9:16' },
];

/** Style categories accepted by MuAPI photo-pack (source: ai-headshot-generator). */
export const HEADSHOT_CATEGORIES = [
  'LinkedIn',
  'Tinder',
  'Bumble',
  'OldMoney',
  'Cyberpunk',
  'CEO',
  'CleanGirl',
  'DarkAcademia',
  'Anime',
  'Doctor',
  'Lawyer',
  'MobWife',
  'Bali',
  '90s',
  'Fitness',
  'Christmas',
  'Halloween',
  'EuropeanElegance',
  'ChampionSportsMoment',
  'JobSwapDaydream',
  'TravelTheWorld',
  'DatingPack',
  'FlashPosePerfection',
  'CapAndGown',
  'CorporateBoss',
  'RocknRollLuxury',
  'TheBigWeddingDay',
  'RusticCharm',
  'DressedToImpress',
  'IdentificationPhoto',
  'DontMissYourProm',
  'GoddessOfNature',
  'BlackAndWhiteMagic',
  'HomelyComforts',
  'BalloonsBalloonsBalloons',
  'BeautyBlooms',
  'SuperheroAdventure',
  'BoldFashionStatements',
  'FantasyOutfits',
  'OnTheCatwalk',
  'HalloweenHorror',
  'CosplayGalore',
  'Ghibli',
  'Pixar',
  'SpiderVerse',
].sort();

/** Example gallery URLs from source (CDN) — decorative only. */
export const HEADSHOT_STYLE_EXAMPLES = [
  {
    name: 'LinkedIn',
    url: 'https://cdn.muapi.ai/outputs/d09a771a8b2a45f1b0b5e6aba5955f1b.jpg',
  },
  {
    name: 'CEO',
    url: 'https://cdn.muapi.ai/outputs/1f6f689a5338409f984d4bc705a6fdd9.jpg',
  },
  {
    name: 'Doctor',
    url: 'https://cdn.muapi.ai/outputs/a462e75109b840d999b61f2345b82707.jpg',
  },
  {
    name: 'Lawyer',
    url: 'https://cdn.muapi.ai/outputs/64c27c401766492982daa19924ff8de6.jpg',
  },
  {
    name: 'OldMoney',
    url: 'https://cdn.muapi.ai/outputs/00436b9b658a474aa337380c6850cd5d.jpg',
  },
  {
    name: 'CorporateBoss',
    url: 'https://cdn.muapi.ai/outputs/1f6f689a5338409f984d4bc705a6fdd9.jpg',
  },
];

/**
 * @param {string} category
 * @returns {boolean}
 */
export function isValidHeadshotCategory(category) {
  return HEADSHOT_CATEGORIES.includes(category);
}

/**
 * @param {string} aspectRatio
 * @returns {boolean}
 */
export function isValidHeadshotAspectRatio(aspectRatio) {
  return HEADSHOT_ASPECT_RATIOS.some((r) => r.value === aspectRatio);
}
