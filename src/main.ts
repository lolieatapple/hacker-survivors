import { W, H, makeCanvas } from './gfx';
import { loadFonts } from './text';
import { input } from './input';
import { unlockAudio, setMuted, isMuted, audioDebug } from './audio';
import { setLang, type Lang } from './i18n';
import { save, persist } from './save';
import { Cover } from './scenes/cover';
import { LevelSelect } from './scenes/levelSelect';
import { LangSelect } from './scenes/langSelect';
import { Game } from './scenes/game';
import type { App, Scene } from './scenes/ui';

const view = document.getElementById('view') as HTMLCanvasElement | null;
if (!view) throw new Error('#view canvas missing');
const vctx = view.getContext('2d');
if (!vctx) throw new Error('2d context unavailable');

const [buf, ctx] = makeCanvas(W, H);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  view!.width = Math.round(window.innerWidth * dpr);
  view!.height = Math.round(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

input.attach(view);
setMuted(save.muted);
input.onFirstGesture(() => unlockAudio());
window.addEventListener('toggle-mute', () => {
  save.muted = !isMuted();
  setMuted(save.muted);
  persist();
});

await loadFonts();

let scene: Scene;
const app: App = {
  toCover() { scene = new Cover(() => app.toLevelSelect()); },
  toLevelSelect(focus?: number) { scene = new LevelSelect(app, focus); },
  play(idx: number) { scene = new Game(app, idx); },
};

(window as unknown as { __app: App; __audio: typeof audioDebug }).__app = app; // debug hooks for automated playtests
(window as unknown as { __audio: typeof audioDebug }).__audio = audioDebug;

const params = new URLSearchParams(location.search);
const forcedLang = params.get('lang');
if (forcedLang === 'zh' || forcedLang === 'en') save.lang = forcedLang as Lang;
const startLevel = params.get('level');
if (save.lang) setLang(save.lang);
if (startLevel !== null) app.play(Number(startLevel) - 1);
else if (save.lang) app.toCover();
else scene = new LangSelect(() => app.toCover());

function present() {
  const vw = view!.width, vh = view!.height;
  vctx!.imageSmoothingEnabled = false;
  vctx!.fillStyle = '#05060d';
  vctx!.fillRect(0, 0, vw, vh);
  let s = Math.min(vw / W, vh / H);
  if (s >= 2 && Math.floor(s) / s > 0.92) s = Math.floor(s); // prefer integer scale when it costs little
  const dw = Math.round(W * s), dh = Math.round(H * s);
  const dx = Math.round((vw - dw) / 2), dy = Math.round((vh - dh) / 2);
  input.setViewport(dx, dy, s);
  vctx!.drawImage(buf, 0, 0, W, H, dx, dy, dw, dh);
  if (s >= 3) {
    vctx!.fillStyle = 'rgba(0,0,0,0.16)';
    const lh = Math.max(1, Math.round(s * 0.34));
    for (let y = 0; y < H; y++) vctx!.fillRect(dx, Math.round(dy + (y + 1) * s) - lh, dw, lh);
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (input.pressed('KeyM')) window.dispatchEvent(new CustomEvent('toggle-mute'));
  scene.update(dt);
  input.endFrame();
  scene.draw(ctx);
  present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

