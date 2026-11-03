import { W, H, makeCanvas } from './gfx';
import { loadFonts } from './text';
import { input } from './input';
import { unlockAudio, setMuted, isMuted, audioDebug } from './audio';
import { setLang, tx, T, type Lang } from './i18n';
import { save, persist, recordBest } from './save';
import { Cover } from './scenes/cover';
import { LangSelect } from './scenes/langSelect';
import { Leaderboard } from './scenes/leaderboard';
import { Game } from './scenes/game';
import type { App, Scene } from './scenes/ui';
import { LEVELS } from './game/levels';
import { newRun, cloneBuild, debugBuild, type Run } from './game/run';
import { DEATH_FEE, usdFull, STAGES } from './game/economy';
import { assistMul } from './game/difficulty';
import { registerRun, submitScore, shareOnX } from './net';
import { askName, nameInputOpen } from './nameInput';

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

const params = new URLSearchParams(location.search);
// Debug runs (god mode, stage jumps, the sim) never touch the save or the leaderboard.
const DEBUG = params.has('god') || params.has('level') || params.has('boss') || params.has('sim');

let scene: Scene;
let run: Run | null = save.run;
/** Last result for the share text, kept after a finished run is cleared. */
let lastResult = { assets: 0, cleared: 0, won: false };

function persistRun() {
  if (DEBUG) return;
  save.run = run;
  persist();
}
function needRun(): Run {
  if (!run) throw new Error('[run] no run in progress');
  return run;
}
function register(r: Run) {
  if (DEBUG) return;
  registerRun(r.id, save.playerId)
    .then(() => { r.registered = true; persistRun(); })
    .catch((e) => console.warn('[leaderboard] run not registered, this run will not be ranked:', e));
}
function submit(runId: string, assets: number, cleared: number, won: boolean) {
  if (DEBUG || !save.name) return;
  submitScore({ runId, playerId: save.playerId, name: save.name, assets, cleared, won })
    .then((r) => console.info(`[leaderboard] submitted ${usdFull(assets)}, rank #${r.rank}`))
    .catch((e) => console.warn('[leaderboard] submit failed:', e));
}

const app: App = {
  toCover() { scene = new Cover(app); },
  newRun() {
    const start = () => {
      run = newRun();
      persistRun();
      app.play();
    };
    if (save.name || DEBUG) { start(); return; }
    askName().then((name) => {
      if (name) { save.name = name; persist(); }
      start();
    });
  },
  play() {
    const r = needRun();
    // The server times runs from registration, so only a run still on stage 1 may (re)try it.
    if (!r.registered && r.stage === 0) register(r);
    lastResult = { assets: r.assets, cleared: r.stage, won: false };
    scene = new Game(app, r.stage, cloneBuild(r.build), r.assets, assistMul(r.stageDeaths));
  },
  stageCleared(res) {
    const r = needRun();
    r.build = res.build;
    r.assets += res.earned + res.recovered;
    r.kills += res.kills;
    r.seconds += res.seconds;
    const cleared = r.stage + 1, won = cleared === STAGES;
    lastResult = { assets: r.assets, cleared, won };
    if (!DEBUG) recordBest(r.assets, cleared, won, r.id);
    if (r.registered) submit(r.id, r.assets, cleared, won);
    r.stageDeaths = 0;
    if (won) run = null;
    else r.stage = cleared;
    persistRun();
  },
  stageFailed() {
    const r = needRun();
    const fee = Math.round(r.assets * DEATH_FEE);
    r.assets -= fee;
    r.deaths++;
    r.stageDeaths++;
    lastResult = { assets: r.assets, cleared: r.stage, won: false };
    persistRun();
    return fee;
  },
  toLeaderboard() { scene = new Leaderboard(app); },
  share(kind) {
    const b = save.best;
    if (kind === 'best' && !b) {
      shareOnX(tx('《黑客幸存者》：像素风生存游戏，活过加密史上 28 场最狠的黑客攻击。', "Hacker Survivors: a pixel-art survivors game. Live through crypto's 28 worst hacks."));
      return;
    }
    const { assets, cleared, won } = kind === 'best' && b ? b : lastResult;
    const stage = LEVELS[Math.min(cleared, STAGES - 1)];
    const text = kind === 'dead'
      ? tx(`我在《黑客幸存者》第 ${cleared + 1} 关被「${T(stage.boss)}」掏空了，资产还剩 ${usdFull(assets)}。你能撑多久？`,
        `Got drained by ${T(stage.boss)} on stage ${cleared + 1} of Hacker Survivors. ${usdFull(assets)} left. Can you last longer?`)
      : won
        ? tx(`我活过了加密史上全部 28 场黑客攻击，守住 ${usdFull(assets)} 资产！来《黑客幸存者》挑战我：`,
          `I survived all 28 of crypto's worst hacks and kept ${usdFull(assets)} safe. Beat me in Hacker Survivors:`)
        : tx(`我在《黑客幸存者》里扛过了 ${cleared} 场加密史上最狠的黑客攻击，守住 ${usdFull(assets)} 资产！你能活过几关？`,
          `I survived ${cleared} of crypto's worst hacks in Hacker Survivors and kept ${usdFull(assets)} safe. How far can you get?`);
    shareOnX(text);
  },
  rename() {
    if (nameInputOpen()) return;
    askName(save.name).then((name) => {
      if (!name) return;
      save.name = name;
      persist();
      const b = save.best;
      if (b) submit(b.runId, b.assets, b.cleared, b.won); // the server keeps the best per player, under the new name
      if (scene instanceof Leaderboard) setTimeout(() => (scene as Leaderboard).reload(), 600);
    });
  },
};

(window as unknown as { __app: App; __audio: typeof audioDebug }).__app = app; // debug hooks for automated playtests
(window as unknown as { __audio: typeof audioDebug }).__audio = audioDebug;
(window as unknown as { __run: () => Run | null; __debugRun: (stage: number) => void }).__run = () => run;
(window as unknown as { __debugRun: (stage: number) => void }).__debugRun = (stage: number) => {
  if (!DEBUG) throw new Error('__debugRun needs a debug URL flag (?god=1, ?level=N or ?sim=1)');
  run = { ...newRun(), stage, build: stage ? debugBuild(stage) : newRun().build };
};

const forcedLang = params.get('lang');
if (forcedLang === 'zh' || forcedLang === 'en') save.lang = forcedLang as Lang;
const startLevel = params.get('level');
if (save.lang) setLang(save.lang);
if (startLevel !== null) {
  const stage = Number(startLevel) - 1;
  if (!(stage >= 0 && stage < STAGES)) throw new Error(`?level must be 1–${STAGES}, got ${startLevel}`);
  run = { ...newRun(), stage, build: debugBuild(stage) };
  app.play();
} else if (save.lang) app.toCover();
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

