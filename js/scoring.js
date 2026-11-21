// Scoring rules: hands, cribs, pegging, and the exact pegging solver used by Expert.
// Code: (c) Corey J Ruff
import { RANK, SUIT, VAL, sortCards, combinations, product } from "./cards.js";

const range = (n) => Array.from({ length: n }, (_, i) => i);
const SUBSETS = {};
const PAIRS = {};
for (const n of [2, 3, 4, 5]) {
  SUBSETS[n] = [];
  for (let r = 2; r <= n; r++) SUBSETS[n].push(...combinations(range(n), r));
  PAIRS[n] = combinations(range(n), 2);
}

function runPoints(ranks) {
  const counts = new Array(15).fill(0);
  for (const r of ranks) counts[r]++;
  let total = 0;
  let i = 1;
  while (i <= 13) {
    if (counts[i]) {
      let j = i, mult = 1;
      while (j <= 13 && counts[j]) { mult *= counts[j]; j++; }
      if (j - i >= 3) total += (j - i) * mult;
      i = j;
    } else {
      i++;
    }
  }
  return total;
}

/** Fast hand score.  hand = 4 cards (or fewer); starter may be null. */
export function scoreHand(hand, starter = null, isCrib = false) {
  const cards = starter === null ? [...hand] : [...hand, starter];
  const n = cards.length;
  if (n < 2) return 0;
  const vals = cards.map((c) => VAL[c]);
  const ranks = cards.map((c) => RANK[c]);
  let pts = 0;
  for (const sub of SUBSETS[n]) {
    let s = 0;
    for (const i of sub) s += vals[i];
    if (s === 15) pts += 2;
  }
  for (const [i, j] of PAIRS[n]) if (ranks[i] === ranks[j]) pts += 2;
  pts += runPoints(ranks);
  if (hand.length >= 4) {
    const s0 = SUIT[hand[0]];
    if (hand.every((c) => SUIT[c] === s0)) {
      if (starter !== null && SUIT[starter] === s0) pts += hand.length + 1;
      else if (!isCrib) pts += hand.length;
    }
  }
  if (starter !== null) {
    for (const c of hand) if (RANK[c] === 11 && SUIT[c] === SUIT[starter]) pts += 1;
  }
  return pts;
}

/** Itemised count: array of [label, cards, points] in standard counting order. */
export function handBreakdown(hand, starter, isCrib = false) {
  const cards = [...hand, starter];
  const items = [];
  for (let r = 2; r <= 5; r++) {
    for (const sub of combinations(cards, r)) {
      if (sub.reduce((t, c) => t + VAL[c], 0) === 15) items.push(["Fifteen", sortCards(sub), 2]);
    }
  }
  for (const [a, b] of combinations(cards, 2)) {
    if (RANK[a] === RANK[b]) items.push(["Pair", sortCards([a, b]), 2]);
  }
  const byRank = new Map();
  for (const c of cards) {
    if (!byRank.has(RANK[c])) byRank.set(RANK[c], []);
    byRank.get(RANK[c]).push(c);
  }
  let r = 1;
  while (r <= 13) {
    if (byRank.has(r)) {
      let j = r;
      while (byRank.has(j)) j++;
      if (j - r >= 3) {
        const lists = [];
        for (let k = r; k < j; k++) lists.push(byRank.get(k));
        for (const combo of product(lists)) items.push([`Run of ${j - r}`, combo, j - r]);
      }
      r = j;
    } else {
      r++;
    }
  }
  const s0 = SUIT[hand[0]];
  if (hand.every((c) => SUIT[c] === s0)) {
    if (SUIT[starter] === s0) items.push(["Flush", sortCards(cards), 5]);
    else if (!isCrib) items.push(["Flush", sortCards(hand), 4]);
  }
  for (const c of hand) {
    if (RANK[c] === 11 && SUIT[c] === SUIT[starter]) items.push(["His Nobs", [c, starter], 1]);
  }
  return items;
}

/** Points for the card just played (last of seq).  Returns [points, reasons]. */
export function pegScore(seq) {
  let count = 0;
  for (const c of seq) count += VAL[c];
  let pts = 0;
  const reasons = [];
  if (count === 15) { pts += 2; reasons.push("Fifteen for 2"); }
  else if (count === 31) { pts += 2; reasons.push("Thirty-one for 2"); }
  const r = RANK[seq[seq.length - 1]];
  let k = 1;
  for (let i = seq.length - 2; i >= 0; i--) {
    if (RANK[seq[i]] === r) k++;
    else break;
  }
  if (k >= 2) {
    const [p, name] = { 2: [2, "Pair"], 3: [6, "Pair royal"], 4: [12, "Double pair royal"] }[k];
    pts += p;
    reasons.push(`${name} for ${p}`);
  }
  for (let length = seq.length; length > 2; length--) {
    const rs = seq.slice(-length).map((c) => RANK[c]).sort((a, b) => a - b);
    let ok = true;
    for (let i = 0; i < length - 1; i++) {
      if (rs[i + 1] - rs[i] !== 1) { ok = false; break; }
    }
    if (ok) {
      pts += length;
      reasons.push(`Run of ${length} for ${length}`);
      break;
    }
  }
  return [pts, reasons];
}

/** pegScore for a list of ranks; count = running total including the last card. */
export function pegPtsRanks(seq, count) {
  let pts = count === 15 || count === 31 ? 2 : 0;
  const r = seq[seq.length - 1];
  let k = 1;
  for (let i = seq.length - 2; i >= 0; i--) {
    if (seq[i] === r) k++;
    else break;
  }
  pts += [0, 0, 2, 6, 12][k];
  for (let length = seq.length; length > 2; length--) {
    const rs = seq.slice(-length).sort((a, b) => a - b);
    if (rs[rs.length - 1] - rs[0] === length - 1 && new Set(rs).size === length) {
      pts += length;
      break;
    }
  }
  return pts;
}

const rv = (r) => (r < 10 ? r : 10);
const solveCache = new Map();

/** Exact rest-of-pegging value (my points minus theirs) with both hands known.
 *  mine/theirs: sorted rank arrays.  turn: 0 = me, 1 = them.  last: -1 = nobody. */
export function pegSolve(mine, theirs, seq, count, turn, last) {
  const key = `${mine}|${theirs}|${seq}|${count}|${turn}|${last}`;
  const hit = solveCache.get(key);
  if (hit !== undefined) return hit;
  let result;
  if (!mine.length && !theirs.length) {
    result = seq.length && count !== 31 && last >= 0 ? (last === 0 ? 1 : -1) : 0;
  } else {
    const cur = turn === 0 ? mine : theirs;
    const legal = [...new Set(cur.filter((r) => count + rv(r) <= 31))].sort((a, b) => a - b);
    if (!legal.length) {
      const other = turn === 0 ? theirs : mine;
      if (other.some((r) => count + rv(r) <= 31)) {
        result = pegSolve(mine, theirs, seq, count, 1 - turn, last);
      } else {
        const pt = last >= 0 ? (last === 0 ? 1 : -1) : 0;
        const nxt = last >= 0 ? 1 - last : 1 - turn;
        result = pt + pegSolve(mine, theirs, [], 0, nxt, -1);
      }
    } else {
      const sgn = turn === 0 ? 1 : -1;
      let best = null;
      for (const r of legal) {
        let m2 = mine, t2 = theirs;
        if (turn === 0) { m2 = [...mine]; m2.splice(m2.indexOf(r), 1); }
        else { t2 = [...theirs]; t2.splice(t2.indexOf(r), 1); }
        const ns = [...seq.slice(-7), r];       // runs/pairs never look back further than this
        const nc = count + rv(r);
        let v = sgn * pegPtsRanks(ns, nc);
        if (nc === 31) v += pegSolve(m2, t2, [], 0, 1 - turn, -1);
        else v += pegSolve(m2, t2, ns, nc, 1 - turn, turn);
        if (best === null || (turn === 0 ? v > best : v < best)) best = v;
      }
      result = best;
    }
  }
  if (solveCache.size > 400000) solveCache.clear();
  solveCache.set(key, result);
  return result;
}
