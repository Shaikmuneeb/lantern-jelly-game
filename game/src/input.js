// Keyboard and mouse state: keys are edge-tracked (isDown for held, takePress for the
// moment it went in) and the mouse is reported in canvas coordinates, scaled from CSS.
import { VIEW } from './config.js';

const down = new Set();
const pressed = new Set();
const released = new Set();

export const mouse = {
  x: VIEW.width / 2,
  y: VIEW.height / 2,
  down: false,
  pressed: false,
  rightPressed: false,
};

// When a screenshot scene scripts input, these hold the frame's fake state instead.
let scripted = null;

export function setScriptedInput(frame) {
  scripted = frame;
}

export function isDown(code) {
  if (scripted && scripted.keys) return scripted.keys.includes(code);
  return down.has(code);
}

export function takePress(code) {
  if (scripted && scripted.press) return scripted.press.includes(code);
  if (pressed.has(code)) {
    pressed.delete(code);
    return true;
  }
  return false;
}

export function clearPresses() {
  pressed.clear();
  released.clear();
  mouse.pressed = false;
  mouse.rightPressed = false;
}

export function mousePosition() {
  if (scripted && scripted.mouse) return scripted.mouse;
  return mouse;
}

export function mouseIsDown() {
  if (scripted && scripted.mouse) return scripted.mouse.down === true;
  return mouse.down;
}

function toCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = VIEW.width / rect.width;
  const sy = VIEW.height / rect.height;
  mouse.x = (clientX - rect.left) * sx;
  mouse.y = (clientY - rect.top) * sy;
}

export function initInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (!event.repeat) pressed.add(event.code);
    down.add(event.code);
    // Keep WASD and arrows from scrolling the page under the canvas.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
    released.add(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => toCanvasPoint(canvas, event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', (event) => {
    toCanvasPoint(canvas, event.clientX, event.clientY);
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
    } else if (event.button === 2) {
      mouse.rightPressed = true;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
