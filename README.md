# 黑客幸存者 · HACKER SURVIVORS

A pixel-art survivors game about crypto's worst hacks. Each of the 28 levels is a real hack, from Mt.Gox (2014) to Binance (2026). Survive the waves, then beat a boss built around how that hack worked.

像素风幸存者游戏：活过加密史上 28 场最狠的黑客攻击。

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
bun run dev      # local dev server
bun run build    # type-check + build into dist/
```

Debug URL flags: `?level=N` (jump to a level), `?boss=1` (skip to the boss), `?god=1`, `?unlock=all`, `?lang=zh|en`.

`tools/sim.js` is an autopilot for balance checks. Open the game with `?god=1`, then in the console:

```js
const { sim } = await import('/tools/sim.js'); (await sim(0, 27)).join('\n')
```

## Deploy

The site is static and runs on Cloudflare Workers (static assets).

```sh
cp .env.example .env   # set CLOUDFLARE_ACCOUNT_ID
bun run deploy         # build + wrangler deploy
```

## Tech

Vite + TypeScript + Canvas 2D. No game engine and no image files for sprites: all art is drawn in code, and all music and sound are made live with WebAudio.

## Credits

Font: [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) by TakWolf, under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).

## License

Code: [MIT](LICENSE). The font in `public/fonts/` keeps its own license (SIL OFL 1.1).
