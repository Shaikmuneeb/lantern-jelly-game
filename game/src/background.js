// The abyss backdrop: a vertical gradient, two slowly swinging shafts of surface light,
// silhouetted kelp and a drift of parallax plankton motes. Seeded once so a screenshot
// scene draws the same seascape every time, then animated on the sim clock alone.
import { VIEW, PALETTE } from './config.js';

let shafts = [];
let motes = [];
let kelp = [];

export function initBackground(rng) {
  shafts = [
    { x: VIEW.width * 0.24, lean: -0.35, width: 150, phase: 0.0 },
    { x: VIEW.width * 0.68, lean: 0.42, width: 210, phase: 2.1 },
    { x: VIEW.width * 0.48, lean: 0.1, width: 90, phase: 4.0 },
  ];
  motes = [];
  for (let i = 0; i < 90; i++) {
    motes.push({
      x: rng.range(0, VIEW.width),
      y: rng.range(0, VIEW.height),
      r: rng.range(0.6, 2.2),
      speed: rng.range(3, 14),
      sway: rng.range(0.4, 1.6),
      alpha: rng.range(0.12, 0.5),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  kelp = [];
  for (let i = 0; i < 7; i++) {
    kelp.push({
      x: (i + 0.5) * (VIEW.width / 7) + rng.range(-40, 40),
      h: rng.range(90, 210),
      blades: rng.int(3, 5),
      lean: rng.range(-18, 18),
      phase: rng.range(0, Math.PI * 2),
    });
  }
}

export function updateBackground(dt, time) {
  for (const mote of motes) {
    mote.y -= mote.speed * dt;
    if (mote.y < -4) {
      mote.y = VIEW.height + 4;
      mote.x = (mote.x * 1.618) % VIEW.width;
    }
  }
}

export function drawBackground(ctx, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, '#060c22');
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Shafts of light from the surface, swinging gently.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const shaft of shafts) {
    const lean = shaft.lean + Math.sin(time * 0.14 + shaft.phase) * 0.08;
    const alpha = 0.05 + (Math.sin(time * 0.3 + shaft.phase) + 1) * 0.02;
    const grad = ctx.createLinearGradient(shaft.x, 0, shaft.x + lean * VIEW.height, VIEW.height);
    grad.addColorStop(0, `rgba(140, 240, 255, ${alpha})`);
    grad.addColorStop(1, 'rgba(140, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(shaft.x - shaft.width * 0.3, -10);
    ctx.lineTo(shaft.x + shaft.width * 0.3, -10);
    ctx.lineTo(shaft.x + lean * VIEW.height + shaft.width, VIEW.height + 10);
    ctx.lineTo(shaft.x + lean * VIEW.height - shaft.width, VIEW.height + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawKelp(ctx, time);
  drawMotes(ctx);
  drawRim(ctx, time);
}

function drawKelp(ctx, time) {
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 26, 40, 0.85)';
  ctx.lineCap = 'round';
  for (const plant of kelp) {
    const baseY = VIEW.height + 6;
    for (let b = 0; b < plant.blades; b++) {
      const spread = (b - (plant.blades - 1) / 2) * 9;
      const sway = Math.sin(time * 0.5 + plant.phase + b) * (10 + b * 3);
      ctx.lineWidth = 7 - b * 0.8;
      ctx.beginPath();
      ctx.moveTo(plant.x + spread, baseY);
      ctx.quadraticCurveTo(
        plant.x + spread + plant.lean * 0.4 + sway * 0.5,
        baseY - plant.h * 0.55,
        plant.x + spread + plant.lean + sway,
        baseY - plant.h,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMotes(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const mote of motes) {
    const twinkle = 0.6 + 0.4 * Math.sin(mote.phase + mote.y * 0.02);
    ctx.fillStyle = `rgba(150, 230, 255, ${mote.alpha * twinkle})`;
    ctx.beginPath();
    ctx.arc(mote.x + Math.sin(mote.phase + mote.y * 0.01) * 8, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The lantern's reach: a soft rim glow around the arena keeps the action readable.
function drawRim(ctx, time) {
  ctx.save();
  const pulse = 0.22 + Math.sin(time * 0.8) * 0.05;
  ctx.strokeStyle = `rgba(102, 242, 255, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, VIEW.width - 24, VIEW.height - 24);
  const vignette = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();
}
