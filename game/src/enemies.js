// The swarm: spawning swimmers, their per-type behaviour (seeking, telegraphed dashes,
// keeping range and spitting), the shared contact pass, and the damage/death bookkeeping
// every upgrade and weapon routes through (hurtEnemy).
import { ENEMIES, ARENA, BULLET, PALETTE, TUNING } from './config.js';
import { circlesHit, dist2, unitVector, clamp } from './collision.js';
import { burst, ringPulse, floatText } from './particles.js';
import { playSfx } from './audio.js';
import { hurtLanternJelly } from './player.js';
import { spawnPlankton, spawnPearl } from './pickups.js';

export function spawnSwimmer(g, type, x, y) {
  const base = ENEMIES[type];
  const hp = Math.ceil(base.hp * TUNING.hpPerWave(g.director.wave));
  const foe = {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp,
    maxHp: hp,
    speed: base.speed,
    score: base.score,
    xp: base.xp,
    touch: base.touch,
    color: base.color,
    flash: 0,
    dead: false,
    haloCd: 0,
    wobble: g.rng.range(0, Math.PI * 2),
    phase: 'seek',
    timer: g.rng.range(0.5, 1.6),
    dirX: 0,
    dirY: 0,
    fireTimer: g.rng.range(0.6, base.fireDelay ?? 2),
    strafe: g.rng.chance(0.5) ? 1 : -1,
  };
  g.enemies.push(foe);
  return foe;
}

// A just-spawned swimmer shimmers in from the dark so arrivals read as threats.
export function spawnRingFor(foe) {
  ringPulse(foe.x, foe.y, foe.color, foe.radius * 1.6, 0.5);
}

export function updateSwimmers(g, dt, time) {
  const p = g.player;
  for (const foe of g.enemies) {
    if (foe.dead) continue;
    foe.flash = Math.max(0, foe.flash - dt);
    foe.haloCd = Math.max(0, foe.haloCd - dt);

    switch (foe.type) {
      case 'siltling':
        seekWithWobble(g, foe, dt, time, 1);
        break;
      case 'mawlet':
        seekWithWobble(g, foe, dt, time, 0.35);
        break;
      case 'needlejaw':
        updateNeedlejaw(g, foe, dt, time);
        break;
      case 'spitter':
        updateSpitter(g, foe, dt, time);
        break;
      default:
        break;
    }

    // Contact: every swimmer stings on touch, the jelly's i-frames keep it fair.
    if (circlesHit(foe.x, foe.y, foe.radius, p.x, p.y, p.radius)) {
      if (hurtLanternJelly(p, foe.touch, foe.x, foe.y)) {
        const shove = unitVector(foe.x - p.x, foe.y - p.y);
        foe.x += shove.x * 14;
        foe.y += shove.y * 14;
      }
    }
  }

  // Drop the dead so arrays never grow across a run.
  if (g.enemies.some((foe) => foe.dead)) {
    g.enemies = g.enemies.filter((foe) => !foe.dead);
  }
}

function seekWithWobble(g, foe, dt, time, wobbleAmount) {
  const p = g.player;
  const toPlayer = unitVector(p.x - foe.x, p.y - foe.y);
  const sway = Math.sin(foe.wobble + time * 3) * wobbleAmount * 0.4;
  const dirX = toPlayer.x - toPlayer.y * sway;
  const dirY = toPlayer.y + toPlayer.x * sway;
  foe.x += dirX * foe.speed * dt;
  foe.y += dirY * foe.speed * dt;
}

// Needlejaw: creep close, telegraph with a red flare, then commit to a straight dash.
function updateNeedlejaw(g, foe, dt, time) {
  const p = g.player;
  const base = ENEMIES.needlejaw;
  foe.timer -= dt;
  const distance = Math.hypot(p.x - foe.x, p.y - foe.y);

  if (foe.phase === 'seek') {
    const toPlayer = unitVector(p.x - foe.x, p.y - foe.y);
    foe.dirX = toPlayer.x;
    foe.dirY = toPlayer.y;
    foe.x += toPlayer.x * foe.speed * dt;
    foe.y += toPlayer.y * foe.speed * dt;
    if (distance < 240 || foe.timer <= 0) {
      foe.phase = 'windup';
      foe.timer = base.windup;
      const predict = unitVector(
        p.x + p.vx * 0.22 - foe.x,
        p.y + p.vy * 0.22 - foe.y,
      );
      foe.dirX = predict.x;
      foe.dirY = predict.y;
    }
  } else if (foe.phase === 'windup') {
    // The windup shoves the needlejaw back a hair — a readable "here it comes".
    foe.x -= foe.dirX * 26 * dt;
    foe.y -= foe.dirY * 26 * dt;
    if (foe.timer <= 0) {
      foe.phase = 'dash';
      foe.timer = base.dashTime;
      playSfx('dash');
      burst(foe.x, foe.y, base.color, 6, { speed: 140, life: 0.3, size: 3, dir: Math.atan2(foe.dirY, foe.dirX), spread: 1.4 });
    }
  } else if (foe.phase === 'dash') {
    foe.x += foe.dirX * base.dashSpeed * dt;
    foe.y += foe.dirY * base.dashSpeed * dt;
    if (foe.timer <= 0) {
      foe.phase = 'rest';
      foe.timer = base.rest;
    }
  } else if (foe.phase === 'rest') {
    const toPlayer = unitVector(p.x - foe.x, p.y - foe.y);
    foe.x += toPlayer.x * foe.speed * 0.45 * dt;
    foe.y += toPlayer.y * foe.speed * 0.45 * dt;
    if (foe.timer <= 0) {
      foe.phase = 'seek';
      foe.timer = g.rng.range(1.2, 2.2);
    }
  }
}

// Glow Spitter: holds its favourite range, sidesteps, and lobs slow glowing shots.
function updateSpitter(g, foe, dt, time) {
  const p = g.player;
  const base = ENEMIES.spitter;
  const toPlayer = unitVector(p.x - foe.x, p.y - foe.y);
  const distance = Math.hypot(p.x - foe.x, p.y - foe.y);

  let dirX = toPlayer.x;
  let dirY = toPlayer.y;
  if (distance < base.keep - 40) {
    dirX = -toPlayer.x;
    dirY = -toPlayer.y;
  } else if (distance < base.keep + 40) {
    dirX = -toPlayer.y * foe.strafe;
    dirY = toPlayer.x * foe.strafe;
  }
  foe.x += dirX * foe.speed * dt;
  foe.y += dirY * foe.speed * dt;
  foe.x = clamp(foe.x, ARENA.left - 30, ARENA.right + 30);
  foe.y = clamp(foe.y, ARENA.top - 30, ARENA.bottom + 30);

  foe.fireTimer -= dt;
  if (foe.fireTimer <= 0 && distance < 460) {
    foe.fireTimer = base.fireDelay * g.rng.range(0.85, 1.2);
    const aim = unitVector(p.x - foe.x, p.y - foe.y);
    g.enemyBullets.push({
      x: foe.x + aim.x * foe.radius,
      y: foe.y + aim.y * foe.radius,
      vx: aim.x * base.bulletSpeed,
      vy: aim.y * base.bulletSpeed,
      radius: BULLET.radius,
      life: BULLET.life,
      color: PALETTE.danger,
    });
    playSfx('shoot');
  }
}

// Enemy shots: they drift, they expire, and they sting the jelly once each.
export function updateEnemyBullets(g, dt) {
  const p = g.player;
  const kept = [];
  for (const bullet of g.enemyBullets) {
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.life <= 0 || bullet.x < -40 || bullet.x > 1320 || bullet.y < -40 || bullet.y > 760) continue;
    if (circlesHit(bullet.x, bullet.y, bullet.radius, p.x, p.y, p.radius)) {
      hurtLanternJelly(p, 1, bullet.x, bullet.y);
      burst(bullet.x, bullet.y, bullet.color, 7, { speed: 150, life: 0.35, size: 3 });
      continue;
    }
    kept.push(bullet);
  }
  g.enemyBullets = kept;
}

export function drawEnemyBullets(ctx, g) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of g.enemyBullets) {
    const glow = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, 14);
    glow.addColorStop(0, 'rgba(255, 160, 200, 0.9)');
    glow.addColorStop(1, 'rgba(255, 79, 147, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9e8';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Damage lands here: flash, nudge, and if that was the last hit, the death ritual
// (score with the combo multiplier, experience, drops, particles, sound).
export function hurtEnemy(g, e, dmg, fromX, fromY) {
  if (e.dead) return false;
  e.hp -= dmg;
  e.flash = 0.14;
  const away = unitVector(e.x - fromX, e.y - fromY);
  e.x += away.x * 3;
  e.y += away.y * 3;
  playSfx('hit');
  burst(fromX, fromY, e.color, 3, { speed: 110, life: 0.26, size: 2.3 });
  if (e.hp <= 0) {
    killSwimmer(g, e);
    return true;
  }
  return false;
}

function killSwimmer(g, e) {
  e.dead = true;
  g.kills += 1;
  g.combo = Math.min(g.combo + 1, TUNING.comboMax);
  g.comboTimer = TUNING.comboWindow;
  const multiplier = 1 + g.combo * TUNING.comboStep;
  const points = Math.round(e.score * multiplier);
  g.score += points;
  floatText(e.x, e.y, `+${points}`, g.combo > 3 ? PALETTE.gold : PALETTE.foam, g.combo > 3 ? 20 : 16);
  burst(e.x, e.y, e.color, 16, { speed: 210, life: 0.6, size: 4.2 });
  ringPulse(e.x, e.y, e.color, e.radius * 1.4, 0.45);
  playSfx('kill');
  spawnPlankton(g, e.x, e.y, e.xp);
  if (g.rng.chance(TUNING.pearlChance)) spawnPearl(g, e.x, e.y);
}

export function drawSwimmers(ctx, g, time) {
  for (const foe of g.enemies) {
    if (foe.dead) continue;
    switch (foe.type) {
      case 'siltling':
        drawSiltling(ctx, foe, time);
        break;
      case 'needlejaw':
        drawNeedlejaw(ctx, foe, time);
        break;
      case 'mawlet':
        drawMawlet(ctx, foe, time);
        break;
      case 'spitter':
        drawSpitter(ctx, foe, time);
        break;
      default:
        break;
    }
    if (foe.flash > 0) drawHitFlash(ctx, foe);
  }
}

function drawSiltling(ctx, foe, time) {
  const breathe = 1 + Math.sin(time * 5 + foe.wobble) * 0.08;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, foe.radius * 2);
  glow.addColorStop(0, 'rgba(160, 185, 235, 0.5)');
  glow.addColorStop(1, 'rgba(143, 164, 207, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = foe.color;
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * breathe, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = foe.core;
  ctx.beginPath();
  ctx.arc(-4, -2, 2.4, 0, Math.PI * 2);
  ctx.arc(4, -2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNeedlejaw(ctx, foe, time) {
  const angle = Math.atan2(foe.dirY || foe.vy || 0, foe.dirX || foe.vx || 1);
  const lunging = foe.phase === 'dash';
  const winding = foe.phase === 'windup';
  const stretch = lunging ? 1.5 : 1;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1);

  // Telegraph line during the windup.
  if (winding) {
    ctx.restore();
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = `rgba(255, 159, 104, ${0.35 + Math.sin(time * 30) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(foe.x, foe.y);
    ctx.lineTo(foe.x + foe.dirX * 320, foe.y + foe.dirY * 320);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.rotate(angle);
  }

  const body = winding && Math.floor(time * 20) % 2 === 0 ? '#ffe3c8' : foe.color;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(foe.radius * 1.5, 0);
  ctx.lineTo(-foe.radius * 0.9, -foe.radius * 0.85);
  ctx.lineTo(-foe.radius * 0.5, 0);
  ctx.lineTo(-foe.radius * 0.9, foe.radius * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = foe.core;
  ctx.beginPath();
  ctx.arc(foe.radius * 0.35, -2.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // The needle itself.
  ctx.strokeStyle = 'rgba(255, 245, 230, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-foe.radius * 0.2, 0);
  ctx.lineTo(foe.radius * 1.9, 0);
  ctx.stroke();
  ctx.restore();
}

function drawMawlet(ctx, foe, time) {
  const chomp = 0.5 + 0.5 * Math.sin(time * 4 + foe.wobble);
  ctx.save();
  ctx.translate(foe.x, foe.y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, foe.radius * 1.7);
  glow.addColorStop(0, 'rgba(169, 124, 255, 0.35)');
  glow.addColorStop(1, 'rgba(169, 124, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = foe.color;
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius, 0, Math.PI * 2);
  ctx.fill();
  // A mouth that opens and shuts on the swim stroke.
  ctx.fillStyle = foe.core;
  ctx.beginPath();
  ctx.ellipse(0, foe.radius * 0.2, foe.radius * 0.6, foe.radius * (0.16 + chomp * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240, 230, 255, 0.9)';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * foe.radius * 0.45, foe.radius * 0.05);
    ctx.lineTo(side * foe.radius * 0.3, foe.radius * 0.45);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * foe.radius * 0.42, -foe.radius * 0.34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1140';
    ctx.beginPath();
    ctx.arc(side * foe.radius * 0.42, -foe.radius * 0.34, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
  }
  ctx.restore();
  drawFoeBar(ctx, foe, foe.maxHp > 20);
}

function drawSpitter(ctx, foe, time) {
  const charge = foe.fireTimer < 0.55 ? 1 - foe.fireTimer / 0.55 : 0;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, foe.radius * 1.8);
  glow.addColorStop(0, `rgba(255, 111, 177, ${0.3 + charge * 0.4})`);
  glow.addColorStop(1, 'rgba(255, 111, 177, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = foe.color;
  ctx.beginPath();
  ctx.arc(0, -2, foe.radius * 0.85, Math.PI * 0.85, Math.PI * 2.15);
  ctx.quadraticCurveTo(foe.radius * 0.7, foe.radius * 0.75, 0, foe.radius * 0.55);
  ctx.quadraticCurveTo(-foe.radius * 0.7, foe.radius * 0.75, -foe.radius * 0.78, -2);
  ctx.closePath();
  ctx.fill();
  // Siphon aimed at the player, brightening as the shot charges.
  ctx.fillStyle = charge > 0 ? '#ffd9ec' : foe.core;
  ctx.beginPath();
  ctx.arc(0, 2, 4 + charge * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 200, 226, 0.8)';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * foe.radius * 0.5, foe.radius * 0.3);
    ctx.quadraticCurveTo(
      side * foe.radius * 0.9,
      foe.radius * (0.7 + Math.sin(time * 6 + side) * 0.14),
      side * foe.radius * 0.65,
      foe.radius * 1.05,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawHitFlash(ctx, foe) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255, 255, 255, ${foe.flash * 3})`;
  ctx.beginPath();
  ctx.arc(foe.x, foe.y, foe.radius * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A slim health bar above the tanky ones: damage should always be visible.
function drawFoeBar(ctx, foe, show) {
  if (!show || foe.hp >= foe.maxHp) return;
  const w = foe.radius * 1.7;
  const x = foe.x - w / 2;
  const y = foe.y - foe.radius - 12;
  ctx.fillStyle = 'rgba(3, 6, 15, 0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, 6);
  ctx.fillStyle = PALETTE.danger;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = PALETTE.mint;
  ctx.fillRect(x, y, w * Math.max(0, foe.hp / foe.maxHp), 4);
}
