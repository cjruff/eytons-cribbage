// Lifetime statistics (ported from StatsStore in cribbage.py).
// The saved data uses the same layout as the Python stats.json, so old files import as-is.
// Code: (c) Corey J Ruff
import { DIFFICULTIES } from "./ai.js";
import { today } from "./settings.js";

export const COUNT_FIELDS = ["games_played", "wins", "losses", "abandoned", "skunks_given",
  "double_skunks_given", "skunked", "double_skunked", "hands_counted",
  "hand_points", "cribs_counted", "crib_points", "peg_points",
  "twenty_nines", "zero_hands", "points_scored"];
export const MAX_FIELDS = ["highest_hand", "highest_crib", "highest_peg", "best_streak", "biggest_win_margin"];

export function emptyBucket() {
  const b = {};
  for (const f of [...COUNT_FIELDS, ...MAX_FIELDS]) b[f] = 0;
  b.current_streak = 0; b.highest_hand_cards = ""; b.last_played = "";
  return b;
}

export class StatsStore {
  /** data: the saved object (or null); onSave(data) is called after every change. */
  constructor(data = null, onSave = null, date = today) {
    this.data = data && typeof data === "object" ? data : {};
    this.onSave = onSave;
    this.date = date;
  }
  static key(players, difficulty) { return `${players}p|${difficulty}`; }
  save() { if (this.onSave) this.onSave(this.data); }
  reset() { this.data = {}; this.save(); }

  /** outcome: "win", "loss" or "abandoned".  Filed under the skill level and under each
   *  preset family opponent who played (lower-case base names, e.g. "grandpa"). */
  record(players, difficulty, tally, outcome, result = null, opponents = []) {
    const keys = [StatsStore.key(players, difficulty), ...[...new Set(opponents)].map((o) => StatsStore.key(players, "vs:" + o))];
    for (const k of keys) this._recordInto(k, tally, outcome, result);
    this.save();
  }

  _recordInto(key, t, outcome, result) {
    const b = (this.data[key] ||= emptyBucket());
    for (const [f, v] of Object.entries(emptyBucket())) if (!(f in b)) b[f] = v;
    b.hands_counted += t.hands;
    b.hand_points += t.handPoints;
    b.cribs_counted += t.cribs;
    b.crib_points += t.cribPoints;
    b.twenty_nines += t.twentyNines;
    b.zero_hands += t.zeroHands;
    if (t.highestHand > b.highest_hand ||
        (t.highestHandCards && !b.highest_hand_cards && t.highestHand === b.highest_hand)) {
      b.highest_hand = t.highestHand;
      b.highest_hand_cards = t.highestHandCards;
    }
    b.highest_crib = Math.max(b.highest_crib, t.highestCrib);
    b.highest_peg = Math.max(b.highest_peg, t.highestPeg);
    b.last_played = this.date();
    if (outcome === "abandoned") { b.abandoned += 1; return; }
    b.games_played += 1;
    b.peg_points += t.pegPoints;
    b.points_scored += result ? result.humanScore : 0;
    if (outcome === "win") {
      b.wins += 1;
      b.current_streak = Math.max(0, b.current_streak) + 1;
      b.best_streak = Math.max(b.best_streak, b.current_streak);
      b.biggest_win_margin = Math.max(b.biggest_win_margin, result.margin);
      if (result.skunkGiven === "skunk") b.skunks_given += 1;
      else if (result.skunkGiven === "double") b.double_skunks_given += 1;
    } else {
      b.losses += 1;
      b.current_streak = 0;
      if (result.skunked === "skunk") b.skunked += 1;
      else if (result.skunked === "double") b.double_skunked += 1;
    }
  }

  /** Combine buckets.  null = all.  opponent: a preset name -> games against them. */
  aggregate(players = null, difficulty = null, opponent = null) {
    const out = emptyBucket();
    let found = false;
    for (const p of players ? [players] : [2, 3]) {
      const groups = opponent ? ["vs:" + opponent.toLowerCase()] : difficulty ? [difficulty] : DIFFICULTIES;
      for (const d of groups) {
        const b = this.data[StatsStore.key(p, d)];
        if (!b) continue;
        found = true;
        for (const f of COUNT_FIELDS) out[f] += b[f] || 0;
        for (const f of MAX_FIELDS) {
          if ((b[f] || 0) > out[f]) {
            out[f] = b[f] || 0;
            if (f === "highest_hand") out.highest_hand_cards = b.highest_hand_cards || "";
          }
        }
        if (players && (difficulty || opponent)) out.current_streak = b.current_streak || 0;
        if ((b.last_played || "") > out.last_played) out.last_played = b.last_played || "";
      }
    }
    out._found = found;
    return out;
  }
}

/** Fixed decimals rounded like Python's format: only a value that is exactly half-way
 *  goes to the even digit (JavaScript would round it up). */
export function fixed(x, d) {
  const exact = Math.abs(x).toFixed(100);                // the stored value's exact digits
  const cut = exact.indexOf(".") + 1 + d;
  if (exact[cut] === "5" && /^0*$/.test(exact.slice(cut + 1))) {
    const lastDigit = d ? +exact[cut - 1] : +exact[cut - 2];
    const down = (x < 0 ? "-" : "") + exact.slice(0, d ? cut : cut - 1);
    if (lastDigit % 2 === 0) return down;                // already even: round down
  }
  return x.toFixed(d);
}
const pct = (a, b, d) => (b ? fixed(a / b, d) : "-");
/** Rows of the statistics table: [label, bucket -> value]. */
export const STAT_ROWS = [
  ["Games played", (b) => b.games_played],
  ["Wins", (b) => b.wins],
  ["Losses", (b) => b.losses],
  ["Win %", (b) => (b.games_played ? `${fixed((100 * b.wins) / b.games_played, 1)}%` : "-")],
  ["Abandoned", (b) => b.abandoned],
  ["Current win streak", (b) => b.current_streak],
  ["Best win streak", (b) => b.best_streak],
  ["Skunks (you gave)", (b) => b.skunks_given],
  ["Double skunks (you gave)", (b) => b.double_skunks_given],
  ["Times skunked", (b) => b.skunked],
  ["Times double skunked", (b) => b.double_skunked],
  ["Highest hand", (b) => b.highest_hand],
  ["Highest crib", (b) => b.highest_crib],
  ["Best single pegging play", (b) => b.highest_peg],
  ["29 hands", (b) => b.twenty_nines],
  ['Zero hands ("19s")', (b) => b.zero_hands],
  ["Average hand", (b) => pct(b.hand_points, b.hands_counted, 2)],
  ["Average crib", (b) => pct(b.crib_points, b.cribs_counted, 2)],
  ["Avg pegging pts / game", (b) => pct(b.peg_points, b.games_played, 1)],
  ["Avg final score", (b) => pct(b.points_scored, b.games_played, 1)],
  ["Biggest win margin", (b) => b.biggest_win_margin],
  ["Last played", (b) => b.last_played || "-"],
];
