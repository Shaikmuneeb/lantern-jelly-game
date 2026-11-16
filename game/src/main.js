// Lumen Drift: bootstrap, the fixed-step loop, and the state machine that binds the
// modules together — title → fight → level-up picks → pause → victory or loss. Each
// gameplay system lives in its own file; this one decides when they run and what the
// player can do in each state.
import { VIEW, PALETTE } from './config.js';
import { makeRng } from './rng.js';
import { initInput, clearPresses, takePress, mouse, mousePosition, setScriptedInput } from './input.js';
import { initBackground, updateBackground, drawBackground } from './background.js';
import { clearParticles, updateParticles, drawParticles, burst, ringPulse } from './particles.js';
import {
  createLanternJelly,
  updateLanternJelly,
  updateHalo,
  drawHalo,
  drawLanternJelly,
} from './player.js';
import { createArsenal, tryFire, updateArsenal, drawArsenal } from './weapons.js';
import { updateSwimmers, updateEnemyBullets, drawSwimmers, drawEnemyBullets } from './enemies.js';
import { updateMaw, drawMaw } from './boss.js';
import { createDirector, updateDirector } from './director.js';
import { updatePickups, drawPickups } from './pickups.js';
import { createUpgradeState, rollChoices, applyUpgrade, cardRects, drawUpgradeCards } from './upgrades.js';
import { drawHud } from './hud.js';
import {
  drawTitleScreen,
  drawPauseOverlay,
  drawVictoryScreen,
  drawGameOverScreen,
  endButtonRect,
} from './screens.js';
import { unlockAudio, toggleMute, updateAmbience, playSfx } from './audio.js';
import { runShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
initInput(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = seedFrom(params.get('seed'));
initBackground(makeRng(shotSeed * 9973 + 7));

const g = {
  mode: 'title', // title | playing | levelup | paused | victory | gameover
  clock: 0,
  time: 0,
  rng: makeRng(shotSeed * 31 + 13),
  player: createLanternJelly(),
  arsenal: createArsenal(),
  enemies: [],
  enemyBullets: [],
  pickups: [],
  boss: null,
  director: createDirector(),
  upg: createUpgradeState(),
  score: 0,
  best: loadBest(),
  combo: 0,
  comboTimer: 0,
  kills: 0,
  banner: null,
  stats: null,
};

function seedFrom(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function randomSeed() {
  return 1 + Math.floor(Math.random() * 1e9);
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem('lumen-drift-best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('lumen-drift-best', String(value));
  } catch {
    // A blocked localStorage only costs the kept high score.
  }
}

function newGame(seed) {
  g.rng = makeRng(seed ?? randomSeed());
  g.player = createLanternJelly();
  g.arsenal = createArsenal();
  g.enemies = [];
  g.enemyBullets = [];
  g.pickups = [];
  g.boss = null;
  g.director = createDirector();
  g.upg = createUpgradeState();
  g.score = 0;
  g.kills = 0;
  g.combo = 0;
  g.comboTimer = 0;
  g.time = 0;
  g.banner = null;
  g.stats = null;
  clearParticles();
  g.mode = 'playing';
}

// --- per-state input -------------------------------------------------------

function handleTitle() {
  if (takePress('KeyM')) toggleMute();
  if (takePress('Space') || takePress('Enter') || mouse.pressed) {
    unlockAudio();
    newGame(randomSeed());
  }
}

function handlePlayInput() {
  if (takePress('KeyP') || takePress('Escape')) g.mode = 'paused';
  if (takePress('KeyM')) toggleMute();
}

function handleLevelUp() {
  if (takePress('KeyM')) toggleMute();
  const rects = cardRects(g.upg.cards.length);
  g.upg.hover = -1;
  const point = mousePosition();
  rects.forEach((r, i) => {
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
      g.upg.hover = i;
    }
  });
  let chosen = -1;
  if (takePress('Digit1')) chosen = 0;
  else if (takePress('Digit2')) chosen = 1;
  else if (takePress('Digit3')) chosen = 2;
  else if (mouse.pressed && g.upg.hover >= 0) chosen = g.upg.hover;
  if (chosen >= 0 && chosen < g.upg.cards.length) {
    applyUpgrade(g, g.upg.cards[chosen]);
    playSfx('card');
    g.upg.cards = [];
    if (g.upg.pending > 0) {
      g.upg.pending -= 1;
      g.upg.cards = rollChoices(g.upg, g.rng);
      g.upg.hover = -1;
    } else {
      g.mode = 'playing';
    }
  }
}

function handlePause() {
  if (takePress('KeyM')) toggleMute();
  if (takePress('KeyP') || takePress('Escape') || mouse.pressed) g.mode = 'playing';
}

function handleEnd() {
  if (takePress('KeyM')) toggleMute();
  if (takePress('Escape')) {
    g.mode = 'title';
    return;
  }
  const r = endButtonRect();
  const point = mousePosition();
  const overButton = point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
  if (takePress('KeyR') || takePress('Space') || (mouse.pressed && overButton)) {
    newGame(randomSeed());
  }
}

// --- the simulation --------------------------------------------------------

function simulate(dt) {
  const p = g.player;
  updateLanternJelly(p, dt, g.clock);
  tryFire(g);
  updateArsenal(g, dt);
  updateSwimmers(g, dt, g.clock);
  if (g.boss) updateMaw(g, dt, g.clock);
  updateEnemyBullets(g, dt);
  updatePickups(g, dt, g.clock);
  updateHalo(p, g.enemies, dt, g.clock);
  updateDirector(g, dt);

  g.comboTimer -= dt;
  if (g.comboTimer <= 0) {
    g.comboTimer = 0;
    g.combo = 0;
  }

  if (g.upg.pending > 0) openLevelUp();
  if (g.boss && g.boss.dead) endRun(true);
  else if (p.light <= 0) endRun(false);
}

function openLevelUp() {
  g.upg.pending -= 1;
  g.upg.cards = rollChoices(g.upg, g.rng);
  g.upg.hover = -1;
  g.mode = 'levelup';
  playSfx('level');
}

function endRun(won) {
  if (g.score > g.best) {
    g.best = Math.round(g.score);
    saveBest(g.best);
  }
  g.stats = {
    waves: g.director.wave,
    kills: g.kills,
    level: g.upg.level,
    time: g.time,
    score: g.score,
    best: g.best,
  };
  g.mode = won ? 'victory' : 'gameover';
  const p = g.player;
  if (won) {
    playSfx('win');
    burst(p.x, p.y, PALETTE.gold, 44, { speed: 280, life: 1.2, size: 5 });
    ringPulse(p.x, p.y, PALETTE.gold, 90, 1.0);
  } else {
    playSfx('lose');
    burst(p.x, p.y, PALETTE.coral, 34, { speed: 240, life: 1.0, size: 4.5 });
    ringPulse(p.x, p.y, PALETTE.coral, 70, 0.9);
  }
}

function step(dt) {
  g.clock += dt;
  if (g.mode === 'playing' || g.mode === 'levelup') g.time += dt;
  updateBackground(dt, g.clock);
  updateParticles(dt);
  if (g.mode !== 'paused') updateAmbience(dt);

  switch (g.mode) {
    case 'title':
      handleTitle();
      break;
    case 'playing':
      handlePlayInput();
      simulate(dt);
      break;
    case 'levelup':
      handleLevelUp();
      break;
    case 'paused':
      handlePause();
      break;
    case 'victory':
    case 'gameover':
      handleEnd();
      break;
    default:
      break;
  }
}

// --- rendering -------------------------------------------------------------

function draw() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);

  const shake = g.player.hurtFlash * 8;
  ctx.save();
  if (shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground(ctx, g.clock);

  if (g.mode !== 'title') {
    drawPickups(ctx, g, g.clock);
    drawSwimmers(ctx, g, g.clock);
    if (g.boss) drawMaw(ctx, g.boss, g.clock);
    drawHalo(ctx, g.player, g.clock);
    drawLanternJelly(ctx, g.player, g.clock);
    drawArsenal(ctx, g);
    drawEnemyBullets(ctx, g);
  }
  drawParticles(ctx);
  ctx.restore();

  // Hurt flash: the whole sea blushes coral when the lantern takes a sting.
  if (g.player.hurtFlash > 0) {
    const blush = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.25,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
    );
    blush.addColorStop(0, 'rgba(255, 79, 100, 0)');
    blush.addColorStop(1, `rgba(255, 79, 100, ${g.player.hurtFlash * 0.45})`);
    ctx.fillStyle = blush;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (g.mode === 'title') {
    drawTitleScreen(ctx, g, g.clock);
    return;
  }

  const worldVisible = g.mode === 'playing' || g.mode === 'levelup' || g.mode === 'paused';
  if (worldVisible) drawHud(ctx, g);
  if (g.mode === 'playing') drawCrosshair(ctx);
  if (g.mode === 'paused') drawPauseOverlay(ctx, g, g.clock);
  if (g.mode === 'levelup') drawUpgradeCards(ctx, g.upg, g.clock);
  if (g.mode === 'victory') drawVictoryScreen(ctx, g, g.clock);
  if (g.mode === 'gameover') drawGameOverScreen(ctx, g, g.clock);
}

function drawCrosshair(ctx) {
  const point = mousePosition();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(160, 250, 255, 0.9)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(point.x - 14, point.y);
  ctx.lineTo(point.x - 6, point.y);
  ctx.moveTo(point.x + 6, point.y);
  ctx.lineTo(point.x + 14, point.y);
  ctx.moveTo(point.x, point.y - 14);
  ctx.lineTo(point.x, point.y - 6);
  ctx.moveTo(point.x, point.y + 6);
  ctx.lineTo(point.x, point.y + 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- run -------------------------------------------------------------------

const FIXED = 1 / 60;

if (shotName) {
  runShotScene(shotName, shotSeed, { g, newGame, step, draw, clear: clearPresses, FIXED });
} else {
  let last = performance.now();
  let accumulator = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (accumulator >= FIXED) {
      step(FIXED);
      clearPresses();
      accumulator -= FIXED;
    }
    draw();
  };
  requestAnimationFrame(frame);
}
