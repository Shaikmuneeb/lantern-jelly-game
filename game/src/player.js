// The lantern jelly: drift physics with a snappy dash, light (health) handling, and
// its glow rendering. Movement reads the shared input; damage knockback and the
// invulnerability blink live here too so the feel of the player stays in one file.
import { VIEW, PLAYER, ARENA, PALETTE } from './config.js';
import { clamp, approach, unitVector } from './collision.js';
import { isDown, takePress, mouse, mousePosition as aimPoint } from './input.js';
import { burst, ringPulse, trailPuff } from './particles.js';
import { playSfx } from './audio.js';

export function createLanternJelly() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2 + 60,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    light: PLAYER.startLight,
    maxLight: PLAYER.startLight,
    // Upgrade-driven stats (upgrades.js mutates these).
    fireDelay: PLAYER.fireDelay,
    damage: PLAYER.pulseDamage,
    shots: 1,
    pierce: 0,
    speed: PLAYER.maxSpeed,
    magnet: PLAYER.magnet,
    dashDelay: PLAYER.dashDelay,
    orbs: 0,
    chain: 0,
    dashDmg: 0,
    // Transient state.
    dashTimer: 0,
    dashLeft: 0,
    dashDirX: 1,
    dashDirY: 0,
    invuln: 0,
    hurtFlash: 0,
    aim: -Math.PI / 2,
    walkPhase: 0,
  };
}

export function moveVector() {
  let x = 0;
  let y = 0;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  return unitVector(x, y);
}

function tryDash(p) {
  const pressed = takePress('ShiftLeft') || takePress('ShiftRight') || mouse.rightPressed;
  if (!pressed || p.dashTimer > 0 || p.dashLeft > 0) return;
  let dir = moveVector();
  if (dir.x === 0 && dir.y === 0) {
    const aim = aimPoint();
    dir = unitVector(aim.x - p.x, aim.y - p.y);
  }
  p.dashLeft = PLAYER.dashTime;
  p.dashTimer = p.dashDelay;
  p.dashDirX = dir.x;
  p.dashDirY = dir.y;
  p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.12);
  playSfx('dash');
  ringPulse(p.x, p.y, PALETTE.glow, 26, 0.32);
  burst(p.x, p.y, PALETTE.glow, 10, { speed: 240, life: 0.4, size: 3 });
}

export function updateLanternJelly(p, dt, time) {
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);
  p.dashTimer = Math.max(0, p.dashTimer - dt);

  tryDash(p);

  const aim = aimPoint();
  p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);

  if (p.dashLeft > 0) {
    p.dashLeft -= dt;
    p.vx = p.dashDirX * PLAYER.dashSpeed;
    p.vy = p.dashDirY * PLAYER.dashSpeed;
    trailPuff(p.x, p.y, PALETTE.glow, 6);
  } else {
    const dir = moveVector();
    const targetVx = dir.x * p.speed;
    const targetVy = dir.y * p.speed;
    const closing = PLAYER.accel * dt;
    p.vx = approach(p.vx, targetVx, closing);
    p.vy = approach(p.vy, targetVy, closing);
    if (dir.x !== 0 || dir.y !== 0) p.walkPhase += dt * 9;
    else p.walkPhase += dt * 3.2;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  confinePlayer(p);

  // Passive shimmer so the lantern always feels alive.
  if (Math.random() < dt * 6) {
    trailPuff(p.x + (Math.random() - 0.5) * 14, p.y + 12, 'rgba(102,242,255,0.5)', 2);
  }
}

function confinePlayer(p) {
  p.x = clamp(p.x, ARENA.left + p.radius, ARENA.right - p.radius);
  p.y = clamp(p.y, ARENA.top + p.radius, ARENA.bottom - p.radius);
}

export function hurtLanternJelly(p, damage, fromX, fromY) {
  if (p.invuln > 0 || p.dashLeft > 0 || p.light <= 0) return false;
  p.light -= damage;
  p.invuln = PLAYER.invulnTime;
  p.hurtFlash = 1;
  const away = unitVector(p.x - fromX, p.y - fromY);
  p.vx += away.x * 260;
  p.vy += away.y * 260;
  playSfx('hurt');
  burst(p.x, p.y, PALETTE.coral, 14, { speed: 220, life: 0.5 });
  ringPulse(p.x, p.y, PALETTE.coral, 30, 0.35);
  return true;
}

// The Thorn Halo upgrades: `p.orbs` barbs circle the jelly and sting whatever they touch,
// each enemy carrying its own short cooldown so the damage stays fair.
export function updateHalo(p, enemies, dt, time) {
  if (p.orbs <= 0) return;
  const positions = haloPositions(p, time);
  for (const e of enemies) {
    e.haloCd = Math.max(0, (e.haloCd ?? 0) - dt);
    if (e.haloCd > 0 || e.dead) continue;
    for (const pos of positions) {
      const reach = e.radius + 9;
      const dx = pos.x - e.x;
      const dy = pos.y - e.y;
      if (dx * dx + dy * dy <= reach * reach) {
        e.haloCd = 0.5;
        e.flash = 0.12;
        e.hp -= 4;
        burst(pos.x, pos.y, PALETTE.gold, 4, { speed: 90, life: 0.3, size: 2.4 });
        break;
      }
    }
  }
}

export function haloPositions(p, time) {
  const positions = [];
  for (let i = 0; i < p.orbs; i++) {
    const angle = time * 2.1 + (i * Math.PI * 2) / p.orbs;
    positions.push({ x: p.x + Math.cos(angle) * 54, y: p.y + Math.sin(angle) * 54 });
  }
  return positions;
}

export function drawHalo(ctx, p, time) {
  if (p.orbs <= 0) return;
  const positions = haloPositions(p, time);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 54, 0, Math.PI * 2);
  ctx.stroke();
  for (const pos of positions) {
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 12);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.9)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLanternJelly(ctx, p, time) {
  if (p.invuln > 0 && Math.floor(time * 18) % 2 === 0 && p.dashLeft <= 0) return;

  const bob = Math.sin(time * 3 + p.walkPhase) * 3;
  const squash = 1 + Math.sin(time * 3 + p.walkPhase) * 0.05;

  ctx.save();
  ctx.translate(p.x, p.y + bob);

  // The lantern glow: the jelly is a light source in a dark ocean.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowR = 60 + Math.sin(time * 4) * 7;
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
  glow.addColorStop(0, 'rgba(160, 250, 255, 0.55)');
  glow.addColorStop(0.4, 'rgba(102, 242, 255, 0.22)');
  glow.addColorStop(1, 'rgba(102, 242, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tentacles trail beneath, swaying with the swim stroke.
  ctx.strokeStyle = 'rgba(140, 244, 255, 0.75)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const swing = Math.sin(time * 5 + i * 1.3 + p.walkPhase) * 6;
    const rootX = (i - 2) * 6;
    ctx.lineWidth = 2.6 - Math.abs(i - 2) * 0.3;
    ctx.beginPath();
    ctx.moveTo(rootX, 8);
    ctx.quadraticCurveTo(rootX + swing, 20, rootX + swing * 1.6, 30 + (i % 2) * 6);
    ctx.stroke();
  }

  // The bell: a bright dome with a soft inner light.
  ctx.save();
  ctx.scale(1, squash);
  const bell = ctx.createLinearGradient(0, -18, 0, 12);
  bell.addColorStop(0, '#f4feff');
  bell.addColorStop(0.45, '#8ef4ff');
  bell.addColorStop(1, 'rgba(80, 210, 240, 0.85)');
  ctx.fillStyle = bell;
  ctx.beginPath();
  ctx.ellipse(0, -2, 17, 15, 0, Math.PI, 0);
  ctx.quadraticCurveTo(17, 10, 9, 9);
  ctx.quadraticCurveTo(0, 14, -9, 9);
  ctx.quadraticCurveTo(-17, 10, -17, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // Eyes lean toward the aim so the jelly reads as player-controlled.
  const look = p.aim;
  ctx.fillStyle = '#08203a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 5.5 + Math.cos(look) * 1.6, -5 + Math.sin(look) * 1.6, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
