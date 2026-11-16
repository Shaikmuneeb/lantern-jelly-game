// What the swarm leaves behind: plankton (experience, drawn in from range by the
// Lure Light) and pearls (a dropped sliver of light that heals, or scores when the
// jelly is already full). Collection rules and their feedback live here.
import { PALETTE, TUNING } from './config.js';
import { dist2 } from './collision.js';
import { burst, floatText } from './particles.js';
import { grantXp } from './upgrades.js';
import { playSfx } from './audio.js';

const MAX_PICKUPS = 240;

export function spawnPlankton(g, x, y, value) {
  if (g.pickups.length >= MAX_PICKUPS) g.pickups.shift();
  const angle = g.rng.range(0, Math.PI * 2);
  const kick = g.rng.range(30, 90);
  g.pickups.push({
    kind: 'plankton',
    x,
    y,
    vx: Math.cos(angle) * kick,
    vy: Math.sin(angle) * kick,
    r: 6,
    value,
    life: 45,
    phase: g.rng.range(0, Math.PI * 2),
  });
}

export function spawnPearl(g, x, y) {
  if (g.pickups.length >= MAX_PICKUPS) return;
  g.pickups.push({
    kind: 'pearl',
    x,
    y,
    vx: 0,
    vy: -20,
    r: 9,
    value: 1,
    life: 45,
    phase: 0,
  });
}

export function updatePickups(g, dt, time) {
  const p = g.player;
  const kept = [];
  for (const item of g.pickups) {
    item.life -= dt;
    if (item.life <= 0) continue;

    // Drift with drag, then let the magnet take over inside its radius.
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.vx *= 1 - 3 * dt;
    item.vy *= 1 - 3 * dt;

    const reach = dist2(item.x, item.y, p.x, p.y);
    const magnetR = item.kind === 'pearl' ? p.magnet * 0.7 : p.magnet;
    if (reach < magnetR * magnetR) {
      const pull = item.kind === 'pearl' ? 700 : 950;
      const dx = p.x - item.x;
      const dy = p.y - item.y;
      const len = Math.sqrt(reach) || 1;
      item.vx += (dx / len) * pull * dt;
      item.vy += (dy / len) * pull * dt;
    }

    const grab = p.radius + item.r + 4;
    if (dist2(item.x, item.y, p.x, p.y) < grab * grab) {
      collect(g, item, time);
      continue;
    }
    kept.push(item);
  }
  g.pickups = kept;
}

function collect(g, item, time) {
  const p = g.player;
  if (item.kind === 'plankton') {
    grantXp(g, item.value);
    g.score += TUNING.planktonScore;
    if (Math.random() < 0.5) burst(item.x, item.y, PALETTE.mint, 3, { speed: 70, life: 0.28, size: 2 });
  } else if (p.light < p.maxLight) {
    p.light += 1;
    floatText(p.x, p.y - 26, '+1 light', PALETTE.mint, 19);
    burst(item.x, item.y, PALETTE.gold, 10, { speed: 150, life: 0.5, size: 3 });
    playSfx('pearl');
  } else {
    g.score += 50;
    floatText(item.x, item.y, '+50', PALETTE.gold, 18);
    playSfx('pearl');
  }
}

export function drawPickups(ctx, g, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const item of g.pickups) {
    const fade = Math.min(1, item.life / 3);
    const pulse = 0.85 + Math.sin(time * 6 + item.phase) * 0.15;
    if (item.kind === 'plankton') {
      const r = item.r * pulse;
      const glow = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, r * 2.4);
      glow.addColorStop(0, `rgba(125, 249, 201, ${0.85 * fade})`);
      glow.addColorStop(1, 'rgba(125, 249, 201, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(226, 255, 244, ${fade})`;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = item.r * pulse;
      const glow = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, r * 3);
      glow.addColorStop(0, `rgba(255, 209, 102, ${0.9 * fade})`);
      glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 248, 224, ${fade})`;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.8 * fade})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(item.x, item.y, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
