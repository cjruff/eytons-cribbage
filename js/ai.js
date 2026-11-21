// Computer opponents.  Difficulty changes how well the computer thinks, never the cards.
// The computer only ever knows its own cards plus what has been played face up.
// Code: (c) Corey J Ruff
//
// Skill ladder (measured with duplicate deals, same cards both ways):
//   Easy   - half its discards are random; mostly random pegging.
//   Medium - keeps the best-looking 4 cards; grabs any pegging points it sees.
//   Hard   - also weighs what it gives the crib; avoids leaving counts of 5 / 21.
//   Expert - averages its hand over every possible starter, weighs the crib, and in
//            2-player solves the rest of the pegging exactly over dozens of simulated
//            opponent hands (3-player: probabilistic look-ahead).
import { RANK, SUIT, VAL, combinations } from "./cards.js";
import { scoreHand, pegScore, pegPtsRanks, pegSolve } from "./scoring.js";

export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];
const EXPERT_SOLVER_SAMPLES = 40;

export class ComputerAI {
  /** rng: decision randomness only - never used for dealing. */
  constructor(level, rng = null) {
    this.level = level;
    this.rng = rng || { random: Math.random };
    if (!this.rng.choice) {                       // allow a bare {random} object
      const base = this.rng;
      this.rng = {
        random: () => base.random(),
        randrange: (n) => Math.floor(base.random() * n),
        choice(a) { return a[this.randrange(a.length)]; },
        sample(arr, k) {
          const pool = arr.slice();
          for (let i = 0; i < k; i++) {
            const j = i + this.randrange(pool.length - i);
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          return pool.slice(0, k);
        },
      };
    }
    this.onEvaluate = null;                       // test hook: (options, values) => void
  }

  // ----- discarding -----
  chooseDiscards(hand, nDiscard, isDealer, nPlayers) {
    const options = combinations(hand, nDiscard);
    const lvl = this.level;
    const sign = isDealer ? 1.0 : -1.0;
    const keep = (o) => hand.filter((c) => !o.includes(c));
    if (lvl === "Easy") {
      if (this.rng.random() < 0.5) return this.rng.choice(options);
      return this._best(options, (o) => scoreHand(keep(o)));
    }
    if (lvl === "Medium") return this._best(options, (o) => scoreHand(keep(o)));
    if (lvl === "Hard") return this._best(options, (o) => scoreHand(keep(o)) + sign * cribHeuristic(o));
    const unseen = [];
    for (let c = 0; c < 52; c++) if (!hand.includes(c)) unseen.push(c);
    return this._best(options, (o) => {
      const k = keep(o);
      let h = 0;
      for (const s of unseen) h += scoreHand(k, s);
      return h / unseen.length + sign * cribHeuristic(o);
    });
  }

  _best(options, fn) {
    let best = [], bestV = null;
    const values = [];
    for (const o of options) {
      const v = fn(o);
      values.push(v);
      if (bestV === null || v > bestV + 1e-9) { best = [o]; bestV = v; }
      else if (Math.abs(v - bestV) <= 1e-9) best.push(o);
    }
    if (this.onEvaluate) this.onEvaluate(options, values);
    return this.rng.choice(best);
  }

  // ----- pegging -----
  choosePlay(hand, seq, count, unseen, oppCards, nPlayers = 2) {
    const legal = hand.filter((c) => VAL[c] + count <= 31);
    if (!legal.length) return null;
    if (legal.length === 1) return legal[0];
    const imm = new Map(legal.map((c) => [c, pegScore([...seq, c])[0]]));
    const lvl = this.level;
    if (lvl === "Easy") {
      if (this.rng.random() < 0.7) return this.rng.choice(legal);
      return this._best(legal, (c) => imm.get(c));
    }
    if (lvl === "Medium") return this._best(legal, (c) => imm.get(c));
    if (lvl === "Hard") {
      return this._best(legal, (c) => {
        let v = imm.get(c);
        const nc = count + VAL[c];
        if (nc === 5 || nc === 21) v -= 0.8;
        if (count === 0 && RANK[c] === 5) v -= 0.8;
        return v;
      });
    }
    if (nPlayers === 2 && oppCards && unseen.length >= oppCards) {
      return this._solverPlay(hand, legal, seq, count, unseen, oppCards);
    }
    return this._lookaheadPlay(hand, legal, imm, seq, count, unseen, oppCards);
  }

  /** Immediate points minus the next player's expected reply. */
  _lookaheadPlay(hand, legal, imm, seq, count, unseen, oppCards) {
    return this._best(legal, (c) => {
      const nc = count + VAL[c];
      let v = imm.get(c);
      if (nc < 31 && oppCards && unseen.length) {
        let tot = 0;
        const ns = [...seq, c];
        for (const u of unseen) if (VAL[u] + nc <= 31) tot += pegScore([...ns, u])[0];
        v -= tot / unseen.length * Math.min(oppCards, 3) * 0.6;
      }
      if (count === 0) {
        if (RANK[c] === 5) v -= 0.6;
        if (hand.some((x) => x !== c && RANK[x] === RANK[c])) v += 0.3;
        if (VAL[c] < 5) v += 0.2;
      }
      return v;
    });
  }

  /** Sample plausible opponent hands and solve the rest of the pegging exactly. */
  _solverPlay(hand, legal, seq, count, unseen, oppCards) {
    const mine = hand.map((c) => RANK[c]).sort((a, b) => a - b);
    const sr = seq.map((c) => RANK[c]);
    const byRank = new Map();
    for (const c of legal) if (!byRank.has(RANK[c])) byRank.set(RANK[c], c);   // suits never matter
    const samples = [];
    for (let i = 0; i < EXPERT_SOLVER_SAMPLES; i++) {
      samples.push(this.rng.sample(unseen, oppCards).map((c) => RANK[c]).sort((a, b) => a - b));
    }
    return this._best([...byRank.values()], (c) => {
      const r = RANK[c];
      const rest = [...mine];
      rest.splice(rest.indexOf(r), 1);
      const ns = [...sr, r];
      const nc = count + Math.min(r, 10);
      const p = pegPtsRanks(ns, nc);
      let tot = 0;
      for (const opp of samples) {
        tot += nc === 31 ? pegSolve(rest, opp, [], 0, 1, -1) : pegSolve(rest, opp, ns.slice(-7), nc, 1, 0);
      }
      return p + tot / samples.length;
    });
  }
}

export function cribHeuristic(disc) {
  let v = 0.0;
  for (const c of disc) {
    if (RANK[c] === 5) v += 1.3;
    else if (RANK[c] === 11) v += 0.25;
  }
  if (disc.length === 2) {
    const [a, b] = disc;
    if (RANK[a] === RANK[b]) v += 2.4;
    if (VAL[a] + VAL[b] === 15) v += 2.2;
    const d = Math.abs(RANK[a] - RANK[b]);
    if (d === 1) v += 1.0;
    else if (d === 2) v += 0.45;
    if (SUIT[a] === SUIT[b]) v += 0.1;
  }
  return v;
}
