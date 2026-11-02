import { defineConfig } from 'vite';

// `bun run dev` serves the game; run `bunx wrangler dev` alongside it for the /api leaderboard.
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
