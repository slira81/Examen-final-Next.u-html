import { ZZFX } from './zzfx.js';
import { mulberry32 } from '../map/map.js';
import { G, clamp } from '../sim/game.js';
import { visibleAt } from '../world/world.js';
import { viewWorldSize } from '../render/view.js';
/* =====================================================================
   Audio: efectos con ZzFX (MIT, github.com/KilledByAPixel/ZzFX) y
   música medieval procedural en modo dórico (laúd, flauta, bordón y
   tambores), con un tema tranquilo y otro de batalla.
   ===================================================================== */
const AUDIO = { on: true, music: true, sfxVol: 0.5, musVol: 0.5, cache: {}, last: {}, ready: false };
const SFX = {
  hit: [.5, .1, 300, 0, .01, .06, 4, 2, 0, 0, 0, 0, 0, 1.5, 0, .1, 0, .6, .02],
  bite: [.35, .2, 160, 0, .02, .08, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, .5, .03],
  bow: [.25, .1, 600, 0, .01, .08, 0, 1, -8, 0, 0, 0, 0, .4],
  chop: [.35, .1, 140, 0, .02, .06, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, .5, .03],
  mine: [.3, .1, 900, 0, .01, .05, 1, 3, 0, 0, 0, 0, 0, .6, 0, .2],
  pick: [.18, .2, 700, 0, .01, .04, 0, 1, 10],
  build: [.35, .05, 220, 0, .01, .05, 4, 2, 0, 0, 0, 0, 0, 1, 0, .2],
  die: [.35, .1, 180, .01, .05, .25, 2, 1, -6, 0, 0, 0, 0, .5],
  animal: [.3, .2, 400, .02, .08, .2, 2, 1, 4, 0, 0, 0, 0, 0, 10],
  boom: [.9, .1, 60, .01, .2, .6, 4, 2, -2, 0, 0, 0, 0, 1.8, 0, .4, 0, .5],
  cannon: [.8, .1, 80, 0, .1, .4, 4, 2, -3, 0, 0, 0, 0, 1.6, 0, .3, 0, .5],
  magic: [.35, .1, 800, .02, .1, .3, 0, 1, 20, 0, 300, .05],
  throw: [.3, .1, 200, 0, .02, .1, 0, 1, -15],
  collapse: [.8, .1, 80, .02, .3, .8, 4, 2, -1, 0, 0, 0, 0, 2],
  levelup: [.5, 0, 520, .01, .15, .3, 0, 1, 0, 0, 260, .08, 0, 0, 0, 0, 0, .7],
  horn: [.55, 0, 220, .08, .5, .4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, .1, .8, 0, 4],
  alert: [.45, 0, 440, .01, .1, .15, 1, 1, 0, 0, -220, .08, .18],
  trained: [.3, 0, 660, 0, .05, .1, 1, 1, 0, 0, 220, .05],
  built: [.35, 0, 330, 0, .08, .2, 1, 1, 0, 0, 165, .06],
  tech: [.35, 0, 440, 0, .1, .25, 0, 1, 0, 0, 440, .1],
  treasure: [.45, 0, 880, 0, .1, .3, 0, 1, 0, 0, 440, .05, .1],
  error: [.3, 0, 150, 0, .05, .1, 1, 1],
  thunder: [1, .2, 40, .05, .6, 1.2, 4, 1, -1, 0, 0, 0, 0, 3, 0, .5, 0, .4],
  quake: [1, .1, 30, .2, 1.5, 1, 4, 1, 0, 0, 0, 0, 0, 2.5],
  click: [.15, 0, 1200, 0, 0, .02, 1],
};
function audioOk() { return AUDIO.on && typeof ZZFX !== 'undefined' && ZZFX.audioContext && ZZFX.audioContext.state === 'running'; }
function audioUnlock() { try { if (typeof ZZFX !== 'undefined' && ZZFX.audioContext.state !== 'running') ZZFX.audioContext.resume(); AUDIO.ready = true; } catch (e) { /* sin audio */ } }
function sfx(name, vol = 1, pan = 0) {
  if (!audioOk() || !SFX[name]) return;
  const now = performance.now(); if (now - (AUDIO.last[name] || 0) < 70) return; AUDIO.last[name] = now;
  try {
    const s = AUDIO.cache[name] || (AUDIO.cache[name] = ZZFX.buildSamples(...SFX[name]));
    ZZFX.volume = 0.3 * AUDIO.sfxVol; ZZFX.playSamples([s], vol, 0.94 + Math.random() * 0.12, clamp(pan, -1, 1));
  } catch (e) { /* ignorar */ }
}
function sfxAt(name, x, y, vol = 1) {
  if (!G || !G.cam || !audioOk()) return;
  const vs = viewWorldSize(), vw = vs.w || 240, vh = vs.h || 150, dx = x - (G.cam.x), dy = y - (G.cam.y);
  if (Math.abs(dx) > vw * 0.7 || Math.abs(dy) > vh * 0.7) return;
  if (G.human >= 0 && !visibleAt(x, y)) return;
  sfx(name, vol * (1 - Math.min(0.6, Math.hypot(dx / vw, dy / vh))), dx / (vw * 0.6));
}

// --------------------------------------------------------------- música
const MUSIC = { nextT: 0, step: 0, mode: 'peace', bar: 0, timer: null, gain: null, song: null };
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
function makeSong(seed, battle) {
  const r = mulberry32(seed), scale = [0, 2, 3, 5, 7, 9, 10]; // dórico
  const root = battle ? 50 : 50;            // re
  const prog = battle ? [0, 6, 5, 6, 0, 3, 5, 4] : [0, 6, 3, 0, 5, 3, 6, 0];   // grados de acordes
  const mel = []; let deg = 7;
  for (let bar = 0; bar < 8; bar++) {
    const ch = prog[bar], tones = [ch, ch + 2, ch + 4];
    for (let s = 0; s < 8; s++) {
      if (r() < (battle ? 0.15 : 0.3) && s % 2) { mel.push(null); continue; }
      if (s % 4 === 0) { const t = tones[Math.floor(r() * 3)] + 7; deg = t + (Math.abs(t - deg) > 4 ? 0 : 0); }
      else deg += r() < 0.5 ? -1 : 1;
      deg = Math.max(4, Math.min(14, deg));
      mel.push(deg);
    }
  }
  const toMidi = d => root + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7];
  return { prog, mel, toMidi, tempo: battle ? 132 : 88, battle };
}
function musicStart() {
  if (MUSIC.timer || typeof ZZFX === 'undefined') return;
  const ac = ZZFX.audioContext; MUSIC.gain = ac.createGain(); MUSIC.gain.gain.value = 0.11 * AUDIO.musVol; MUSIC.gain.connect(ac.destination);
  MUSIC.songs = { peace: makeSong(7, false), battle: makeSong(11, true) }; MUSIC.song = MUSIC.songs.peace;
  MUSIC.nextT = ac.currentTime + 0.2;
  MUSIC.timer = setInterval(musicTick, 90);
}
function tone(t, f, dur, type, vol, opts = {}) {
  const ac = ZZFX.audioContext, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (opts.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.008; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
  let out = g;
  if (opts.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; g.connect(fl); out = fl; }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opts.att || 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); out.connect(MUSIC.gain); o.start(t); o.stop(t + dur + 0.05);
}
function drum(t, vol, low) {
  const ac = ZZFX.audioContext, len = 0.12, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, low ? 2 : 4);
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); f.type = low ? 'lowpass' : 'bandpass'; f.frequency.value = low ? 180 : 1800;
  s.buffer = buf; g.gain.value = vol; s.connect(f).connect(g).connect(MUSIC.gain); s.start(t);
}
function musicTick() {
  const ac = ZZFX.audioContext; if (!ac || ac.state !== 'running') return;
  MUSIC.gain.gain.value = AUDIO.music && AUDIO.on ? 0.11 * AUDIO.musVol : 0;
  const want = G && G.human >= 0 && G.time - (G.battleNear || -99) < 10 ? 'battle' : 'peace';
  while (MUSIC.nextT < ac.currentTime + 0.4) {
    const s = MUSIC.song, spb = 60 / s.tempo / 2, t = MUSIC.nextT, step = MUSIC.step % 64, bar = Math.floor(step / 8);
    if (step % 16 === 0 && want !== MUSIC.mode) { MUSIC.mode = want; MUSIC.song = MUSIC.songs[want]; }
    const n = s.mel[step], ch = s.prog[bar];
    if (n !== null) tone(t, NOTE(s.toMidi(n)), spb * 1.8, s.battle ? 'square' : 'triangle', s.battle ? 0.05 : 0.08, { vib: !s.battle, lp: s.battle ? 1800 : 2600, att: 0.02 });
    if (step % 8 === 0) { tone(t, NOTE(s.toMidi(ch) - 12), spb * 8, 'sawtooth', 0.05, { lp: 420, att: 0.15 }); tone(t, NOTE(s.toMidi(ch + 4) - 12), spb * 8, 'triangle', 0.035, { att: 0.2 }); }
    if (step % 2 === 0) tone(t, NOTE(s.toMidi(ch + [0, 2, 4, 2][(step / 2) % 4])), spb * 1.2, 'triangle', 0.04, { lp: 1600 }); // laúd arpegiado
    if (s.battle) { if (step % 4 === 0) drum(t, 0.5, true); if (step % 4 === 2) drum(t, 0.25, false); if (step % 8 === 7) drum(t, 0.18, false); }
    else if (step % 16 === 0) drum(t, 0.18, true);
    MUSIC.nextT += spb; MUSIC.step++;
  }
}

export { AUDIO, SFX, audioOk, audioUnlock, sfx, sfxAt, MUSIC, NOTE, makeSong, musicStart, tone, drum, musicTick };
