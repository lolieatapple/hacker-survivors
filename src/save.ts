// Progress persistence. Third-party iframes (e.g. an X player card) may block localStorage;
// in that case progress lives in memory for the session and we warn once.
import type { Lang } from './i18n';
const KEY = 'hacker-survivors.save.v1';

export interface SaveData {
  unlocked: number; // highest playable level index (0-based)
  cleared: Record<number, { bestTime: number; kills: number }>;
  muted: boolean;
  lang?: Lang; // unset until the player picks a language
}

function fresh(): SaveData { return { unlocked: 0, cleared: {}, muted: false }; }

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
  if (raw === null) return fresh();
  // A corrupt save is a real error: surface it instead of silently resetting progress.
  const parsed = JSON.parse(raw) as SaveData;
  if (typeof parsed.unlocked !== 'number' || typeof parsed.cleared !== 'object') {
    throw new Error(`[save] malformed save data: ${raw}`);
  }
  return parsed;
}

export const save: SaveData = load();

const params = new URLSearchParams(location.search);
if (params.get('unlock') === 'all') save.unlocked = 27;

export function persist() {
  if (store) store.setItem(KEY, JSON.stringify(save));
}

export function markCleared(idx: number, time: number, kills: number) {
  const prev = save.cleared[idx];
  if (!prev || time < prev.bestTime) save.cleared[idx] = { bestTime: time, kills };
  save.unlocked = Math.max(save.unlocked, Math.min(27, idx + 1));
  persist();
}
