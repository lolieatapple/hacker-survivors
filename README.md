# 黑客幸存者 · HACKER SURVIVORS

A pixel-art survivors game about crypto's worst hacks. One run is 28 stages in a row, each a real hack, from Mt.Gox (2014) to Binance (2026). Survive the waves, then beat a boss built around how that hack worked.

像素风幸存者游戏：一口气活过加密史上 28 场最狠的黑客攻击，守住的资产就是你的分数。

## How a run works

- Your build carries over from stage to stage. Weapons evolve at Lv 10 and keep overclocking after that; all six can be owned at once.
- Your score is your assets in USD: every hacker you kill is money you intercept, and every boss you beat recovers part of what that hack stole (more if you beat it fast).
- Each stage start is a checkpoint. Die and you retry the stage, but the hackers take 5% of your assets and the upgrades from the failed try are lost.
- Enemies keep pace with your build. Each stage brings more of them, and they are tougher, faster and hit harder. Elites come in larger packs, and rings close in more often. New kinds join the horde: phishers shoot hooks (from stage 4), MEV bots wind up and dash (stage 7), and Lazarus agents are fast tanks (stage 13). A red "!" shows just before they strike.
- Stuck on a stage? Each death there cuts its enemies' HP and damage by 8%, down to 60%. The bonus resets once you clear the stage.
- Set a nickname and your best run goes on the global leaderboard. You can also post your score to X.

**Play:** https://hacker-survivors.lolieatapple.workers.dev

Works on desktop and phones, in Chinese and English, and inside an X (Twitter) Player Card.

## Controls

- Move: WASD / arrow keys, or drag anywhere on a touch screen
- Pick upgrades: tap a card, arrows + Enter, or keys 1–3
- Pause: Esc / P · Mute: M · Language (title screen): L

## Develop

Needs [Bun](https://bun.sh).

```sh
bun install
bun run dev      # game on Vite; /api is proxied to port 8787
bunx wrangler dev --port 8787   # leaderboard Worker with a local D1 (second terminal)
bun test         # unit tests
bun run build    # type-check game + Worker, build into dist/
```

First time with a local database: `bunx wrangler d1 execute hacker-survivors --local --file=worker/schema.sql`.

Debug URL flags: `?level=N` (start a run at stage N with a random build), `?boss=1` (skip to the boss), `?god=1`, `?sim=1`, `?lang=zh|en`. A debug run never touches your save or the leaderboard.

`tools/sim.js` is an autopilot for balance checks. Open the game with `?sim=1` (add `&god=1` for god mode), then in the console:

```js
const { sim } = await import('/tools/sim.js'); (await sim(0, 27)).join('\n')
```

Difficulty lives in `src/game/difficulty.ts`, which is plain functions with unit tests. Enemy HP follows build damage measured with the sim. Builds vary a lot from run to run, so judge any change on a few runs side by side.

## Deploy

Static files are served by Cloudflare Workers static assets. Only `/api/*` runs the Worker in `worker/index.ts`, which keeps the leaderboard in Cloudflare D1.

```sh
cp .env.example .env   # set CLOUDFLARE_ACCOUNT_ID
bunx wrangler d1 execute hacker-survivors --remote --file=worker/schema.sql   # once
bun run deploy         # build + wrangler deploy
```

Scores come from the browser, so the server only rejects impossible ones: the run must have been registered when it started, enough real time must have passed for the stages claimed, and the assets must not exceed what those stages can pay out (rules shared with the game in `src/game/economy.ts`).

## Tech

Vite + TypeScript + Canvas 2D. No game engine and no image files for sprites: all art is drawn in code, and all music and sound are made live with WebAudio.

## Credits

Font: [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) by TakWolf, under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).

## License

Code: [MIT](LICENSE). The font in `public/fonts/` keeps its own license (SIL OFL 1.1).
