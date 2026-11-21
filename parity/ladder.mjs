import { CribbageEngine } from "../js/engine.js";
import { ComputerAI } from "../js/ai.js";
import { CryptoRng } from "../js/rng.js";
function play(n, levels, humanLevel) {
  const e = new CribbageEngine(n, levels, { deckRng: new CryptoRng() });
  const bot = new ComputerAI(humanLevel);
  e.cutForDeal(); e.startRound();
  const me = e.players[0];
  for (let k = 0; k < 300 && !e.over; k++) {
    e.aiDiscards();
    e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === 0, n));
    if (e.cutStarter()) break;
    e.startPegging();
    for (;;) {
      const st = e.pegAdvance();
      if (st === "human_play") e.humanPlay(bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(0), e.players[1].pegHand.length));
      else if (st === "human_go") e.humanGo();
      else if (st === "done" || st === "over") break;
    }
    if (e.over) break;
    e.startShow();
    while (e.showNext()) if (e.over) break;
    if (!e.over) e.nextRound();
  }
  return e.winner === 0;
}
const N = 400;
for (const [a, b] of [["Medium", "Easy"], ["Hard", "Medium"], ["Expert", "Hard"]]) {
  let w = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) w += play(2, b, a);
  console.log(`${a} beats ${b}: ${(100 * w / N).toFixed(0)}% of ${N} games  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
// Expert decision speed
const ai = new ComputerAI("Expert");
const r = new CryptoRng();
let worst = 0, tot = 0;
for (let i = 0; i < 200; i++) {
  const cards = r.sample([...Array(52).keys()], 12);
  const unseen = [...Array(52).keys()].filter((c) => !cards.slice(0, 6).includes(c));
  const t = performance.now(); ai.choosePlay(cards.slice(0, 4), [], 0, unseen, 4, 2); const dt = performance.now() - t;
  worst = Math.max(worst, dt); tot += dt;
}
let t = performance.now(); for (let i = 0; i < 20; i++) ai.chooseDiscards(r.sample([...Array(52).keys()], 6), 2, true, 2);
console.log(`Expert pegging decision: avg ${(tot / 200).toFixed(0)} ms, worst ${worst.toFixed(0)} ms | discard: ${((performance.now() - t) / 20).toFixed(0)} ms`);
