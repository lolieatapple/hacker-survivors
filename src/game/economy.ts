// Score = "assets": US dollars the player keeps out of hackers' hands.
// Shared by the game and the leaderboard Worker, so both agree on the limits.

export const STAGES = 28;

/** Commonly reported USD loss of each hack, at the time it happened (index = stage). */
export const LOSS_USD: readonly number[] = [
  450e6,  // Mt.Gox: 850,000 BTC
  60e6,   // The DAO: 3.6M ETH
  72e6,   // Bitfinex: 119,756 BTC
  150e6,  // Parity: 513K ETH frozen
  530e6,  // Coincheck
  40e6,   // Binance 2019: 7,000 BTC
  281e6,  // KuCoin
  611e6,  // Poly Network
  326e6,  // Wormhole: 120,000 ETH
  625e6,  // Ronin
  182e6,  // Beanstalk
  190e6,  // Nomad
  570e6,  // BNB Bridge: 2M BNB minted
  114e6,  // Mango
  477e6,  // FTX
  197e6,  // Euler
  70e6,   // Curve
  126e6,  // Multichain
  305e6,  // DMM Bitcoin: 4,502 BTC
  235e6,  // WazirX
  1.46e9, // Bybit
  223e6,  // Cetus
  128e6,  // Balancer
  285e6,  // Drift
  292e6,  // KelpDAO: 116,500 rsETH
  319e6,  // Liquid
  388e6,  // Bitget
  6.3e9,  // Binance 2026
];
if (LOSS_USD.length !== STAGES) throw new Error(`LOSS_USD has ${LOSS_USD.length} entries, expected ${STAGES}`);

/** Dollars intercepted by a kill worth `xp` on stage `idx` (later stages are richer). */
export const killUsd = (xp: number, idx: number): number => Math.round(xp * 20_000 * (1 + idx * 0.1));

/** Share of the stolen funds recovered when the boss falls: all of it if fast, never below 40%. */
export const recoveryRate = (bossSeconds: number): number => Math.max(0.4, 1 - bossSeconds / 150);
export const recoveredUsd = (idx: number, bossSeconds: number): number => Math.round(LOSS_USD[idx] * recoveryRate(bossSeconds));

/** Each death costs this share of banked assets: the hackers got you. */
export const DEATH_FEE = 0.05;

/** A stage cannot be cleared faster than this (waves alone last 120 s). */
export const MIN_STAGE_SECONDS = 110;

/**
 * Highest assets that are possible after clearing `cleared` stages.
 * Generous on purpose: the server uses it only to reject impossible scores.
 */
export function maxAssets(cleared: number): number {
  let sum = 0;
  // 30000 XP per stage is a generous ceiling on kill income (tools/sim.js peaks near 14000 on long late stages).
  for (let i = 0; i < Math.min(cleared, STAGES); i++) sum += LOSS_USD[i] + killUsd(30000, i);
  return sum + killUsd(30000, Math.min(cleared, STAGES - 1)); // the stage in progress
}

/** "$12,345,678" */
export const usdFull = (n: number): string => '$' + Math.round(n).toLocaleString('en-US');
/** "$12.3M" / "$4.56B" for tight spots like the HUD. */
export function usdShort(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 1 : 2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/** Leaderboard nicknames: 1–12 letters, digits, spaces, `_ . -` (any script, so 中文 works). */
export const NAME_MAX = 12;
const NAME_RE = /^[\p{L}\p{N} _.\-]{1,12}$/u;
/** Trimmed, valid name, or null if it breaks the rules. */
export function cleanName(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, ' ');
  return NAME_RE.test(n) ? n : null;
}
