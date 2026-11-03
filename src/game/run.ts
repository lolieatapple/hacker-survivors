// One run = all 28 stages in a row. The build carries from stage to stage;
// the run is checkpointed at the start of every stage.
import { rollChoices, PASSIVES, type WeaponId, type PassiveId } from './weapons';

export interface Build {
  lvl: number;
  xp: number;
  maxHp: number;
  weapons: { id: WeaponId; lvl: number }[];
  passives: Record<PassiveId, number>;
}

export interface Run {
  id: string;          // run id for the leaderboard server
  registered: boolean; // server knows this run (only registered runs can be ranked)
  stage: number;       // 0-based index of the stage to play next
  build: Build;        // build at the start of `stage` (the checkpoint)
  assets: number;      // banked score, USD
  kills: number;
  seconds: number;     // play time of cleared stages
  deaths: number;
  stageDeaths: number; // deaths on `stage` so far: each one softens the retry (difficulty.ts assistMul)
}

const zeroPassives = (): Record<PassiveId, number> =>
  Object.fromEntries((Object.keys(PASSIVES) as PassiveId[]).map((k) => [k, 0])) as Record<PassiveId, number>;

export const freshBuild = (): Build => ({ lvl: 1, xp: 0, maxHp: 100, weapons: [{ id: 'bolt', lvl: 1 }], passives: zeroPassives() });

export const cloneBuild = (b: Build): Build => ({ ...b, weapons: b.weapons.map((w) => ({ ...w })), passives: { ...b.passives } });

export const newRun = (): Run => ({ id: crypto.randomUUID(), registered: false, stage: 0, build: freshBuild(), assets: 0, kills: 0, seconds: 0, deaths: 0, stageDeaths: 0 });

/** Throws if a saved build does not have the expected shape. */
export function checkBuild(b: Build): Build {
  const ok = typeof b === 'object' && b !== null && Number.isInteger(b.lvl) && typeof b.xp === 'number' && typeof b.maxHp === 'number'
    && Array.isArray(b.weapons) && b.weapons.every((w) => typeof w.id === 'string' && Number.isInteger(w.lvl))
    && typeof b.passives === 'object' && (Object.keys(PASSIVES) as PassiveId[]).every((k) => Number.isInteger(b.passives[k]));
  if (!ok) throw new Error(`[run] malformed build: ${JSON.stringify(b)}`);
  return b;
}

/** Debug only (?level=N): a build roughly as strong as a player who reached that stage. */
export function debugBuild(stage: number): Build {
  const b = freshBuild();
  const picks = Math.round(stage * 7);
  for (let i = 0; i < picks; i++) {
    const c = rollChoices(b.weapons, b.passives, 1)[0];
    if (c.kind === 'weapon') {
      const w = b.weapons.find((x) => x.id === c.id);
      if (w) w.lvl++; else b.weapons.push({ id: c.id as WeaponId, lvl: 1 });
    } else if (c.kind === 'passive') {
      b.passives[c.id as PassiveId]++;
      if (c.id === 'hp') b.maxHp += 20;
    }
  }
  b.lvl = 1 + picks;
  return b;
}
