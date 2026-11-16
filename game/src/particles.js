// Particles and floating text: pooled sparks, expanding rings and score numbers that
// rise and fade. Drawn additively so hits and deaths glow against the dark water.
const sparks = [];
const rings = [];
const floats = [];

const SPARK_CAP = 600;
const RING_CAP = 40;
const FLOAT_CAP = 40;

export function clearParticles() {
  sparks.length = 0;
  rings.length = 0;
  floats.length = 0;
}

// Score numbers only: endings clear theirs so no rising "+2250" sits on the subtitle.
export function clearFloats() {
  floats.length = 0;
}

export function burst(x, y, color, count, opts = {}) {
  const speed = opts.speed ?? 170;
  const life = opts.life ?? 0.55;
  const size = opts.size ?? 3.4;
  const spread = opts.spread ?? Math.PI * 2;
  const dir = opts.dir ?? 0;
  for (let i = 0; i < count; i++) {
    if (sparks.length >= SPARK_CAP) sparks.shift();
    const angle = dir + (Math.random() - 0.5) * spread;
    const velocity = speed * (0.35 + Math.random() * 0.75);
    sparks.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.7 + Math.random() * 0.6),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
    });
  }
}

export function ringPulse(x, y, color, size = 30, life = 0.4) {
  if (rings.length >= RING_CAP) rings.shift();
  rings.push({ x, y, color, size, life, maxLife: life });
}

export function floatText(x, y, text, color = '#eaf7ff', size = 17) {
  if (floats.length >= FLOAT_CAP) floats.shift();
  floats.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

export function trailPuff(x, y, color, size = 5) {
  if (sparks.length >= SPARK_CAP) sparks.shift();
  sparks.push({
    x, y,
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
    life: 0.4,
    maxLife: 0.4,
    size,
    color,
  });
}

export function updateParticles(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= dt;
    if (p.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
    p.vy -= 14 * dt; // bubbles and sparks both drift upward in cold water
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].life -= dt;
    if (rings[i].life <= 0) rings.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    if (f.life <= 0) {
      floats.splice(i, 1);
      continue;
    }
    f.y -= 42 * dt;
  }
}

export function drawParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ring of rings) {
    const t = 1 - ring.life / ring.maxLife;
    ctx.strokeStyle = withAlpha(ring.color, (1 - t) * 0.8);
    ctx.lineWidth = 3 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.size * (0.3 + t * 1.1), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const p of sparks) {
    const t = p.life / p.maxLife;
    ctx.fillStyle = withAlpha(p.color, t * 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floats) {
    const t = f.life / f.maxLife;
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = `800 ${f.size}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(3, 6, 15, 0.8)';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function withAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
