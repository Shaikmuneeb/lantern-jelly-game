// Procedural sound: every effect is synthesised from WebAudio oscillators and noise,
// so the game ships no audio files and loads nothing. The context is created on the
// player's first gesture (browser autoplay rules) and stays silent until then.
let ctx = null;
let master = null;
let ambienceGain = null;
let muted = false;
let pingTimer = 4;

export function unlockAudio() {
  if (!ctx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startAmbience();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

// A single shaped tone: pitch glides from freq to endFreq while the envelope decays.
function tone({ type = 'sine', freq, endFreq, dur, vol, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq && endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// A filtered noise burst: hits, dashes and the Maw's roar all lean on it.
function noise({ dur, vol, freq = 1200, q = 1, delay = 0, sweepTo = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export function playSfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shoot':
      tone({ type: 'square', freq: 720, endFreq: 340, dur: 0.11, vol: 0.10 });
      break;
    case 'hit':
      noise({ dur: 0.06, vol: 0.16, freq: 1900 });
      break;
    case 'kill':
      tone({ type: 'triangle', freq: 540, endFreq: 160, dur: 0.2, vol: 0.18 });
      noise({ dur: 0.1, vol: 0.1, freq: 900, sweepTo: 300 });
      break;
    case 'hurt':
      tone({ type: 'sawtooth', freq: 190, endFreq: 70, dur: 0.32, vol: 0.24 });
      noise({ dur: 0.18, vol: 0.16, freq: 500, sweepTo: 150 });
      break;
    case 'dash':
      noise({ dur: 0.24, vol: 0.2, freq: 600, sweepTo: 2400, q: 3 });
      break;
    case 'level':
      tone({ type: 'triangle', freq: 523, dur: 0.16, vol: 0.16 });
      tone({ type: 'triangle', freq: 659, dur: 0.16, vol: 0.16, delay: 0.08 });
      tone({ type: 'triangle', freq: 784, dur: 0.24, vol: 0.16, delay: 0.16 });
      break;
    case 'card':
      tone({ type: 'sine', freq: 940, endFreq: 1180, dur: 0.09, vol: 0.14 });
      break;
    case 'wave':
      tone({ type: 'sine', freq: 150, endFreq: 90, dur: 0.55, vol: 0.2 });
      noise({ dur: 0.5, vol: 0.09, freq: 350, sweepTo: 120 });
      break;
    case 'boss':
      tone({ type: 'sawtooth', freq: 95, endFreq: 38, dur: 0.9, vol: 0.26 });
      noise({ dur: 0.8, vol: 0.2, freq: 260, sweepTo: 80, q: 2 });
      break;
    case 'pearl':
      tone({ type: 'sine', freq: 1150, endFreq: 1560, dur: 0.09, vol: 0.13 });
      break;
    case 'chain':
      noise({ dur: 0.1, vol: 0.13, freq: 2600, sweepTo: 900, q: 4 });
      tone({ type: 'sawtooth', freq: 980, endFreq: 500, dur: 0.1, vol: 0.08 });
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.5, vol: 0.16, delay: i * 0.13 }));
      break;
    case 'lose':
      [392, 311, 233].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.5, vol: 0.16, delay: i * 0.2 }));
      break;
    default:
      break;
  }
}

// The ambient layer: a slow two-oscillator drone with a lull, plus faint sonar pings.
function startAmbience() {
  ambienceGain = ctx.createGain();
  ambienceGain.gain.value = 0.05;
  ambienceGain.connect(master);
  const droneA = ctx.createOscillator();
  const droneB = ctx.createOscillator();
  droneA.type = 'sine';
  droneB.type = 'triangle';
  droneA.frequency.value = 55;
  droneB.frequency.value = 82.7;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 0.022;
  lfo.connect(lfoGain).connect(ambienceGain.gain);
  droneA.connect(ambienceGain);
  droneB.connect(ambienceGain);
  droneA.start();
  droneB.start();
  lfo.start();
}

// Called once a second with the sim clock; pings every few seconds keep the dark alive.
export function updateAmbience(dt) {
  if (!ctx || muted) return;
  pingTimer -= dt;
  if (pingTimer <= 0) {
    pingTimer = 5 + Math.random() * 4;
    tone({ type: 'sine', freq: 1320, endFreq: 880, dur: 0.4, vol: 0.05 });
  }
}
