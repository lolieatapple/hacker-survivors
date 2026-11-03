// Dev-only balance harness. Not bundled. Open the game with ?sim=1 (add &god=1 for god mode),
// then in devtools:
//   const { sim } = await import('/tools/sim.js'); (await sim(0, 27)).join('\n')
// Plays one continuous run like a player: the build carries over, and a death retries the
// stage from its checkpoint (up to `retries` times) before giving up.
// Autopilot: kites in a circle during waves, weaving toward gems when nothing is right on top of it,
// and steps off the line of a MEV bot showing "!". During the boss it orbits the current target at ~70px
// while still dodging bullets, enemies, zones and fake gems; it switches to keys/gates/nodes while the
// boss is immune, stands next to static props to break them, and dodges inside peg zones.
// Upgrade cards are picked like a sensible player would (see pickCard), so the
// build is about as strong as a real player's; pass { randomPicks: true } for a weaker build.
// Evolve > level up a weapon > new weapon > power > max HP / armor > overclock > the rest.
const PASSIVE_PRIORITY = { power: 55, hp: 52, armor: 52, haste: 45, regen: 42, speed: 30, magnet: 10 };
function pickCard(choices) {
  const score = (c) => c.kind === 'weapon'
    ? (c.lvl === 10 ? 100 : c.lvl > 10 ? 44 : c.lvl > 1 ? 70 : 60)
    : PASSIVE_PRIORITY[c.id];
  return [...choices].sort((a, b) => score(b) - score(a))[0];
}

// probe(g, step): called every step, for digging into one fight.
// keepRun: play the run already set up (e.g. the same build on different stages) instead of a fresh debug run.
export async function sim(from, to, { seconds = 600, retries = 2, randomPicks = false, keepRun = false, probe = null } = {}) {
  const out = [];
  if (!keepRun) window.__debugRun(from);
  let tries = 0;
  for (let i = from; i <= to; ) {
    const startRun = window.__run();
    const startLvl = startRun.build.lvl;
    window.__app.play();
    const g = window.__game;
    g.overlay = null;
    const dt = 1 / 20;
    let steps = 0, err = null, bossStartLvl = null, maxEnemies = 0, ang = 0, wonT = null;
    // how close the stage came to killing us, split into the waves and the boss fight
    const hurt = { waves: { min: 1, taken: 0 }, boss: { min: 1, taken: 0 } };
    let prevHp = g.player.hp;
    // Wave enemies: how long they live, and how many ever reach the player. If they all die on the
    // way in, the waves can't hurt anyone, however many there are.
    const born = new Map(), reached = new Set(), lives = [];
    let leaked = 0;
    const kill = g.killEnemy.bind(g);
    g.killEnemy = (e) => {
      if (born.has(e) && g.phase === 'waves') { lives.push(g.time - born.get(e)); if (reached.has(e)) leaked++; }
      kill(e);
    };
    try {
      while (steps < seconds / dt) {
        steps++;
        const p = g.player;
        let tx = Math.cos(ang), ty = Math.sin(ang);
        ang += dt * 0.6;
        // flee from nearby enemies (weighted by 1/d^2), otherwise go collect the nearest gem
        let fx = 0, fy = 0;
        for (const e of g.enemies) {
          const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < 70 * 70 && d2 > 0) { fx += dx / d2; fy += dy / d2; }
        }
        for (const k of g.pickups) { // step around red phishing gems, as a player would
          if (k.kind !== 'fake') continue;
          const dx = p.x - k.x, dy = p.y - 6 - k.y, d2 = dx * dx + dy * dy;
          if (d2 < 40 * 40 && d2 > 0) { fx += (dx / d2) * 2; fy += (dy / d2) * 2; }
        }
        for (const e of g.enemies) { // MEV bot showing "!" (winding up) or dashing: step off its line, as a player would
          const k = e.data;
          if (!k || !(k.state === 1 || k.state === 2) || k.dx === undefined) continue;
          const rx = p.x - e.x, ry = p.y - e.y, d = Math.hypot(rx, ry);
          if (d > 140) continue;
          const along = rx * k.dx + ry * k.dy, side = rx * -k.dy + ry * k.dx;
          if (along < -10 || Math.abs(side) > 22) continue; // behind it, or already off the line
          const s = side >= 0 ? 1 : -1;
          fx += -k.dy * s * 0.08; fy += k.dx * s * 0.08;
        }
        for (const b of g.ebullets) {
          const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 30 * 30 && d2 > 0) { fx += (dx / d2) * 2; fy += (dy / d2) * 2; }
        }
        for (const z of g.zones) { // step out of damage zones, including telegraphed ones
          if (z.kind === 'peg') continue;
          const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) || 1;
          if (d < z.r + 10) { fx += (dx / d) * 0.05; fy += (dy / d) * 0.05; }
        }
        const flee = Math.hypot(fx, fy);
        const gem = g.pickups.filter((k) => k.kind !== 'fake').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        const gd = gem ? Math.hypot(gem.x - p.x, gem.y - p.y) || 1 : Infinity;
        if (flee > 0.002) {
          const l = Math.hypot(fx, fy); tx = fx / l + Math.cos(ang) * 0.3; ty = fy / l + Math.sin(ang) * 0.3;
          // nothing right on top of us: weave toward gems while backing off, as a player would. Without
          // this, a horde that lives longer kept the autopilot fleeing and it never levelled (gems piled up).
          if (gd < 120 && flee < 0.02) { tx += ((gem.x - p.x) / gd) * 0.8; ty += ((gem.y - p.y) / gd) * 0.8; }
        } else if (gd < 150) { tx = gem.x - p.x; ty = gem.y - p.y; }
        { const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; }
        if (g.phase === 'boss') {
          const all = g.bossUnits().filter((e) => !e.hidden);
          const bossInv = all.some((e) => e.tag === 'boss' && e.invuln);
          const tgt = (bossInv && all.find((e) => !['boss', 'decoy', 'clone'].includes(e.tag))) || all.find((e) => e.tag === 'boss') || all[0];
          if (tgt) {
            const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
            // static props that can't hurt on touch (gates, nodes, oracle orbs): stand next to them so short-range
            // weapons reach. Not Ronin's keys: they circle the boss, and hugging them means touching it.
            const prop = tgt.noContact && tgt.speed === 0;
            const radial = (d - (prop ? 24 : 70)) / 30;
            let ox = (dx / d) * radial + (-dy / d) * 0.8, oy = (dy / d) * radial + (dx / d) * 0.8;
            { const l = Math.hypot(ox, oy) || 1; ox /= l; oy /= l; }
            // keep dodging while circling: blend in the flee direction when something is close
            // ...but don't let the horde push us away from a prop we must break (a player would push through)
            // nor drift away from a slow boss (Bitget barely moves: the horde pushed us 1000 px off and it never got hit)
            const w = Math.min(prop || d > 110 ? 0.5 : 1, flee / 0.01);
            tx = ox * (1 - 0.7 * w) + (flee > 0 ? (fx / flee) * w : 0);
            ty = oy * (1 - 0.7 * w) + (flee > 0 ? (fy / flee) * w : 0);
            const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          }
        }
        if (g.arena) { // stay inside a shrinking safe zone: outside it hurts every tick
          const dx = g.arena.x - p.x, dy = g.arena.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d > g.arena.r - 14) { tx = dx / d; ty = dy / d; }
        }
        const peg = g.zones.find((z) => z.kind === 'peg' && z.warn <= 0);
        // get into the peg circle, then keep dodging inside it (standing still in it ate every ring)
        if (peg) { const d = Math.hypot(peg.x - p.x, peg.y - p.y) || 1; if (d > peg.r - 10) { tx = (peg.x - p.x) / d; ty = (peg.y - p.y) / d; } }
        if (g.fx.invert > 0) { tx = -tx; ty = -ty; }
        if (g.fx.freeze > 0) { tx = 0; ty = 0; }
        p.x += tx * p.speed * dt; p.y += ty * p.speed * dt;
        if (tx || ty) p.facing = [tx, ty];
        if (g.overlay === 'levelup') { g.applyChoice(randomPicks ? g.choices[Math.floor(Math.random() * g.choices.length)] : pickCard(g.choices)); g.overlay = null; }
        if (g.overlay === 'clear' || g.overlay === 'dead') break;
        if (g.phase === 'boss' && bossStartLvl === null) bossStartLvl = p.lvl;
        if (g.phase === 'won' && wonT === null) wonT = g.time;
        g.update(dt);
        if (probe) probe(g, steps);
        maxEnemies = Math.max(maxEnemies, g.enemies.length);
        if (g.phase === 'waves') for (const e of g.enemies) {
          if (e.boss || e.dead) continue;
          if (!born.has(e)) born.set(e, g.time);
          if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < 25) reached.add(e);
        }
        const h = g.phase === 'boss' || g.phase === 'won' ? hurt.boss : hurt.waves;
        if (g.player.hp < prevHp) h.taken += prevHp - g.player.hp;
        prevHp = g.player.hp;
        h.min = Math.min(h.min, g.player.hp / g.player.maxHp);
        if (steps % 400 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } catch (e) { err = String((e && e.stack) || e).slice(0, 400); }
    const weapons = g.weapons.map((w) => w.id + w.lvl).join(',');
    const bossUnit = g.bossUnits().find((e) => e.tag === 'boss'); // HP left on a failed boss fight
    const bossLeft = bossUnit && g.overlay !== 'clear' ? ` bossLeft=${Math.round((bossUnit.hp / bossUnit.maxHp) * 100)}%` : '';
    const run = window.__run();
    const assets = run ? run.assets : g.banked + g.earned; // run is null after the final stage
    out.push(`L${i + 1}${tries ? ' retry' + tries : ''} ${g.overlay || g.phase} t=${Math.round(g.time)} wonT=${wonT === null ? '-' : Math.round(wonT)} bossT=${Math.round(g.bossTime)} lvl=${startLvl}->${g.player.lvl} hp=${g.player.maxHp} waves[min=${Math.round(hurt.waves.min * 100)}% dmg=${Math.round(hurt.waves.taken)}] boss[min=${Math.round(hurt.boss.min * 100)}% dmg=${Math.round(hurt.boss.taken)}] kills=${g.kills} kill$=${(g.earned / 1e6).toFixed(0)}M killXp=${Math.round(g.earned / (20000 * (1 + i * 0.1)))} life=${lives.length ? (lives.reduce((a, b) => a + b, 0) / lives.length).toFixed(1) : '-'}s reach=${lives.length ? Math.round((leaked / lives.length) * 100) : 0}% assets=$${(assets / 1e6).toFixed(0)}M [${weapons}] maxE=${maxEnemies}${bossLeft}${err ? ' ERR ' + err : ''}`);
    if (err) break;
    if (g.overlay === 'clear') { i++; tries = 0; }
    else if (++tries > retries) { out.push(`gave up at L${i + 1}`); break; }
  }
  return out;
}
