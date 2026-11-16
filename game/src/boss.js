// The Abyssal Maw: the goal of the whole dive. It lives in the shared enemies array
// (so shots, the halo and contact rules all treat it like anything else) while its
// phased behaviour — chase, telegraphed charges, volleys, summons and the enrage —
// is driven here by updateMaw, and its colossal drawing by drawMaw.
import { BOSS, ARENA, PALETTE } from './config.js';
import { unitVector, clamp } from './collision.js';
import { burst, ringPulse, floatText } from './particles.js';
import { playSfx } from './audio.js';
import { spawnSwimmer, spawnRingFor } from './enemies.js';

export function createMaw(g, x, y) {
  const maw = {
    type: 'maw',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: BOSS.radius,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    score: BOSS.score,
    xp: BOSS.xp,
    touch: BOSS.touch,
    color: BOSS.rim,
    flash: 0,
    dead: false,
    defeated: false,
    haloCd: 0,
    state: 'enter',
    timer: 1.4,
    chargeTimer: 4.2,
    volleyTimer: BOSS.volleyDelay,
    summonTimer: BOSS.summonDelay,
    dirX: 0,
    dirY: -1,
    enraged: false,
  };
  g.enemies.push(maw);
  g.boss = maw;
  ringPulse(x, y, BOSS.rim, 90, 0.9);
  return maw;
}

export function updateMaw(g, dt, time) {
  const b = g.boss;
  if (!b || b.dead) return;
  const p = g.player;
  const ratio = b.hp / b.maxHp;

  if (!b.enraged && ratio <= BOSS.enrageAt) {
    b.enraged = true;
    playSfx('boss');
    floatText(b.x, b.y - b.radius - 30, 'IT RAGES', PALETTE.danger, 26);
    ringPulse(b.x, b.y, PALETTE.danger, 70, 0.7);
  }

  const pace = b.enraged ? 1.45 : 1;
  b.timer -= dt;
  b.chargeTimer -= dt * pace;
  b.volleyTimer -= dt * pace;
  b.summonTimer -= dt * pace;

  const toPlayer = unitVector(p.x - b.x, p.y - b.y);
  const toCenter = unitVector(640 - b.x, 360 - b.y);
  b.faceAngle = Math.atan2(toPlayer.y, toPlayer.x);

  if (b.state === 'enter') {
    b.x += toCenter.x * 150 * dt;
    b.y += toCenter.y * 150 * dt;
    if (b.timer <= 0) {
      b.state = 'chase';
      b.timer = 0.4;
    }
  } else if (b.state === 'chase') {
    const sway = Math.sin(time * 1.7) * 0.4;
    b.x += (toPlayer.x - toPlayer.y * sway) * BOSS.driftSpeed * pace * dt;
    b.y += (toPlayer.y + toPlayer.x * sway) * BOSS.driftSpeed * pace * dt;
    if (b.chargeTimer <= 0) {
      b.state = 'windup';
      b.timer = BOSS.chargeWindup;
      const predict = unitVector(p.x + p.vx * 0.3 - b.x, p.y + p.vy * 0.3 - b.y);
      b.dirX = predict.x;
      b.dirY = predict.y;
      playSfx('boss');
    }
  } else if (b.state === 'windup') {
    b.x -= b.dirX * 40 * dt;
    b.y -= b.dirY * 40 * dt;
    if (b.timer <= 0) {
      b.state = 'charge';
      b.timer = BOSS.chargeTime;
      playSfx('dash');
    }
  } else if (b.state === 'charge') {
    b.x += b.dirX * BOSS.chargeSpeed * pace * dt;
    b.y += b.dirY * BOSS.chargeSpeed * pace * dt;
    if (Math.random() < dt * 30) burst(b.x - b.dirX * 40, b.y - b.dirY * 40, BOSS.rim, 2, { speed: 90, life: 0.4, size: 4 });
    if (b.timer <= 0) {
      b.state = 'chase';
      b.chargeTimer = b.enraged ? 2.6 : 4.2;
    }
  }

  b.x = clamp(b.x, ARENA.left + b.radius * 0.7, ARENA.right - b.radius * 0.7);
  b.y = clamp(b.y, ARENA.top + b.radius * 0.7, ARENA.bottom - b.radius * 0.7);

  if (b.state !== 'windup' && b.volleyTimer <= 0) {
    fireVolley(g, b, time);
    b.volleyTimer = BOSS.volleyDelay * (b.enraged ? 0.65 : 1);
  }
  if (b.summonTimer <= 0 && g.enemies.length < 16) {
    summonAdds(g, b);
    b.summonTimer = BOSS.summonDelay * (b.enraged ? 0.75 : 1);
  }
}

function fireVolley(g, b, time) {
  const count = BOSS.volleyCount;
  const offset = time * 0.9;
  for (let i = 0; i < count; i++) {
    const angle = offset + (i * Math.PI * 2) / count;
    g.enemyBullets.push({
      x: b.x + Math.cos(angle) * b.radius * 0.8,
      y: b.y + Math.sin(angle) * b.radius * 0.8,
      vx: Math.cos(angle) * BOSS.bulletSpeed,
      vy: Math.sin(angle) * BOSS.bulletSpeed,
      radius: 8,
      life: 4,
      color: PALETTE.violet,
    });
  }
  playSfx('wave');
  ringPulse(b.x, b.y, BOSS.maw, 50, 0.4);
}

function summonAdds(g, b) {
  for (let i = 0; i < BOSS.summonCount; i++) {
    const angle = (i / BOSS.summonCount) * Math.PI * 2 + b.x * 0.01;
    const x = clamp(b.x + Math.cos(angle) * 170, ARENA.left + 30, ARENA.right - 30);
    const y = clamp(b.y + Math.sin(angle) * 170, ARENA.top + 30, ARENA.bottom - 30);
    const add = spawnSwimmer(g, 'siltling', x, y);
    spawnRingFor(add);
  }
  playSfx('wave');
}

export function drawMaw(ctx, b, time) {
  if (!b || b.dead) return;
  const p = b.state;
  const toPlayer = b.faceAngle ?? 0;

  ctx.save();
  ctx.translate(b.x, b.y);

  // Presence glow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.5 + Math.sin(time * (b.enraged ? 7 : 3)) * 0.2;
  const glow = ctx.createRadialGradient(0, 0, b.radius * 0.4, 0, 0, b.radius * 2.3);
  glow.addColorStop(0, `rgba(196, 107, 255, ${0.35 * pulse})`);
  glow.addColorStop(1, 'rgba(196, 107, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, b.radius * 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Swaying spines around the rim.
  ctx.strokeStyle = b.enraged ? 'rgba(255, 95, 143, 0.85)' : 'rgba(196, 107, 255, 0.7)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const baseAngle = (i / 12) * Math.PI * 2;
    const wob = Math.sin(time * 2.4 + i) * 0.16;
    const inner = b.radius - 4;
    const outer = b.radius + 26 + Math.sin(time * 3 + i * 1.7) * 8;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(baseAngle) * inner, Math.sin(baseAngle) * inner);
    ctx.quadraticCurveTo(
      Math.cos(baseAngle + wob) * (inner + outer) * 0.5,
      Math.sin(baseAngle + wob) * (inner + outer) * 0.5,
      Math.cos(baseAngle + wob * 1.6) * outer,
      Math.sin(baseAngle + wob * 1.6) * outer,
    );
    ctx.stroke();
  }

  // Body.
  const body = ctx.createRadialGradient(-b.radius * 0.3, -b.radius * 0.35, b.radius * 0.1, 0, 0, b.radius);
  body.addColorStop(0, '#332a75');
  body.addColorStop(0.6, BOSS.color);
  body.addColorStop(1, '#0d0a30');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
  ctx.fill();
  const rimGlow = p === 'windup' || b.enraged ? 0.95 : 0.6;
  ctx.strokeStyle = p === 'windup' && Math.floor(time * 16) % 2 === 0 ? '#ffffff' : hexAlpha(BOSS.rim, rimGlow);
  ctx.lineWidth = 4;
  ctx.stroke();

  // The maw: opens wide to telegraph, bites shut while charging.
  ctx.rotate(toPlayer);
  const open = p === 'windup' ? 1 : p === 'charge' ? 0.15 : 0.35 + 0.3 * Math.sin(time * 3.2);
  ctx.fillStyle = '#2a0722';
  ctx.beginPath();
  ctx.ellipse(b.radius * 0.28, 0, b.radius * 0.58, b.radius * 0.5 * open + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOSS.maw;
  ctx.beginPath();
  ctx.ellipse(b.radius * 0.3, 0, b.radius * 0.5, b.radius * 0.44 * open + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Teeth on both lips of the gape.
  ctx.fillStyle = '#fff3f7';
  const teeth = 6;
  const jaw = b.radius * 0.44 * open + 4;
  for (let i = 0; i < teeth; i++) {
    const tx = b.radius * 0.3 - b.radius * 0.44 + (i / (teeth - 1)) * b.radius * 0.88;
    ctx.beginPath();
    ctx.moveTo(tx - 7, -jaw);
    ctx.lineTo(tx + 7, -jaw);
    ctx.lineTo(tx, -jaw + 16 * (0.4 + open * 0.6));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - 7, jaw);
    ctx.lineTo(tx + 7, jaw);
    ctx.lineTo(tx, jaw - 16 * (0.4 + open * 0.6));
    ctx.closePath();
    ctx.fill();
  }
  ctx.rotate(-toPlayer);

  // One huge eye that tracks the jelly, slitting when it winds up.
  const eyeX = -b.radius * 0.32;
  const eyeY = -b.radius * 0.18;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 1, eyeX, eyeY, 22);
  eyeGlow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  eyeGlow.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOSS.eye;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#150b20';
  const slit = p === 'windup' ? 1.6 : 4;
  ctx.beginPath();
  ctx.ellipse(eyeX + Math.cos(toPlayer) * 3, eyeY + Math.sin(toPlayer) * 3, slit, 7, toPlayer, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (b.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 255, 255, ${b.flash * 2.6})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 1.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function hexAlpha(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
