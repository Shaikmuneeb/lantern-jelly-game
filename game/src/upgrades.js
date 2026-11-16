// Growth between the waves: experience, level-ups and the pick-one-of-three cards that
// change how the jelly swims, shoots and survives. Rolling, applying and drawing the
// cards all live here; main.js only decides when a level-up opens.
import { UPGRADES, TUNING, PLAYER, PALETTE } from './config.js';
import { playSfx } from './audio.js';

const CARD_W = 280;
const CARD_H = 336;
const CARD_GAP = 44;

export function createUpgradeState() {
  return {
    level: 1,
    xp: 0,
    xpNext: TUNING.xpForLevel(1),
    pending: 0,
    counts: {},
    cards: [],
    hover: -1,
  };
}

export function grantXp(g, amount) {
  const upg = g.upg;
  upg.xp += amount;
  while (upg.xp >= upg.xpNext) {
    upg.xp -= upg.xpNext;
    upg.level += 1;
    upg.pending += 1;
    upg.xpNext = TUNING.xpForLevel(upg.level);
  }
}

// Three distinct upgrades the jelly has room left to take.
export function rollChoices(upg, rng) {
  const open = UPGRADES.filter((card) => (upg.counts[card.id] ?? 0) < card.max);
  const picked = [];
  while (picked.length < 3 && open.length > 0) {
    const index = rng.int(0, open.length - 1);
    picked.push(open[index]);
    open.splice(index, 1);
  }
  return picked;
}

export function applyUpgrade(g, card) {
  const p = g.player;
  const upg = g.upg;
  upg.counts[card.id] = (upg.counts[card.id] ?? 0) + 1;
  switch (card.id) {
    case 'rapid':
      p.fireDelay = Math.max(0.09, p.fireDelay * 0.8);
      break;
    case 'shards':
      p.shots += 1;
      break;
    case 'core':
      p.damage += 2;
      break;
    case 'drift':
      p.speed *= 1.15;
      break;
    case 'pierce':
      p.pierce += 1;
      break;
    case 'lure':
      p.magnet += PLAYER.magnet * 0.6;
      break;
    case 'wind':
      p.maxLight += 1;
      p.light = Math.min(p.maxLight, p.light + 2);
      break;
    case 'blink':
      p.dashDelay = Math.max(0.45, p.dashDelay * 0.7);
      break;
    case 'halo':
      p.orbs += 1;
      break;
    case 'chain':
      p.chain += 1;
      break;
    case 'ravage':
      p.dashDmg += 8;
      break;
    default:
      break;
  }
}

export function cardRects(count) {
  const total = count * CARD_W + (count - 1) * CARD_GAP;
  const startX = (1280 - total) / 2;
  const y = (720 - CARD_H) / 2 + 10;
  const rects = [];
  for (let i = 0; i < count; i++) {
    rects.push({ x: startX + i * (CARD_W + CARD_GAP), y, w: CARD_W, h: CARD_H });
  }
  return rects;
}

export function drawUpgradeCards(ctx, upg, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 5, 14, 0.72)';
  ctx.fillRect(0, 0, 1280, 720);

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.foam;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('The current carries you — choose a gift', 640, 108);
  ctx.font = '500 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(234, 247, 255, 0.75)';
  ctx.fillText('click a card, or press 1 · 2 · 3', 640, 140);

  const rects = cardRects(upg.cards.length);
  upg.cards.forEach((card, i) => {
    const r = rects[i];
    const hovered = upg.hover === i;
    const lift = hovered ? -6 : 0;
    const glow = hovered ? 0.9 : 0.4;

    ctx.save();
    ctx.translate(0, lift);

    // Panel.
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = hovered ? 'rgba(14, 26, 58, 0.96)' : PALETTE.uiPanel;
    ctx.fill();
    ctx.strokeStyle = `rgba(102, 242, 255, ${glow})`;
    ctx.lineWidth = hovered ? 3 : 1.5;
    ctx.stroke();

    // Glyph medallion.
    const cx = r.x + r.w / 2;
    const cy = r.y + 88;
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 54);
    halo.addColorStop(0, 'rgba(102, 242, 255, 0.35)');
    halo.addColorStop(1, 'rgba(102, 242, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.fill();
    drawGlyph(ctx, card.id, cx, cy, 34);

    // Text.
    ctx.fillStyle = PALETTE.foam;
    ctx.font = '800 23px system-ui, sans-serif';
    ctx.fillText(card.name, cx, r.y + 182);
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(190, 236, 255, 0.85)';
    wrapCenter(ctx, card.blurb, cx, r.y + 214, r.w - 44, 22);

    // Stack count and key hint.
    const owned = upg.counts[card.id] ?? 0;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
    ctx.fillText(`owned ${owned} / ${card.max}`, cx, r.y + r.h - 56);
    ctx.fillStyle = hovered ? PALETTE.glow : 'rgba(234, 247, 255, 0.55)';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText(`${i + 1}`, cx, r.y + r.h - 22);

    ctx.restore();
  });

  ctx.restore();
}

// Small glyphs for each upgrade — drawn, not written, so no image files are needed.
export function drawGlyph(ctx, id, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = PALETTE.glow;
  ctx.fillStyle = PALETTE.glow;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'rapid':
      for (const dx of [-10, 2, 14]) {
        ctx.beginPath();
        ctx.moveTo(dx - 6, -10);
        ctx.lineTo(dx + 4, 0);
        ctx.lineTo(dx - 6, 10);
        ctx.stroke();
      }
      break;
    case 'shards':
      for (const angle of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
      break;
    case 'core':
      star(ctx, 0, 0, r * 0.9, r * 0.4, 5);
      ctx.fill();
      break;
    case 'drift':
      for (const dy of [-9, 0, 9]) {
        ctx.beginPath();
        ctx.moveTo(-r + 4, dy);
        ctx.quadraticCurveTo(-4, dy - 7, 4, dy);
        ctx.quadraticCurveTo(r - 8, dy + 7, r - 2, dy);
        ctx.stroke();
      }
      break;
    case 'pierce':
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r - 4, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r - 12, -8);
      ctx.lineTo(r - 2, 0);
      ctx.lineTo(r - 12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, -14);
      ctx.lineTo(-4, 14);
      ctx.stroke();
      break;
    case 'lure':
      for (const ring of [7, 15, 23]) {
        ctx.globalAlpha = 1 - ring / 32;
        ctx.beginPath();
        ctx.arc(0, 0, ring, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wind':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.75, -r * 0.7, r * 0.75, 0);
      ctx.quadraticCurveTo(r * 0.75, r * 0.6, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.75, r * 0.6, -r * 0.75, 0);
      ctx.quadraticCurveTo(-r * 0.75, -r * 0.7, 0, -r * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(10, -2);
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 8);
      ctx.stroke();
      break;
    case 'blink':
      ctx.beginPath();
      ctx.moveTo(-r, 8);
      ctx.lineTo(-6, -4);
      ctx.lineTo(2, 6);
      ctx.lineTo(r, -8);
      ctx.stroke();
      break;
    case 'halo':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.75, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'chain':
      ctx.beginPath();
      ctx.moveTo(4, -r);
      ctx.lineTo(-8, 2);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, r);
      ctx.lineTo(10, -4);
      ctx.lineTo(2, -4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ravage':
      for (const angle of [-2.4, -1.9, -1.35, -0.8, -0.25]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}

// The earned-upgrades ribbon on the HUD: glyph chips with their stack counts.
export function drawChosenRow(ctx, counts, x, y) {
  const owned = UPGRADES.filter((card) => (counts[card.id] ?? 0) > 0);
  owned.forEach((card, i) => {
    const cx = x + (i % 6) * 44;
    const cy = y + Math.floor(i / 6) * 44;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7, 12, 34, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(102, 242, 255, 0.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    drawGlyph(ctx, card.id, cx, cy, 11);
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`×${counts[card.id]}`, cx + 17, cy + 16);
    ctx.restore();
  });
}

function star(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCenter(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}
