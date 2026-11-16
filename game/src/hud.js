// The HUD: light (health), dash charge, score and best, the wave pill, the Maw's bar,
// experience, earned-upgrade chips, the combo meter, wave banners and the key hints.
// Everything the player needs to read at a glance during a fight lives in this file.
import { PALETTE, VIEW, TUNING } from './config.js';
import { directorCounts } from './director.js';
import { drawChosenRow } from './upgrades.js';
import { isMuted } from './audio.js';

export function drawHud(ctx, g) {
  const p = g.player;
  drawLightDroplets(ctx, p);
  drawDashMeter(ctx, p);
  drawScoreBlock(ctx, g);
  drawWavePill(ctx, g);
  drawBossBar(ctx, g);
  drawExperience(ctx, g);
  drawChosenRow(ctx, g.upg.counts, 52, 596);
  drawCombo(ctx, g);
  drawBanner(ctx, g);
  drawKeyHints(ctx, g);
  drawMuteTag(ctx);
}

function text(ctx, value, x, y, font, fill, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function stroked(ctx, value, x, y, font, fill, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(2, 5, 14, 0.85)';
  ctx.lineWidth = 4;
  ctx.strokeText(value, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(value, x, y);
}

// Light shown as droplets of lantern-glow: filled, empty, one pixel of shine each.
function drawLightDroplets(ctx, p) {
  text(ctx, 'LIGHT', 34, 34, '800 12px system-ui, sans-serif', 'rgba(150, 230, 255, 0.75)');
  for (let i = 0; i < p.maxLight; i++) {
    const x = 40 + i * 30;
    const y = 56;
    const filled = i < p.light;
    ctx.save();
    if (filled) {
      ctx.shadowColor = 'rgba(125, 249, 201, 0.9)';
      ctx.shadowBlur = 10;
      const grad = ctx.createRadialGradient(x - 3, y - 5, 1, x, y, 11);
      grad.addColorStop(0, '#eafff5');
      grad.addColorStop(0.55, PALETTE.mint);
      grad.addColorStop(1, '#2f9f85');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(20, 40, 60, 0.55)';
    }
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.bezierCurveTo(x + 9, y - 1, x + 9, y + 9, x, y + 10);
    ctx.bezierCurveTo(x - 9, y + 9, x - 9, y - 1, x, y - 11);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = filled ? 'rgba(255,255,255,0.8)' : 'rgba(120, 170, 210, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
}

function drawDashMeter(ctx, p) {
  const x = 34;
  const y = 84;
  const w = 124;
  const h = 9;
  const ready = 1 - Math.min(1, p.dashTimer / p.dashDelay);
  text(ctx, 'DASH', x, y - 5, '800 11px system-ui, sans-serif', 'rgba(150, 230, 255, 0.6)');
  ctx.fillStyle = 'rgba(4, 10, 26, 0.8)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = ready >= 1 ? PALETTE.glow : 'rgba(102, 242, 255, 0.45)';
  roundRect(ctx, x + 1, y + 1, (w - 2) * ready, h - 2, 3);
  ctx.fill();
  if (ready >= 1) {
    text(ctx, 'READY', x + w + 8, y + 9, '800 11px system-ui, sans-serif', PALETTE.glow);
  }
}

function drawScoreBlock(ctx, g) {
  const x = VIEW.width - 36;
  text(ctx, 'SCORE', x, 34, '800 12px system-ui, sans-serif', 'rgba(255, 209, 102, 0.8)', 'right');
  stroked(ctx, formatNumber(g.score), x, 66, '900 32px system-ui, sans-serif', PALETTE.gold, 'right');
  text(ctx, `BEST ${formatNumber(g.best)}`, x, 88, '700 14px system-ui, sans-serif', 'rgba(234, 247, 255, 0.65)', 'right');
}

function drawWavePill(ctx, g) {
  const counts = directorCounts(g);
  const w = 200;
  const x = VIEW.width / 2 - w / 2;
  const y = 22;
  ctx.fillStyle = PALETTE.uiPanel;
  roundRect(ctx, x, y, w, 38, 19);
  ctx.fill();
  ctx.strokeStyle = PALETTE.uiLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const waveLabel = counts.wave === 0 ? 'PREPARING' : `WAVE ${counts.wave} / ${counts.totalWaves}`;
  stroked(ctx, waveLabel, VIEW.width / 2, y + 25, '800 17px system-ui, sans-serif', PALETTE.foam, 'center');
  if (counts.wave > 0 && counts.wave < counts.totalWaves) {
    const foes = counts.alive + counts.scheduled;
    text(ctx, `${foes} still in the dark`, VIEW.width / 2, y + 54, '600 13px system-ui, sans-serif', 'rgba(190, 236, 255, 0.7)', 'center');
  }
}

function drawBossBar(ctx, g) {
  const b = g.boss;
  if (!b || b.dead) return;
  const w = 520;
  const x = VIEW.width / 2 - w / 2;
  const y = 96;
  text(ctx, 'THE ABYSSAL MAW', VIEW.width / 2, y - 6, '900 14px system-ui, sans-serif', 'rgba(255, 170, 210, 0.95)', 'center');
  ctx.fillStyle = 'rgba(4, 8, 24, 0.85)';
  roundRect(ctx, x, y, w, 16, 8);
  ctx.fill();
  const ratio = Math.max(0, b.hp / b.maxHp);
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, PALETTE.danger);
  grad.addColorStop(1, PALETTE.violet);
  ctx.fillStyle = grad;
  roundRect(ctx, x + 2, y + 2, (w - 4) * ratio, 12, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 240, 0.55)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, 16, 8);
  ctx.stroke();
}

function drawExperience(ctx, g) {
  const upg = g.upg;
  const x = 34;
  const y = 686;
  const w = 300;
  const h = 12;
  stroked(ctx, `LV ${upg.level}`, x, y - 8, '900 16px system-ui, sans-serif', PALETTE.foam);
  const nextLabel = `next ${upg.xp} / ${upg.xpNext}`;
  text(ctx, nextLabel, x + w, y - 8, '700 13px system-ui, sans-serif', 'rgba(150, 230, 255, 0.75)', 'right');
  ctx.fillStyle = 'rgba(4, 10, 26, 0.85)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  const ratio = Math.max(0, Math.min(1, upg.xp / upg.xpNext));
  ctx.fillStyle = PALETTE.mint;
  roundRect(ctx, x + 1.5, y + 1.5, (w - 3) * ratio, h - 3, 5);
  ctx.fill();
}

function drawCombo(ctx, g) {
  if (g.combo <= 1 || g.comboTimer <= 0) return;
  const x = VIEW.width - 36;
  const y = 130;
  const alpha = Math.min(1, g.comboTimer / TUNING.comboWindow);
  ctx.save();
  ctx.globalAlpha = alpha;
  stroked(ctx, `×${g.combo}`, x, y, '900 34px system-ui, sans-serif', PALETTE.coral, 'right');
  const w = 92;
  const ratio = g.comboTimer / 3;
  ctx.fillStyle = 'rgba(4, 10, 26, 0.8)';
  roundRect(ctx, x - w, y + 10, w, 7, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.coral;
  roundRect(ctx, x - w, y + 10, w * ratio, 7, 3);
  ctx.fill();
  text(ctx, 'CHAIN', x, y - 10, '800 11px system-ui, sans-serif', 'rgba(255, 160, 170, 0.85)', 'right');
  ctx.restore();
}

function drawBanner(ctx, g) {
  const b = g.banner;
  if (!b) return;
  const fadeIn = Math.min(1, b.t / 0.35);
  const fadeOut = Math.min(1, (b.dur - b.t) / 0.5);
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
  const rise = (1 - fadeIn) * 18;
  ctx.save();
  ctx.globalAlpha = alpha;
  stroked(ctx, b.text, VIEW.width / 2, 260 + rise, '900 54px system-ui, sans-serif', PALETTE.foam, 'center');
  stroked(ctx, b.sub, VIEW.width / 2, 302 + rise, '700 22px system-ui, sans-serif', PALETTE.glow, 'center');
  ctx.restore();
}

function drawKeyHints(ctx, g) {
  if (g.time > 14 || g.director.wave > 2) return;
  ctx.save();
  ctx.globalAlpha = g.time > 11 ? 1 - (g.time - 11) / 3 : 0.9;
  text(ctx, 'WASD / arrows  move   ·   mouse or space  fire   ·   shift  dash', VIEW.width - 34, 664, '700 14px system-ui, sans-serif', 'rgba(190, 236, 255, 0.8)', 'right');
  text(ctx, 'P  pause   ·   M  mute   ·   collect plankton to grow', VIEW.width - 34, 686, '700 14px system-ui, sans-serif', 'rgba(190, 236, 255, 0.6)', 'right');
  ctx.restore();
}

function drawMuteTag(ctx) {
  if (!isMuted()) return;
  text(ctx, 'MUTED', VIEW.width - 34, VIEW.height - 18, '800 13px system-ui, sans-serif', 'rgba(255, 209, 102, 0.85)', 'right');
}

export function formatNumber(value) {
  const n = Math.round(value);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
