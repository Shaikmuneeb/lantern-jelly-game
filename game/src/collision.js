// Circle collision and small vector helpers: every creature in the arena is a disc,
// so hits are a squared-distance test and movement is plain vector math.
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function circlesHit(ax, ay, ar, bx, by, br) {
  const reach = ar + br;
  return dist2(ax, ay, bx, by) <= reach * reach;
}

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lengthOf(x, y) {
  return Math.hypot(x, y);
}

export function unitVector(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// Move `current` toward `target` by at most `step` (frame-rate independent approach).
export function approach(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return current;
}

// Keep a point inside the arena, nudged back by `pad` from each wall.
export function confine(point, bounds, pad) {
  point.x = clamp(point.x, bounds.left + pad, bounds.right - pad);
  point.y = clamp(point.y, bounds.top + pad, bounds.bottom - pad);
  return point;
}
