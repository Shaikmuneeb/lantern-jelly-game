// The dive's tuning tables: balance numbers, palette, waves and the upgrade pool all
// live here, so gameplay modules import what the game is instead of inventing values.
export const VIEW = { width: 1280, height: 720 };

// The playable rectangle: the whole canvas, minus a thin rim for the glow and HUD.
export const ARENA = { left: 20, top: 20, right: 1260, bottom: 700 };

export const PALETTE = {
  skyTop: '#0a1330',
  skyBottom: '#03060f',
  foam: '#eaf7ff',
  glow: '#66f2ff',
  glowDim: '#2ec4d8',
  mint: '#7df9c9',
  gold: '#ffd166',
  coral: '#ff7a8a',
  violet: '#9d7bff',
  danger: '#ff4f93',
  uiPanel: 'rgba(7, 12, 34, 0.84)',
  uiLine: 'rgba(102, 242, 255, 0.35)',
};

export const PLAYER = {
  startLight: 5,
  radius: 17,
  maxSpeed: 280,
  accel: 1500,
  fireDelay: 0.3,
  pulseSpeed: 640,
  pulseRadius: 6,
  pulseDamage: 3,
  pulseLife: 1.3,
  pulseSpread: 0.16,
  dashSpeed: 860,
  dashTime: 0.16,
  dashDelay: 2.2,
  invulnTime: 0.9,
  magnet: 95,
};

export const ENEMIES = {
  siltling: {
    label: 'Siltling',
    hp: 3, speed: 64, radius: 14, touch: 1, score: 10, xp: 1,
    color: '#8fa4cf', core: '#24304f',
  },
  needlejaw: {
    label: 'Needlejaw',
    hp: 9, speed: 52, dashSpeed: 470, windup: 0.5, dashTime: 0.42, rest: 0.65,
    radius: 16, touch: 1, score: 25, xp: 2,
    color: '#ff9f68', core: '#5c2c17',
  },
  mawlet: {
    label: 'Mawlet',
    hp: 24, speed: 42, radius: 25, touch: 1, score: 45, xp: 4,
    color: '#a97cff', core: '#2f1d5a',
  },
  spitter: {
    label: 'Glow Spitter',
    hp: 12, speed: 56, radius: 17, touch: 1, keep: 250, fireDelay: 2.2,
    bulletSpeed: 215, score: 35, xp: 3,
    color: '#ff6fb1', core: '#4d1138',
  },
};

export const BOSS = {
  label: 'The Abyssal Maw',
  hp: 340,
  radius: 58,
  touch: 1,
  score: 1500,
  xp: 25,
  driftSpeed: 46,
  chargeWindup: 0.85,
  chargeSpeed: 540,
  chargeTime: 0.75,
  volleyDelay: 3.2,
  volleyCount: 11,
  bulletSpeed: 195,
  summonDelay: 7.5,
  summonCount: 3,
  enrageAt: 0.3,
  color: '#1b1550',
  rim: '#c46bff',
  maw: '#ff5f8f',
  eye: '#ffd166',
};

// Enemy bullets (the Glow Spitter's shots and the Maw's volleys).
export const BULLET = { radius: 7, life: 4 };

// Wave scripts: `spawns` entries release `count` of `type`, one every `every` seconds,
// from the arena's edges; a wave ends when its script is spent and the arena is clear.
export const WAVES = [
  {
    name: 'The Current Shifts',
    spawns: [{ type: 'siltling', count: 12, every: 1.1 }],
  },
  {
    name: 'Something Watches',
    spawns: [
      { type: 'siltling', count: 10, every: 1.2 },
      { type: 'needlejaw', count: 4, every: 2.4 },
    ],
  },
  {
    name: 'The Deep Stirs',
    spawns: [
      { type: 'siltling', count: 10, every: 1.05 },
      { type: 'needlejaw', count: 5, every: 1.9 },
      { type: 'mawlet', count: 3, every: 3.4 },
    ],
  },
  {
    name: 'Needles in the Dark',
    spawns: [
      { type: 'siltling', count: 12, every: 0.95 },
      { type: 'needlejaw', count: 6, every: 1.7 },
      { type: 'mawlet', count: 3, every: 3.0 },
      { type: 'spitter', count: 3, every: 3.2 },
    ],
  },
  {
    name: 'Pressure Falls',
    spawns: [
      { type: 'siltling', count: 14, every: 0.85 },
      { type: 'needlejaw', count: 7, every: 1.6 },
      { type: 'mawlet', count: 4, every: 2.7 },
      { type: 'spitter', count: 4, every: 2.6 },
    ],
  },
  {
    name: 'The Swarm Descends',
    spawns: [
      { type: 'siltling', count: 16, every: 0.75 },
      { type: 'needlejaw', count: 8, every: 1.45 },
      { type: 'mawlet', count: 5, every: 2.5 },
      { type: 'spitter', count: 5, every: 2.3 },
    ],
  },
  {
    name: 'Last Light Before the Maw',
    spawns: [
      { type: 'siltling', count: 18, every: 0.7 },
      { type: 'needlejaw', count: 9, every: 1.35 },
      { type: 'mawlet', count: 6, every: 2.3 },
      { type: 'spitter', count: 6, every: 2.1 },
    ],
  },
  {
    name: 'The Abyssal Maw',
    boss: true,
    spawns: [{ type: 'siltling', count: 12, every: 3.4 }],
  },
];

export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Pulses', blurb: 'Fire 20% faster', max: 5 },
  { id: 'shards', name: 'Prism Shards', blurb: '+1 pulse per shot', max: 3 },
  { id: 'core', name: 'Brighter Core', blurb: '+2 pulse damage', max: 5 },
  { id: 'drift', name: 'Swift Drift', blurb: '+15% swim speed', max: 4 },
  { id: 'pierce', name: 'Piercing Light', blurb: 'Pulses pass through +1 foe', max: 3 },
  { id: 'lure', name: 'Lure Light', blurb: 'Plankton is drawn from farther', max: 3 },
  { id: 'wind', name: 'Second Wind', blurb: '+1 max light, heal 2', max: 4 },
  { id: 'blink', name: 'Blink Step', blurb: 'Dash recharges 30% faster', max: 3 },
  { id: 'halo', name: 'Thorn Halo', blurb: 'An orbiting barb stings foes', max: 3 },
  { id: 'chain', name: 'Chain Glow', blurb: 'Pulses arc to a nearby foe', max: 3 },
  { id: 'ravage', name: 'Ravaging Dash', blurb: 'Your dash stings what it passes', max: 2 },
];

export const TUNING = {
  xpForLevel: (level) => 6 + level * 6,
  comboWindow: 3.0,
  comboMax: 25,
  comboStep: 0.1,
  waveBonus: (wave) => 80 * wave,
  planktonScore: 5,
  pearlChance: 0.07,
  hpPerWave: (wave) => 1 + (wave - 1) * 0.12,
  killChainGap: 0.45,
};
