// Deterministic screenshot scenes: `?shot=<scene>&seed=<n>` plays a scripted dive on a
// fixed 1/60 clock (no wall clock, seeded current) and flips window.__shotReady when the
// final frame is drawn, so screenshots are real renders of the game's own code.
import { setScriptedInput, mousePosition } from './input.js';
import { spawnSwimmer, spawnRingFor, hurtEnemy } from './enemies.js';
import { createMaw } from './boss.js';
import { grantXp, cardRects } from './upgrades.js';
import { spawnPlankton, spawnPearl } from './pickups.js';
import { clearFloats } from './particles.js';

// The autopilot that plays each scene: orbit the nearest foe, keep its distance, fire
// always, dash when crowded, and take the first offered gift when a level lands.
function autopilot(state, frame, options = {}) {
  const g = state;
  const p = g.player;
  const keys = [];
  const press = [];
  let target = null;
  let nearest = Infinity;
  for (const foe of g.enemies) {
    if (foe.dead) continue;
    const d2 = (foe.x - p.x) ** 2 + (foe.y - p.y) ** 2;
    if (d2 < nearest) {
      nearest = d2;
      target = foe;
    }
  }

  if (g.mode === 'levelup') {
    if (options.autoPick) press.push('Digit1');
  } else if (g.mode === 'playing') {
    const orbit = frame * 0.035;
    let mx = Math.cos(orbit);
    let my = Math.sin(orbit);
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const push = dist < 230 ? -0.9 : dist > 470 ? 0.7 : 0;
      mx = -dy / dist + (dx / dist) * push + ((640 - p.x) / 640) * 0.5;
      my = dx / dist + (dy / dist) * push + ((360 - p.y) / 360) * 0.5;
    }
    if (mx > 0.35) keys.push('KeyD');
    if (mx < -0.35) keys.push('KeyA');
    if (my > 0.35) keys.push('KeyS');
    if (my < -0.35) keys.push('KeyW');
    // Staged scenes anchor the lantern: steer back instead of orbiting away.
    if (options.hold) {
      const hx = options.hold.x - p.x;
      const hy = options.hold.y - p.y;
      if (Math.hypot(hx, hy) > 45) {
        keys.length = 0;
        if (hx > 45) keys.push('KeyD');
        if (hx < -45) keys.push('KeyA');
        if (hy > 45) keys.push('KeyS');
        if (hy < -45) keys.push('KeyW');
      }
    } else if (target && nearest < 210 * 210 && frame % 150 < 3) {
      press.push('ShiftLeft');
    }
  }

  return {
    keys,
    press,
    mouse: target ? { x: target.x, y: target.y, down: g.mode === 'playing' } : { x: 640, y: 360, down: false },
  };
}

function noInput() {
  return { keys: [], press: [], mouse: { x: 640, y: 360, down: false } };
}

function runFrames(ctl, count, inputFn) {
  for (let i = 0; i < count; i++) {
    setScriptedInput(inputFn(i));
    ctl.step(ctl.FIXED);
    ctl.clear();
  }
  setScriptedInput(null);
}

function finish(ctl) {
  ctl.clear();
  requestAnimationFrame(() => {
    ctl.draw();
    requestAnimationFrame(() => {
      ctl.draw();
      window.__shotReady = true;
    });
  });
}

function sceneStart(ctl) {
  runFrames(ctl, 210, noInput);
  ctl.draw();
}

function scenePlay(ctl, seed) {
  const g = ctl.g;
  ctl.newGame(seed);
  runFrames(ctl, 420, (i) => autopilot(g, i, { autoPick: true }));
  for (let round = 0; round < 3 && g.mode === 'levelup'; round++) {
    runFrames(ctl, 60, (i) => autopilot(g, i, { autoPick: true }));
  }

  // Stage the firefight so the frame reads as combat: bring the lantern back toward
  // the lights, ring it with one of each swimmer already closing in, scatter food,
  // then let a second of live frames put pulses, halos and hits in the air.
  g.player.x = 545;
  g.player.y = 395;
  const ring = [
    spawnSwimmer(g, 'needlejaw', 880, 250),
    spawnSwimmer(g, 'spitter', 965, 505),
    spawnSwimmer(g, 'mawlet', 445, 555),
    spawnSwimmer(g, 'siltling', 775, 615),
    spawnSwimmer(g, 'siltling', 335, 215),
    spawnSwimmer(g, 'siltling', 640, 155),
  ];
  ring.forEach(spawnRingFor);
  spawnPlankton(g, 700, 470, 3);
  spawnPlankton(g, 385, 330, 3);
  spawnPlankton(g, 855, 385, 3);
  spawnPearl(g, 240, 470);
  const hold = { x: 545, y: 395 };
  runFrames(ctl, 75, (i) => autopilot(g, i, { hold }));

  // A card that flipped open mid-scrum would hide the HUD; play it out or shelve it.
  for (let round = 0; round < 3 && g.mode === 'levelup'; round++) {
    runFrames(ctl, 60, (i) => autopilot(g, i, { autoPick: true }));
  }
  if (g.mode !== 'playing') {
    g.upg.cards = [];
    g.upg.pending = 0;
    g.mode = 'playing';
  }
  ctl.draw();
}

function sceneLevelup(ctl, seed) {
  ctl.newGame(seed);
  let frames = 0;
  const budget = Math.round(80 / ctl.FIXED);
  while (ctl.g.mode !== 'levelup' && frames < budget) {
    runFrames(ctl, 60, (i) => autopilot(ctl.g, i, { autoPick: false }));
    frames += 60;
  }
  if (ctl.g.mode !== 'levelup') {
    grantXp(ctl.g, 80);
    runFrames(ctl, 2, noInput);
  }
  // Hover the middle gift so the shot shows a chosen card under the cursor.
  const hover = { x: 0, y: 0, down: false };
  if (ctl.g.mode === 'levelup' && ctl.g.upg.cards.length >= 2) {
    const r = cardRects(ctl.g.upg.cards.length)[1];
    hover.x = r.x + r.w / 2;
    hover.y = r.y + r.h / 2;
  }
  setScriptedInput({ keys: [], press: [], mouse: hover });
  ctl.step(ctl.FIXED);
  ctl.clear();
  setScriptedInput(null);
  ctl.draw();
}

// The final blow against the Maw, taken live: the run is staged at wave 8 with real
// stats, the boss is fought into existence, and the killing hit goes through the same
// hurtEnemy path any pulse would use — which is what opens the victory screen.
function sceneWin(ctl, seed) {
  const g = ctl.g;
  ctl.newGame(seed);
  runFrames(ctl, 420, (i) => autopilot(g, i, { autoPick: true }));
  if (g.mode === 'levelup') runFrames(ctl, 60, (i) => autopilot(g, i, { autoPick: true }));

  g.director.wave = 8;
  g.director.phase = 'done';
  g.director.tapes = [];
  g.kills = 173;
  g.time = 497;
  g.score = 46820;
  g.upg.level = 9;
  g.player.invuln = 9999;
  g.player.light = g.player.maxLight;

  const maw = createMaw(g, 640, 402);
  maw.state = 'chase';
  maw.timer = 0;
  spawnRingFor(maw);
  const sideShow = [
    spawnSwimmer(g, 'spitter', 190, 170),
    spawnSwimmer(g, 'mawlet', 1090, 520),
    spawnSwimmer(g, 'needlejaw', 260, 560),
    spawnSwimmer(g, 'siltling', 1010, 190),
  ];
  sideShow.forEach(spawnRingFor);
  runFrames(ctl, 150, (i) => autopilot(g, i, { autoPick: true }));

  hurtEnemy(g, maw, 9999, g.player.x, g.player.y);
  runFrames(ctl, 4, noInput);
  clearFloats();
  ctl.draw();
}

// The other ending: one light left, one mawlet too close — the loss runs its real path.
function sceneOver(ctl, seed) {
  const g = ctl.g;
  ctl.newGame(seed);
  runFrames(ctl, 420, (i) => autopilot(g, i, { autoPick: true }));
  if (g.mode === 'levelup') runFrames(ctl, 60, (i) => autopilot(g, i, { autoPick: true }));

  g.director.wave = 6;
  g.director.phase = 'done';
  g.director.tapes = [];
  g.kills = 96;
  g.time = 372;
  g.score = 18450;
  g.upg.level = 7;
  g.player.invuln = 0;
  g.player.light = 1;

  const closer = spawnSwimmer(g, 'mawlet', g.player.x + 34, g.player.y - 6);
  spawnRingFor(closer);
  spawnSwimmer(g, 'needlejaw', g.player.x - 90, g.player.y + 60);
  spawnSwimmer(g, 'spitter', 980, 210);
  runFrames(ctl, 10, noInput);
  clearFloats();
  ctl.draw();
}

export function runShotScene(name, seed, ctl) {
  switch (name) {
    case 'play':
      scenePlay(ctl, seed);
      break;
    case 'levelup':
      sceneLevelup(ctl, seed);
      break;
    case 'win':
      sceneWin(ctl, seed);
      break;
    case 'over':
      sceneOver(ctl, seed);
      break;
    case 'start':
    default:
      sceneStart(ctl);
      break;
  }
  finish(ctl);
}
