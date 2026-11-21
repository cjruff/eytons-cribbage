import fs from "node:fs";
import { RANK } from "../js/cards.js";
import { scoreHand, handBreakdown, pegScore, pegPtsRanks, pegSolve } from "../js/scoring.js";
const d = JSON.parse(fs.readFileSync("py_scoring.json", "utf8"));
const report = (name, bad, total) => console.log(`${name.padEnd(30)} ${total - bad} / ${total} identical`);
let bad = 0;
d.hands.forEach(([h, s, c], i) => { if (scoreHand(h, s, c) !== d.scores[i]) bad++; });
report("hand / crib scores", bad, d.hands.length);
bad = 0; let k = 0;
for (const [h, s, c] of d.hands.slice(0, 40000)) {
  if (s === null) continue;
  if (JSON.stringify(handBreakdown(h, s, c)) !== JSON.stringify(d.breakdowns[k])) bad++;
  k++;
}
report("itemised count breakdowns", bad, k);
bad = 0;
for (const [seq, p, reasons, pr] of d.pegs) {
  const [jp, jr] = pegScore(seq);
  const count = seq.reduce((t, c) => t + Math.min(RANK[c], 10), 0);
  if (jp !== p || JSON.stringify(jr) !== JSON.stringify(reasons) || pegPtsRanks(seq.map((c) => RANK[c]), count) !== pr) bad++;
}
report("pegging scores + reasons", bad, d.pegs.length);
bad = 0;
for (const [m, t, seq, count, turn, last, v] of d.solves) if (pegSolve(m, t, seq, count, turn, last) !== v) bad++;
report("Expert solver positions", bad, d.solves.length);
