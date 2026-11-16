// The wave director: paces the dive one wave at a time — banner, spawn schedule,
// the wait for the arena to clear, the clear bonus — and calls the boss in on wave 8.
import { WAVES, ARENA, PALETTE, TUNING } from './config.js';
import { spawnSwimmer, spawnRingFor } from './enemies.js';
import { createMaw } from './boss.js';
import { playSfx } from './audio.js';
import { floatText, ringPulse } from './particles.js';

export function createDirector() {
  return {
    wave: 0,
    phase: 'wait', // wait → banner → spawning → clearing → (wait | done)
    timer: 1.4,
    tapes: [],
    bossWave: false,
    spawned: 0,
  };
}

export function updateDirector(g, dt) {
  const d = g.director;

  if (g.banner) {
    g.banner.t += dt;
    if (g.banner.t > g.banner.dur) g.banner = null;
  }

  d.timer -= dt;

  if (d.phase === 'wait') {
    if (d.timer <= 0) beginWave(g);
  } else if (d.phase === 'banner') {
    if (d.timer <= 0) {
      d.phase = 'spawning';
      if (d.bossWave && !g.boss) summonMaw(g);
    }
  } else if (d.phase === 'spawning') {
    for (const tape of d.tapes) {
      if (tape.left <= 0) continue;
      tape.tick -= dt;
      if (tape.tick <= 0) {
        spawnFromEdge(g, tape.type);
        tape.left -= 1;
        d.spawned += 1;
        tape.tick = tape.every * g.rng.range(0.8, 1.25);
      }
    }
    if (d.tapes.every((tape) => tape.left <= 0)) d.phase = 'clearing';
  } else if (d.phase === 'clearing') {
    if (g.enemies.length === 0 && !(g.boss && !g.boss.dead)) {
      const bonus = TUNING.waveBonus(d.wave);
      g.score += bonus;
      floatText(640, 330, `the current calms  +${bonus}`, PALETTE.gold, 24);
      playSfx('card');
      d.phase = d.wave >= WAVES.length ? 'done' : 'wait';
      d.timer = 2.1;
    }
  }
}

function beginWave(g) {
  const d = g.director;
  d.wave += 1;
  const def = WAVES[d.wave - 1];
  d.bossWave = Boolean(def.boss);
  d.tapes = def.spawns.map((spawn) => ({
    type: spawn.type,
    left: spawn.count,
    every: spawn.every,
    tick: g.rng.range(0.35, spawn.every),
  }));
  d.phase = 'banner';
  d.timer = 1.8;
  g.banner = {
    text: d.bossWave ? 'THE ABYSSAL MAW' : `WAVE ${d.wave} OF ${WAVES.length}`,
    sub: def.name,
    t: 0,
    dur: 2.6,
  };
  playSfx(d.bossWave ? 'boss' : 'wave');
}

function summonMaw(g) {
  const maw = createMaw(g, 640, ARENA.bottom + 70);
  spawnRingFor(maw);
}

// Spawn on a random rim, nudged away from an overlapping edge so nothing lands on top
// of the jelly at the moment it appears.
function spawnFromEdge(g, type) {
  const p = g.player;
  const side = g.rng.int(0, 3);
  let x;
  let y;
  if (side === 0) {
    x = ARENA.left + 14;
    y = g.rng.range(ARENA.top + 40, ARENA.bottom - 40);
  } else if (side === 1) {
    x = ARENA.right - 14;
    y = g.rng.range(ARENA.top + 40, ARENA.bottom - 40);
  } else if (side === 2) {
    x = g.rng.range(ARENA.left + 40, ARENA.right - 40);
    y = ARENA.top + 14;
  } else {
    x = g.rng.range(ARENA.left + 40, ARENA.right - 40);
    y = ARENA.bottom - 14;
  }
  const dx = x - p.x;
  const dy = y - p.y;
  if (dx * dx + dy * dy < 150 * 150) {
    const len = Math.hypot(dx, dy) || 1;
    x = p.x + (dx / len) * 170;
    y = p.y + (dy / len) * 170;
    x = Math.max(ARENA.left + 14, Math.min(ARENA.right - 14, x));
    y = Math.max(ARENA.top + 14, Math.min(ARENA.bottom - 14, y));
  }
  const foe = spawnSwimmer(g, type, x, y);
  spawnRingFor(foe);
}

// For the HUD's wave progress: how many are loose, how many are still in the script.
export function directorCounts(g) {
  const d = g.director;
  const scheduled = d.tapes.reduce((sum, tape) => sum + tape.left, 0);
  return { alive: g.enemies.length, scheduled, totalWaves: WAVES.length, wave: d.wave };
}
