// Mirror of py_driver.py for the JavaScript engine.
import fs from "node:fs";
import { CribbageEngine } from "../js/engine.js";
import { ComputerAI } from "../js/ai.js";
import { SeededRng } from "../js/rng.js";

let EVALS = [];
const hook = (opts, vals) => EVALS.push([...vals]);

export function game(n, levels, humanLevel, seed) {
  EVALS = [];
  const aiRngs = [1, 2].map((i) => new SeededRng(seed * 7 + i));
  const e = new CribbageEngine(n, levels, { deckRng: new SeededRng(seed), aiRngs });
  for (const p of e.players) if (p.ai) p.ai.onEvaluate = hook;
  const bot = new ComputerAI(humanLevel, new SeededRng(seed * 7 + 99));
  bot.onEvaluate = hook;
  let events = 0;
  const full = [];
  const origSay = e.say.bind(e);
  e.say = (msg) => { full.push(msg); origSay(msg); };
  e.observers.push(() => events++);
  e.cutForDeal();
  e.startRound();
  const me = e.players[e.human];
  for (let k = 0; k < 300; k++) {
    e.aiDiscards();
    e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === e.human, n));
    if (e.cutStarter()) break;
    e.startPegging();
    for (;;) {
      const st = e.pegAdvance();
      if (st === "human_play") {
        const c = bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(e.human),
          e.players[e.nxt(e.human)].pegHand.length);
        if (!e.humanPlay(c)) throw new Error("illegal play");
      } else if (st === "human_go") {
        if (!e.humanGo()) throw new Error("bad go");
      } else if (st === "done" || st === "over") break;
    }
    if (e.over) break;
    e.startShow();
    while (e.showNext()) if (e.over) break;
    if (e.over) break;
    e.nextRound();
  }
  const t = e.tally;
  const r = e.result();
  return {
    log: full, scores: e.players.map((p) => p.score), backs: e.players.map((p) => p.back),
    winner: e.winner, hands: e.handsPlayed, events,
    result: { won: r.won, human_score: r.humanScore, skunk_given: r.skunkGiven, skunked: r.skunked, margin: r.margin },
    tally: [t.hands, t.handPoints, t.highestHand, t.highestHandCards, t.cribs, t.cribPoints,
      t.highestCrib, t.pegPoints, t.highestPeg, t.twentyNines, t.zeroHands],
    evals: EVALS,
  };
}

if (process.argv[2]) {
  const cfgs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const t0 = Date.now();
  const out = cfgs.map((c) => ({ cfg: c, ...game(c.n, c.levels, c.human, c.seed) }));
  fs.writeFileSync(process.argv[3], JSON.stringify(out));
  console.log(`javascript: ${out.length} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
