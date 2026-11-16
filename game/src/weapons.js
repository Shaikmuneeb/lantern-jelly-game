// Light pulses: the jelly's shots. Firing, spread, piercing, chain arcs and the one
// collision pass that turns a shot into damage are all here, kept apart from both the
// player (movement) and the swarm (enemy behaviour) so each file has a single job.
import { PLAYER, PALETTE } from './config.js';
import { circlesHit, dist2 } from './collision.js';
import { mouseIsDown, isDown, mousePosition } from './input.js';
import { playSfx } from './audio.js';
import { burst, trailPuff } from './particles.js';
import { hurtEnemy } from './enemies.js';

export function createArsenal() {
  return { cooldown: 0, pulses: [], arcs: [] };
}

export function tryFire(g) {
  const { arsenal, player } = g;
  if (arsenal.cooldown > 0) return;
  if (!mouseIsDown() && !isDown('Space')) return;
  const aim = mousePosition();
  const base = Math.atan2(aim.y - player.y, aim.x - player.x);
  for (let i = 0; i < player.shots; i++) {
    const offset = (i - (player.shots - 1) / 2) * PLAYER.pulseSpread;
    const angle = base + offset;
    arsenal.pulses.push({
      x: player.x + Math.cos(angle) * 14,
      y: player.y + Math.sin(angle) * 14,
      vx: Math.cos(angle) * PLAYER.pulseSpeed,
      vy: Math.sin(angle) * PLAYER.pulseSpeed,
      radius: PLAYER.pulseRadius,
      damage: player.damage,
      pierceLeft: player.pierce,
      life: PLAYER.pulseLife,
      last: null,
    });
  }
  arsenal.cooldown = player.fireDelay;
  playSfx('shoot');
  const kickX = player.x + Math.cos(base) * 18;
  const kickY = player.y + Math.sin(base) * 18;
  burst(kickX, kickY, PALETTE.glow, 3, { speed: 130, life: 0.22, size: 2.6, dir: base, spread: 1.1 });
}

export function updateArsenal(g, dt) {
  const { arsenal, enemies, player } = g;
  arsenal.cooldown = Math.max(0, arsenal.cooldown - dt);

  for (let i = arsenal.pulses.length - 1; i >= 0; i--) {
    const shot = arsenal.pulses[i];
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (
      shot.life <= 0 ||
      shot.x < -30 || shot.x > 1310 ||
      shot.y < -30 || shot.y > 750
    ) {
      arsenal.pulses.splice(i, 1);
      continue;
    }
    if (Math.random() < dt * 40) {
      trailPuff(shot.x, shot.y, 'rgba(102,242,255,0.65)', 3);
    }

    let consumed = false;
    for (const foe of enemies) {
      if (foe.dead) continue;
      if (foe === shot.last) continue;
      if (!circlesHit(shot.x, shot.y, shot.radius, foe.x, foe.y, foe.radius)) continue;

      const killed = hurtEnemy(g, foe, shot.damage, shot.x, shot.y);
      chainFrom(g, foe, shot, player);
      shot.pierceLeft -= 1;
      if (shot.pierceLeft < 0) consumed = true;
      shot.last = foe;
      if (consumed) {
        burst(shot.x, shot.y, PALETTE.glow, 5, { speed: 150, life: 0.3, size: 2.6 });
        arsenal.pulses.splice(i, 1);
        break;
      }
    }
  }

  for (let i = arsenal.arcs.length - 1; i >= 0; i--) {
    arsenal.arcs[i].life -= dt;
    if (arsenal.arcs[i].life <= 0) arsenal.arcs.splice(i, 1);
  }
}

// Chain Glow: a chance for the pulse to arc 60% of its damage into nearby foes.
function chainFrom(g, firstFoe, shot, player) {
  if (player.chain <= 0) return;
  if (!g.rng.chance(0.35)) return;
  const candidates = g.enemies
    .filter((foe) => !foe.dead && foe !== firstFoe && dist2(foe.x, foe.y, firstFoe.x, firstFoe.y) < 160 * 160)
    .sort((a, b) => dist2(a.x, a.y, firstFoe.x, firstFoe.y) - dist2(b.x, b.y, firstFoe.x, firstFoe.y))
    .slice(0, player.chain);
  if (candidates.length === 0) return;
  playSfx('chain');
  let fromX = firstFoe.x;
  let fromY = firstFoe.y;
  for (const foe of candidates) {
    g.arsenal.arcs.push({ points: jaggedPath(fromX, fromY, foe.x, foe.y), life: 0.16, maxLife: 0.16 });
    hurtEnemy(g, foe, shot.damage * 0.6, fromX, fromY);
    fromX = foe.x;
    fromY = foe.y;
  }
}

function jaggedPath(x1, y1, x2, y2) {
  const points = [{ x: x1, y: y1 }];
  const segments = 5;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (Math.random() - 0.5) * 26;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    points.push({ x: px + (nx / len) * jitter, y: py + (ny / len) * jitter });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

export function drawArsenal(ctx, g) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const arc of g.arsenal.arcs) {
    const alpha = arc.life / arc.maxLife;
    ctx.strokeStyle = `rgba(190, 250, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(arc.points[0].x, arc.points[0].y);
    for (const pt of arc.points.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  for (const shot of g.arsenal.pulses) {
    const glow = ctx.createRadialGradient(shot.x, shot.y, 0, shot.x, shot.y, 13);
    glow.addColorStop(0, 'rgba(220, 255, 255, 0.95)');
    glow.addColorStop(0.4, 'rgba(102, 242, 255, 0.55)');
    glow.addColorStop(1, 'rgba(102, 242, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ffff';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
