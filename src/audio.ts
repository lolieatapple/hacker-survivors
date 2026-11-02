// Chiptune music sequencer + synth SFX, all generated with WebAudio (no audio files).
// Audio can only start after a user gesture (browser rule, also inside X player cards).
export type Sfx = 'shoot' | 'hit' | 'pickup' | 'levelup' | 'hurt' | 'boss' | 'explode' | 'select' | 'clear' | 'dead' | 'zap' | 'warn' | 'chest';
export type TrackName = 'title' | 'waves' | 'boss' | 'final';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let pulse25: PeriodicWave | null = null;
let pulse12: PeriodicWave | null = null;
let muted = false;
const lastPlay = new Map<Sfx, number>();

const MASTER_VOL = 0.7;
const MUSIC_VOL = 0.6;

export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = muted ? 0 : MASTER_VOL;
  analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  master.connect(analyser);
  analyser.connect(ac.destination);
  musicBus = ac.createGain();
  musicBus.gain.value = MUSIC_VOL;
  musicBus.connect(master);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  pulse25 = pulseWave(0.25);
  pulse12 = pulseWave(0.125);
  if (ac.state === 'suspended') void ac.resume();
  setInterval(schedule, 25);
}

function pulseWave(duty: number): PeriodicWave {
  const n = 40;
  const real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(k * Math.PI * duty);
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.sin(k * Math.PI * duty);
  }
  return ac!.createPeriodicWave(real, imag);
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : MASTER_VOL;
}
export const isMuted = () => muted;

/** Debug: current output level (RMS 0..1) and context state. */
export function audioDebug() {
  if (!ac || !analyser) return { state: 'none', rms: 0, track: current?.name ?? null };
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0;
  for (const v of buf) s += v * v;
  return { state: ac.state, rms: Math.sqrt(s / buf.length), track: current?.name ?? null };
}

// ---------------- instruments ----------------
type Wave = OscillatorType | 'pulse25' | 'pulse12';
function osc(wave: Wave, freq: number, t: number, dur: number, vol: number, bus: GainNode, slideTo?: number, sustain = false) {
  const o = ac!.createOscillator();
  if (wave === 'pulse25') o.setPeriodicWave(pulse25!);
  else if (wave === 'pulse12') o.setPeriodicWave(pulse12!);
  else o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  const g = ac!.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  if (sustain) {
    // music notes: short attack, hold at ~65%, quick release at the end
    const rel = Math.min(0.04, dur * 0.3);
    g.gain.linearRampToValueAtTime(vol * 0.65, t + Math.min(0.07, dur * 0.4));
    g.gain.setValueAtTime(vol * 0.65, t + dur - rel);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.setValueAtTime(vol * 0.75, t + Math.min(dur * 0.5, 0.06));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  }
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(t: number, dur: number, vol: number, bus: GainNode, filter: BiquadFilterType, freq: number) {
  const s = ac!.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac!.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = ac!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}
function drum(kind: string, t: number, bus: GainNode) {
  if (kind === 'k') osc('sine', 150, t, 0.16, 0.9, bus, 42);
  else if (kind === 's') { noise(t, 0.14, 0.35, bus, 'bandpass', 1900); osc('triangle', 190, t, 0.08, 0.25, bus, 120); }
  else if (kind === 'h') noise(t, 0.035, 0.12, bus, 'highpass', 7500);
}

// ---------------- music ----------------
const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(n: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  const midi = 12 * (Number(m[3]) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}
interface NoteEv { f: number; steps: number }
interface Voice { wave: Wave; vol: number; notes: (NoteEv | null)[] }
interface Track { name: TrackName; bpm: number; len: number; voices: Voice[]; drums: string[] }

function parse(src: string): (NoteEv | null)[] {
  const tok = src.split(/\s+/).filter((t) => t && t !== '|');
  const out: (NoteEv | null)[] = tok.map(() => null);
  tok.forEach((t, i) => {
    if (t === '.' || t === '-') return;
    let n = 1;
    while (tok[i + n] === '-') n++;
    out[i] = { f: freq(t), steps: n };
  });
  return out;
}
function track(name: TrackName, bpm: number, parts: { lead: string; bass: string; arp?: string; drums: string }): Track {
  const voices: Voice[] = [
    { wave: 'pulse25', vol: 0.2, notes: parse(parts.lead) },
    { wave: 'triangle', vol: 0.45, notes: parse(parts.bass) },
  ];
  if (parts.arp) voices.push({ wave: 'pulse12', vol: 0.07, notes: parse(parts.arp) });
  const drums = parts.drums.split(/\s+/).filter((t) => t && t !== '|');
  const len = voices[0].notes.length;
  for (const v of voices) if (v.notes.length !== len) throw new Error(`track ${name}: voice length ${v.notes.length} != ${len}`);
  if (drums.length !== len) throw new Error(`track ${name}: drums length ${drums.length} != ${len}`);
  return { name, bpm, len, voices, drums };
}
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

// Original compositions, 4 bars of 16th notes each.
const TRACKS: Record<TrackName, Track> = {
  title: track('title', 96, {
    lead: 'E5 - - - - - D5 - C5 - - - B4 - A4 - | C5 - - - - - - - . . A4 - C5 - F5 - | E5 - - - - - G5 - E5 - D5 - C5 - - - | D5 - - - - - - - B4 - - - G4 - - -',
    bass: 'A2 - - - . . A2 . A2 - - - . . E2 . | F2 - - - . . F2 . F2 - - - . . C3 . | C3 - - - . . C3 . C3 - - - . . G2 . | G2 - - - . . G2 . G2 - - - . . D3 .',
    arp: rep('A3 C4 E4 A4 C5 A4 E4 C4', 2) + ' ' + rep('F3 A3 C4 F4 A4 F4 C4 A3', 2) + ' ' + rep('C4 E4 G4 C5 E5 C5 G4 E4', 2) + ' ' + rep('G3 B3 D4 G4 B4 G4 D4 B3', 2),
    drums: rep('k . h . . . h . s . h . . . h .', 4),
  }),
  waves: track('waves', 140, {
    lead: 'D5 - F5 - A5 - G5 F5 E5 - F5 - D5 - - - | Bb4 - D5 - F5 - E5 D5 C5 - D5 - Bb4 - - - | C5 - E5 - G5 - F5 E5 D5 - E5 - C5 - - - | A4 - C#5 - E5 - A5 - G5 - F5 - E5 - C#5 -',
    bass: rep('D2 . D3 .', 4) + ' ' + rep('Bb1 . Bb2 .', 4) + ' ' + rep('C2 . C3 .', 4) + ' ' + rep('A1 . A2 .', 4),
    arp: rep('D4 F4 A4 F4', 4) + ' ' + rep('D4 F4 Bb4 F4', 4) + ' ' + rep('E4 G4 C5 G4', 4) + ' ' + rep('E4 A4 C#5 A4', 4),
    drums: rep('k . h . s . h k k . h . s . h .', 3) + ' k . h . s . h k k . s . s s s s',
  }),
  boss: track('boss', 160, {
    lead: 'E5 . E5 F5 E5 . B4 . E5 . G5 F5 E5 D5 E5 . | F5 . F5 G5 F5 . C5 . F5 . A5 G5 F5 E5 F5 . | E5 . E5 F5 E5 . B4 . E5 . G5 F5 E5 D5 E5 . | D5 . D5 E5 F#5 . A5 . B5 - - - A5 - F#5 -',
    bass: 'E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 G2 G2 A2 B2 | F2 F2 F3 F2 F2 F2 F3 F2 F2 F2 F3 F2 A2 A2 G2 F2 | E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 G2 G2 A2 B2 | D2 D2 D3 D2 D2 D2 D3 D2 F#2 F#2 F#3 F#2 A2 A2 B2 B2',
    drums: rep('k . h k s . h . k k h . s . h s', 4),
  }),
  final: track('final', 170, {
    lead: 'C5 - Eb5 - G5 - C6 - Bb5 - G5 - Ab5 - G5 - | Eb5 - - - C5 - Eb5 - F5 - G5 - Ab5 - Bb5 - | D5 - F5 - Bb5 - D6 - C6 - Bb5 - Ab5 - G5 - | B4 - D5 - F5 - G5 - B5 - - - D6 - - -',
    bass: 'C2 . C3 C2 . C2 C3 . C2 . C3 C2 . C2 Eb2 G2 | Ab1 . Ab2 Ab1 . Ab1 Ab2 . Ab1 . Ab2 Ab1 . Ab1 C2 Eb2 | Bb1 . Bb2 Bb1 . Bb1 Bb2 . Bb1 . Bb2 Bb1 . Bb1 D2 F2 | G1 . G2 G1 . G1 G2 . G1 . G2 G1 B1 D2 F2 G2',
    arp: rep('C4 Eb4 G4 C5', 4) + ' ' + rep('C4 Eb4 Ab4 C5', 4) + ' ' + rep('D4 F4 Bb4 D5', 4) + ' ' + rep('D4 G4 B4 D5', 4),
    drums: rep('k . h k s . h k k . h k s . s s', 4),
  }),
};

let current: Track | null = null;
let wanted: TrackName | null = null;
let step = 0;
let nextTime = 0;
let ducked = false;

/** Switch background music (null = silence). Safe to call every frame. */
export function playMusic(name: TrackName | null) {
  if (wanted === name) return;
  wanted = name;
  current = name ? TRACKS[name] : null;
  step = 0;
  if (ac) nextTime = ac.currentTime + 0.06;
}
/** Lower the music (pause menus). */
export function duckMusic(on: boolean) {
  if (ducked === on) return;
  ducked = on;
  if (musicBus && ac) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL * 0.3 : MUSIC_VOL, ac.currentTime, 0.1);
}

function schedule() {
  if (!ac || !musicBus || !current) return;
  const tr = current;
  const stepDur = 60 / tr.bpm / 4;
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.02;
  while (nextTime < ac.currentTime + 0.12) {
    for (const v of tr.voices) {
      const n = v.notes[step];
      if (n) osc(v.wave, n.f, nextTime, n.steps * stepDur * 0.92, v.vol, musicBus, undefined, true);
    }
    const d = tr.drums[step];
    if (d !== '.') drum(d, nextTime, musicBus);
    nextTime += stepDur;
    step = (step + 1) % tr.len;
  }
}

// ---------------- sfx ----------------
const MIN_GAP: Partial<Record<Sfx, number>> = { shoot: 0.06, hit: 0.045, pickup: 0.035, zap: 0.08, explode: 0.08 };

export function sfx(name: Sfx) {
  if (!ac || !sfxBus || muted) return;
  const now = ac.currentTime;
  const gap = MIN_GAP[name] ?? 0;
  if (now - (lastPlay.get(name) ?? -1) < gap) return;
  lastPlay.set(name, now);
  const b = sfxBus;
  switch (name) {
    case 'shoot': osc('pulse25', 1100, now, 0.05, 0.07, b, 520); break;
    case 'hit': osc('square', 240, now, 0.05, 0.08, b, 90); break;
    case 'zap': osc('sawtooth', 1400, now, 0.14, 0.12, b, 180); noise(now, 0.08, 0.1, b, 'highpass', 3000); break;
    case 'pickup': osc('pulse12', 1300 + Math.random() * 300, now, 0.06, 0.12, b, 2000); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => osc('pulse25', f, now + i * 0.07, 0.12, 0.18, b)); break;
    case 'chest': [784, 988, 1175, 1568, 1976].forEach((f, i) => osc('pulse12', f, now + i * 0.05, 0.1, 0.16, b)); break;
    case 'hurt': osc('sawtooth', 320, now, 0.2, 0.22, b, 60); noise(now, 0.1, 0.15, b, 'lowpass', 1200); break;
    case 'boss': [0, 0.28, 0.56].forEach((d) => osc('sawtooth', 110, now + d, 0.24, 0.25, b, 55)); break;
    case 'warn': osc('square', 880, now, 0.1, 0.14, b); osc('square', 660, now + 0.12, 0.1, 0.14, b); break;
    case 'explode': noise(now, 0.4, 0.45, b, 'lowpass', 900); osc('square', 120, now, 0.3, 0.2, b, 30); break;
    case 'select': osc('pulse25', 660, now, 0.07, 0.15, b, 990); break;
    case 'clear': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => osc('pulse25', f, now + i * 0.11, i === 6 ? 0.5 : 0.12, 0.2, b)); break;
    case 'dead': [392, 311, 233, 155].forEach((f, i) => osc('square', f, now + i * 0.18, 0.24, 0.18, b, f * 0.9)); break;
  }
}
