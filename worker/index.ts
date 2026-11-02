// Leaderboard API. Static files are served straight from dist/; only /api/* reaches this Worker
// (see run_worker_first in wrangler.jsonc).
//
// Scores come from the browser, so they can be forged. These checks only stop impossible ones:
//   - the run must have been registered by the same player when it started
//   - enough real time must have passed for the stages claimed
//   - assets must not exceed what those stages can pay out (shared rules in src/game/economy.ts)
import { cleanName, maxAssets, MIN_STAGE_SECONDS, STAGES } from '../src/game/economy';

interface Env { DB: D1Database; ASSETS: Fetcher }

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function id(v: unknown, field: string): string {
  if (typeof v !== 'string' || !ID.test(v)) throw new HttpError(400, `bad ${field}`);
  return v;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 1024) throw new HttpError(413, 'body too large');
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new HttpError(400, 'body is not JSON'); }
  if (typeof v !== 'object' || v === null) throw new HttpError(400, 'body must be an object');
  return v as Record<string, unknown>;
}

async function registerRun(req: Request, env: Env) {
  const b = await readBody(req);
  const runId = id(b.runId, 'runId'), player = id(b.playerId, 'playerId');
  await env.DB.prepare('INSERT INTO runs (id, player, started) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO NOTHING')
    .bind(runId, player, Date.now()).run();
  return json({ ok: true });
}

async function rankOf(env: Env, assets: number): Promise<number> {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE assets > ?1').bind(assets).first<{ n: number }>();
  if (!r) throw new Error('COUNT returned no row');
  return r.n + 1;
}

async function submitScore(req: Request, env: Env) {
  const b = await readBody(req);
  const runId = id(b.runId, 'runId'), player = id(b.playerId, 'playerId');
  const name = typeof b.name === 'string' ? cleanName(b.name) : null;
  if (!name) throw new HttpError(400, 'bad name');
  const { assets, cleared, won } = b;
  if (typeof cleared !== 'number' || !Number.isInteger(cleared) || cleared < 1 || cleared > STAGES) throw new HttpError(400, 'bad cleared');
  if (typeof won !== 'boolean' || won !== (cleared === STAGES)) throw new HttpError(400, 'bad won');
  if (typeof assets !== 'number' || !Number.isSafeInteger(assets) || assets < 0) throw new HttpError(400, 'bad assets');
  if (assets > maxAssets(cleared)) throw new HttpError(422, 'impossible score');

  const run = await env.DB.prepare('SELECT player, started FROM runs WHERE id = ?1').bind(runId).first<{ player: string; started: number }>();
  if (!run || run.player !== player) throw new HttpError(404, 'unknown run');
  if (Date.now() - run.started < cleared * MIN_STAGE_SECONDS * 1000) throw new HttpError(422, 'too fast');

  // Keep each player's best run; the name always follows the latest submission (renames).
  // SQLite evaluates every SET expression against the old row, so the order here does not matter.
  await env.DB.prepare(`
    INSERT INTO scores (player, name, assets, cleared, won, run, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(player) DO UPDATE SET
      name    = excluded.name,
      cleared = CASE WHEN excluded.assets > scores.assets THEN excluded.cleared ELSE scores.cleared END,
      won     = CASE WHEN excluded.assets > scores.assets THEN excluded.won ELSE scores.won END,
      run     = CASE WHEN excluded.assets > scores.assets THEN excluded.run ELSE scores.run END,
      updated = CASE WHEN excluded.assets > scores.assets THEN excluded.updated ELSE scores.updated END,
      assets  = MAX(excluded.assets, scores.assets)`)
    .bind(player, name, assets, cleared, won ? 1 : 0, runId, Date.now()).run();

  const best = await env.DB.prepare('SELECT assets FROM scores WHERE player = ?1').bind(player).first<{ assets: number }>();
  if (!best) throw new Error('score row missing right after upsert');
  return json({ rank: await rankOf(env, best.assets) });
}

interface Row { player: string; name: string; assets: number; cleared: number; won: number }
const entry = (r: Row, rank: number, me: string | null) =>
  ({ rank, name: r.name, assets: r.assets, cleared: r.cleared, won: r.won === 1, me: r.player === me });

async function top(url: URL, env: Env) {
  const p = url.searchParams.get('player');
  const me = p && ID.test(p) ? p : null;
  const { results } = await env.DB.prepare('SELECT player, name, assets, cleared, won FROM scores ORDER BY assets DESC, updated ASC LIMIT 10').all<Row>();
  const list = results.map((r, i) => entry(r, i + 1, me));
  let mine = null;
  if (me) {
    const r = await env.DB.prepare('SELECT player, name, assets, cleared, won FROM scores WHERE player = ?1').bind(me).first<Row>();
    if (r) mine = entry(r, await rankOf(env, r.assets), me);
  }
  return json({ top: list, me: mine });
}

async function api(req: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/run' && req.method === 'POST') return registerRun(req, env);
  if (url.pathname === '/api/score' && req.method === 'POST') return submitScore(req, env);
  if (url.pathname === '/api/top' && req.method === 'GET') return top(url, env);
  throw new HttpError(404, 'no such endpoint');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    // The one place errors are caught: turn them into HTTP responses.
    try {
      return await api(req, url, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[api] unexpected error', e);
      return json({ error: 'server error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
