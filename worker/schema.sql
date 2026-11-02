-- Leaderboard storage (Cloudflare D1 / SQLite).
-- Apply: bunx wrangler d1 execute hacker-survivors --remote --file=worker/schema.sql

-- Every run registers when it starts, so a score can be checked against real elapsed time.
CREATE TABLE IF NOT EXISTS runs (
  id      TEXT PRIMARY KEY,
  player  TEXT NOT NULL,
  started INTEGER NOT NULL          -- unix ms, server clock
);

-- One row per player: their best run so far.
CREATE TABLE IF NOT EXISTS scores (
  player  TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  assets  INTEGER NOT NULL,         -- USD
  cleared INTEGER NOT NULL,         -- stages cleared in that run
  won     INTEGER NOT NULL,         -- 1 if all 28 were cleared
  run     TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_by_assets ON scores (assets DESC);
