// Mirror of py_session.py, using the web modules (GameSession, StatsStore, AchievementTracker).
import fs from "node:fs";
import { ComputerAI, DIFFICULTIES } from "../js/ai.js";
import { SeededRng } from "../js/rng.js";
import { normalizeSettings, PRESET_OPPONENTS } from "../js/settings.js";
import { StatsStore, STAT_ROWS } from "../js/stats.js";
import { AchievementTracker, seedFromStats, ACHIEVEMENTS } from "../js/achievements.js";
import { GameSession } from "../js/session.js";

function play(e, bot, n, stopAfter) {
  e.cutForDeal(); e.startRound();
  const me = e.players[e.human];
  for (let k = 0; k < 300; k++) {
    e.aiDiscards();
    e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === e.human, n));
    if (e.cutStarter()) break;
    e.startPegging();
    for (;;) {
      const st = e.pegAdvance();
      if (st === "human_play") e.humanPlay(bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(e.human),
        e.players[e.nxt(e.human)].pegHand.length, n));
      else if (st === "human_go") e.humanGo();
      else if (st === "done" || st === "over") break;
    }
    if (e.over) break;
    e.startShow();
    while (e.showNext()) if (e.over) break;
    if (e.over) break;
    if (stopAfter && e.handsPlayed >= stopAfter) return "abandoned";
    e.nextRound();
  }
  return "done";
}

function runSeries(cfg, prior) {
  const s = normalizeSettings(cfg.settings);
  const stats = new StatsStore(prior ? structuredClone(prior) : null);
  const tracker = new AchievementTracker(null, { seed: seedFromStats(stats) });
  const games = [];
  for (let g = 0; g < cfg.games; g++) {
    const seed = cfg.seed + g;
    const said = [];
    const sess = new GameSession(s, stats, tracker, {
      deckRng: new SeededRng(seed), aiRngs: [1, 2].map((i) => new SeededRng(seed * 7 + i)),
      onSay: (pi, line, trig) => said.push([pi, trig, line]),
    });
    const e = sess.engine;
    const bot = new ComputerAI(cfg.human, new SeededRng(seed * 7 + 99));
    const ab = cfg.abandon_every;
    const how = play(e, bot, s.players, ab && g % ab === ab - 1 ? 3 : null);
    if (how === "abandoned") sess.abandon(); else sess.finish();
    games.push({ how, said, new: tracker.newThisGame.map(([a, t]) => [a.id, t]), winner: e.winner, scores: e.players.map((p) => p.score) });
  }
  const views = [];
  for (const p of [null, 2, 3]) {
    for (const d of [null, ...DIFFICULTIES]) views.push(stats.aggregate(p, d));
    for (const o of PRESET_OPPONENTS) views.push(stats.aggregate(p, null, o));
  }
  const rows = views.map((v) => STAT_ROWS.map(([, fn]) => String(fn(v))));
  const sm = tracker.summary();
  return { games, stats: stats.data, ach: tracker.data, rows, views, summary: [sm.got, sm.total, sm.medals],
    progress: ACHIEVEMENTS.map((a) => tracker.progressText(a)) };
}

const cfgs = JSON.parse(fs.readFileSync("session_configs.json", "utf8"));
const t0 = Date.now();
const out = [];
let prior = null;
for (const c of cfgs) {
  const r = runSeries(c, c.prior_stats ? prior : null);
  prior = r.stats;
  out.push(r);
}
fs.writeFileSync("js_session.json", JSON.stringify(out));
console.log(`javascript: ${out.length} profiles, ${out.reduce((t, r) => t + r.games.length, 0)} games in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
