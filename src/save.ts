// Progress persistence. Third-party iframes (e.g. an X player card) may block localStorage;
// in that case progress lives in memory for the session and we warn once.
import type { Lang } from './i18n';
import { checkBuild, type Run } from './game/run';

const KEY = 'hacker-survivors.save.v2';
const OLD_KEY = 'hacker-survivors.save.v1'; // per-level unlocks; only its settings carry over

export interface Best { assets: number; cleared: number; won: boolean; runId: string }

export interface SaveData {
  playerId: string;    // anonymous id for the leaderboard
  name?: string;       // leaderboard nickname, unset until the player picks one
  muted: boolean;
  lang?: Lang;         // unset until the player picks a language
  run: Run | null;     // the run in progress
  best: Best | null;   // best finished or abandoned run
}

function fresh(): SaveData { return { playerId: crypto.randomUUID(), muted: false, run: null, best: null }; }

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(KEY);
    return s;
  } catch (e) {
    console.warn('[save] localStorage unavailable, progress will not persist:', e);
    return null;
  }
}

const store = storage();

function load(): SaveData {
  if (!store) return fresh();
  const raw = store.getItem(KEY);
  if (raw === null) {
    const data = fresh();
    const old = store.getItem(OLD_KEY);
    if (old !== null) {
      const o = JSON.parse(old) as { muted?: boolean; lang?: Lang };
      if (typeof o.muted === 'boolean') data.muted = o.muted;
      if (o.lang === 'zh' || o.lang === 'en') data.lang = o.lang;
      store.removeItem(OLD_KEY);
    }
    return data;
  }
  // A corrupt save is a real error: surface it instead of silently resetting progress.
  const parsed = JSON.parse(raw) as SaveData;
  if (typeof parsed.playerId !== 'string' || typeof parsed.muted !== 'boolean' || !('run' in parsed) || !('best' in parsed)) {
    throw new Error(`[save] malformed save data: ${raw}`);
  }
  if (parsed.run) {
    // Runs saved before the comeback assist (2026-11-03) have no stageDeaths yet: start them at 0.
    if (!('stageDeaths' in parsed.run)) (parsed.run as Run).stageDeaths = 0;
    if (!Number.isInteger(parsed.run.stageDeaths)) throw new Error(`[save] malformed run: ${raw}`);
    checkBuild(parsed.run.build);
  }
  return parsed;
}

export const save: SaveData = load();

export function persist() {
  if (store) store.setItem(KEY, JSON.stringify(save));
}

/** Record a run's result if it beats the best so far. */
export function recordBest(assets: number, cleared: number, won: boolean, runId: string) {
  const b = save.best;
  if (!b || assets > b.assets) save.best = { assets, cleared, won, runId };
  persist();
}
