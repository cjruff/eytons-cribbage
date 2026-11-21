// Achievements (ported from achievements.py): 71 achievements, 188 medals.
// The saved data uses the same layout as the Python achievements.json.
// Code: (c) Corey J Ruff
import { RANK } from "./cards.js";
import { SKUNK_LINE } from "./engine.js";
import { baseName, today } from "./settings.js";

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"];
export const MEDAL_COLORS = { Bronze: "#cd7f32", Silver: "#c4c8cc", Gold: "#f5c518", Platinum: "#8fe0ef" };
export const MEDAL_DARK = { Bronze: "#7a4a1c", Silver: "#6e7378", Gold: "#8a6d00", Platinum: "#2a8394" };

export class Achievement {
  constructor(id, name, category, desc, metric, tiers, medal = null, note = "") {
    Object.assign(this, { id, name, category, desc, metric, tiers, medal, note });
  }
  tierName(i) { return this.tiers.length === 1 ? this.medal : TIER_NAMES[i]; }
  reached(value) { return this.tiers.filter((t) => value >= t).length; }
}

const [W, S, H, C, P, D, L, X] = ["Winning & Competition", "Skunks", "Big Hands & Scoring", "The Crib",
  "Pegging & Strategy", "Dealer & Cut Card Luck", "Difficulty & Progression", "Silly & Unusual"];
export const CATEGORIES = [W, S, H, C, P, D, L, X];
const A = (...args) => new Achievement(...args);

export const ACHIEVEMENTS = [
  A("first_victory", "First Victory", W, "Win your first game", "wins", [1], "Bronze", ""),
  A("hang_of_it", "Getting the Hang of It", W, "Win 10 games", "wins", [10], "Bronze", ""),
  A("regular", "Cribbage Regular", W, "Win 50 games", "wins", [50], "Silver", ""),
  A("veteran", "Cribbage Veteran", W, "Win 100 games", "wins", [100], "Gold", ""),
  A("addict", "Cribbage Addict", W, "Win 500 games", "wins", [500], "Platinum", ""),
  A("legend", "Cribbage Legend", W, "Win 1,000 games", "wins", [1000], "Platinum", ""),
  A("undefeated", "Undefeated", W, "Win 5 games in a row", "best_win_streak", [5], "Silver", ""),
  A("winning_streak", "Winning Streak", W, "Win 10 games in a row", "best_win_streak", [10], "Gold", ""),
  A("dominator", "Dominator", W, "Win 25 games in a row", "best_win_streak", [25], "Platinum", ""),
  A("comeback_kid", "Comeback Kid", W, "Win after trailing by 30+ points", "comebacks", [1, 3, 10, 25], null, "Silver = The Comeback Tour"),
  A("down_to_wire", "Down to the Wire", W, "Win by exactly 1 point", "win_by_1", [1, 3, 5, 10], null, ""),
  A("photo_finish", "Photo Finish", W, "Win by 5 points or fewer", "win_by_5", [1, 10, 25, 50], null, ""),
  A("no_mercy", "No Mercy", W, "Win by 40+ points", "win_by_40", [1, 5, 10, 25], null, ""),
  A("heres_your_quarter", "Here's Your Quarter", W, "Beat Grandma", "beat_grandma", [1, 25, 50, 100], null, ""),
  A("skunked", "Skunked!", S, "Skunk an opponent", "skunks", [1], "Bronze", ""),
  A("double_skunked", "Double Skunked!", S, "Double skunk an opponent", "double_skunks", [1], "Silver", ""),
  A("skunk_differently", "Double Skunk Differently", S, "Skunk both opponents in the same 3-player game", "skunk_both", [1], "Gold", ""),
  A("skunk_master", "Skunk Master", S, "Skunk opponents (double skunks count too)", "skunks", [10, 25, 50, 100], null, "Gold = Public Humiliation, Platinum = The Executioner"),
  A("double_trouble", "Double Trouble", S, "Double skunk opponents", "double_skunks", [10, 25, 50, 100], null, ""),
  A("lockdown", "Lockdown", S, "Win without letting any opponent reach 100", "lockdowns", [1, 10, 25, 50], null, ""),
  A("clean_sweep", "Clean Sweep", S, "Win 3 games in a row by skunk", "best_skunk_streak", [3], "Gold", ""),
  A("nice_hand", "Nice Hand!", H, "Score a 12+ point hand", "hands_12", [1, 10, 50, 200], null, ""),
  A("double_digits", "Double Digits", H, "Score 16+ points in one hand", "hands_16", [1, 5, 25, 100], null, ""),
  A("big_kahuna", "Big Kahuna", H, "Score 20+ points in one hand", "hands_20", [1, 3, 10, 25], null, ""),
  A("monster_hand", "Monster Hand", H, "Score 24+ points in one hand", "hands_24", [1, 2, 5, 10], null, ""),
  A("perfect_29", "The Perfect 29", H, "Score a 29-point hand", "hands_29", [1, 2, 3, 5], null, ""),
  A("almost_perfect", "Almost Perfect", H, "Score a 28-point hand", "hands_28", [1, 2, 3, 5], null, ""),
  A("fifteen_fanatic", "Fifteen Fanatic", H, "Score 10+ points from fifteens in one hand", "hands_fifteens10", [1, 10, 25, 50], null, ""),
  A("run_wild", "Run Wild", H, "Score 12+ points from runs in one hand", "hands_runs12", [1, 5, 15, 30], null, ""),
  A("pair_a_dice", "Pair-a-dice", H, "Score 12+ points from pairs in one hand", "hands_pairs12", [1, 3, 10, 25], null, ""),
  A("double_play", "Double Play", H, "Score 12+ in both your hand and your crib in one deal", "double_plays", [1, 3, 10, 25], null, ""),
  A("crib_starter", "Crib Starter", C, "Score points in your crib", "cribs_scored", [1], "Bronze", ""),
  A("crib_collector", "Crib Collector", C, "Score 100 cribs", "cribs_scored", [100], "Silver", ""),
  A("crib_master", "Crib Master", C, "Score 500 cribs", "cribs_scored", [500], "Gold", ""),
  A("crib_jackpot", "Crib Jackpot", C, "Score a 20+ point crib", "cribs_20", [1, 3, 5, 10], null, ""),
  A("crib_monster", "Crib Monster", C, "Score a 24+ point crib", "cribs_24", [1, 2, 3, 5], null, "Also covers Cribbage Royalty"),
  A("generous_opponent", "Generous Opponent", C, "Receive a crib worth 15+ points", "cribs_15", [1, 5, 15, 30], null, ""),
  A("gift", "The Gift That Keeps Giving", C, "Give an opponent a crib worth 15+ points", "opp_cribs_15", [1, 5, 15, 30], null, ""),
  A("crib_denial", "Crib Denial", C, "An opponent's crib scores zero", "opp_cribs_0", [1, 10, 50, 100], null, ""),
  A("first_blood", "First Blood", P, "Peg your first point", "peg_points", [1], "Bronze", ""),
  A("fifteen_two", "Fifteen Two", P, "Peg a count of 15", "peg_fifteens", [1, 50, 250, 1000], null, ""),
  A("fifteen_four", "Fifteen Four", P, "Peg 15 for 4 (fifteen plus a pair)", "peg_fifteen_fours", [1, 5, 25, 50], null, ""),
  A("pair_royal", "Pair Royal", P, "Peg 6 for three of a kind", "peg_pair_royals", [1, 5, 25, 50], null, ""),
  A("double_pair_royal", "Double Pair Royal", P, "Peg 12 for four of a kind", "peg_double_royals", [1, 2, 3, 5], null, ""),
  A("run_for_it", "Run for It", P, "Peg a run of 3+ cards", "peg_runs", [1, 25, 100, 250], null, ""),
  A("last_laugh", "Last Laugh", P, "Win the game with a pegging point", "last_laughs", [1, 5, 10, 25], null, ""),
  A("go_to", "The Go-To", P, "Score Go / last-card points", "go_points", [50, 200, 500, 1000], null, ""),
  A("pegging_pro", "Pegging Pro", P, "Career pegging points", "peg_points", [500, 2500, 5000, 10000], null, ""),
  A("counting_cards", "Counting Cards", P, "With two cards in sequence showing (e.g. 6-7), play a card that leaves no run", "run_blocks", [1, 10, 25, 50], null, ""),
  A("lucky_cut", "Lucky Cut", D, "A Jack is turned as the starter", "jack_starters", [1, 10, 25, 50], null, ""),
  A("his_heels", "His Heels!", D, "Score 2 for His Heels", "heels", [1, 10, 25, 50], null, "Silver = Jack of All Trades"),
  A("jackpot", "Jackpot", D, "The starter turns your hand into 20+ (adding 10+ itself)", "jackpots", [1, 3, 10, 25], null, ""),
  A("dealers_delight", "Dealer's Delight", D, "Score 20+ in hand + crib in one deal as dealer", "dealer_20", [1, 10, 25, 50], null, ""),
  A("bad_luck_brian", "Bad Luck Brian", D, "Three zero-point hands in a row", "best_zero_streak", [3], "Bronze", ""),
  A("lucky_seven", "Lucky Seven", D, "Seven 10+ point hands in a row", "best_ten_streak", [7], "Gold", ""),
  A("easy_street", "Easy Street", L, "Win 10 games on Easy", "wins_Easy", [10], "Bronze", ""),
  A("intermediate", "Intermediate Player", L, "Win 25 games on Medium", "wins_Medium", [25], "Silver", ""),
  A("hard_knocks", "Hard Knocks", L, "Win 25 games on Hard", "wins_Hard", [25], "Gold", ""),
  A("expert_witness", "Expert Witness", L, "Win 50 games on Expert", "wins_Expert", [50], "Gold", ""),
  A("master_board", "Master of the Board", L, "Win 100 games on Expert", "wins_Expert", [100], "Platinum", ""),
  A("hardly_fair", "Hardly Fair", L, "Skunk the computer 10 times on Hard", "hard_skunks", [10], "Gold", ""),
  A("against_all_odds", "Against All Odds", L, "Win after trailing by 50+ points on Expert", "expert_comebacks50", [1], "Platinum", ""),
  A("iron_man", "Iron Man", L, "Win 10 Expert games in a row", "best_expert_streak", [10], "Platinum", ""),
  A("karma", "Cribbage Karma", X, "Get skunked the game right after you skunk someone", "karma", [1], "Bronze", ""),
  A("goat", "Beaten by the G.O.A.T.", X, "Lose to Corey", "lost_to_corey", [1, 25, 50, 100], null, ""),
  A("long_game", "The Long Game", X, "Play games to the finish", "games_played", [100, 250, 500, 1000], null, ""),
  A("not_my_day", "Not My Day", X, "Lose 5 games in a row", "best_loss_streak", [5], "Bronze", ""),
  A("nobs", "One for His Nobs", X, "Score His Nobs", "nobs", [25, 50, 100, 250], null, ""),
  A("win_nobs_cut", "Win for His Nobs", X, "Win the game with the Jack turned on the cut (His Heels)", "win_heels", [1], "Gold", ""),
  A("aces_high", "Aces High", X, "Hold all four Aces in your hand or your crib (not counting the starter)", "four_aces", [1], "Gold", ""),
  A("agony", "The Agony of Defeat", X, "Lose by exactly 1 point", "agony", [1], "Bronze", "Also covers The Unthinkable (losing with 120)"),
];
export const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** True if the tail of `ranks` (3+ cards) forms a pegging run. */
function makesRun(ranks) {
  for (let len = ranks.length; len > 2; len--) {
    const rs = ranks.slice(-len).sort((a, b) => a - b);
    if (new Set(rs).size === len && rs[len - 1] - rs[0] === len - 1) return true;
  }
  return false;
}

export class AchievementTracker {
  /**
   * data: saved object (null = brand new player); seed: metrics proven by existing stats,
   * only used for a brand new tracker; onSave(data) is called after every change.
   */
  constructor(data = null, { seed = null, onSave = null, date = today } = {}) {
    this.data = { metrics: {}, unlocked: {}, state: {} };
    this.onSave = onSave;
    this.date = date;
    const fresh = !(data && typeof data === "object");
    if (!fresh) for (const k of Object.keys(this.data)) Object.assign(this.data[k], data[k] || {});
    if (fresh && seed) for (const [k, v] of Object.entries(seed)) this.m[k] = Math.max(this.m[k] || 0, v);
    this.engine = null;
    this.pending = [];           // [achievement, tierIndex] awaiting a pop-up
    this.newThisGame = [];       // [achievement, tierIndex] unlocked during the current game
    this._evaluate(true);        // seeded progress unlocks quietly
    this.save();
  }

  get m() { return this.data.metrics; }
  get st() { return this.data.state; }
  inc(key, n = 1) { this.m[key] = (this.m[key] || 0) + n; }
  best(key, v) { this.m[key] = Math.max(this.m[key] || 0, v); }
  value(a) { return this.m[a.metric] || 0; }
  tiersReached(a) { return (this.data.unlocked[a.id] || {}).tier || 0; }
  save() { if (this.onSave) this.onSave(this.data); }
  reset() { this.data = { metrics: {}, unlocked: {}, state: {} }; this.pending = []; this.newThisGame = []; this.save(); }
  popPending() { const out = this.pending; this.pending = []; return out; }

  attach(engine) {
    if (this.engine && this.fn) this.engine.observers = this.engine.observers.filter((f) => f !== this.fn);
    this.engine = engine;
    this.fn = (ev, d) => this.onEvent(ev, d);
    engine.observers.push(this.fn);
    this.game = { max_deficit: 0, over: false };
    this.round = {};
    this.newThisGame = [];
  }

  _evaluate(silent = false) {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      const have = this.tiersReached(a);
      const now = a.reached(this.value(a));
      if (now > have) {
        const rec = (this.data.unlocked[a.id] ||= { tier: 0, dates: [] });
        for (let t = have; t < now; t++) {
          rec.dates.push(this.date());
          if (!silent) { this.pending.push([a, t]); this.newThisGame.push([a, t]); }
        }
        rec.tier = now;
        changed = true;
      }
    }
    return changed;
  }
  _done() { this._evaluate(); this.save(); }

  onEvent(ev, d) {
    const e = this.engine;
    if (!e) return;
    const h = this["_ev_" + ev];
    if (h) { h.call(this, e, d); this._done(); }
  }

  _ev_round() { this.round = { hand: null, crib: null, heels: 0 }; }

  _ev_starter(e, d) { if (RANK[d.card] === 11) this.inc("jack_starters"); }

  _ev_play(e, { pi, prev, seq, count, pts, reasons }) {
    if (pi !== e.human) return;
    const text = reasons.join(" ");
    if (count === 15) {
      this.inc("peg_fifteens");
      if (pts >= 4) this.inc("peg_fifteen_fours");
    }
    if (text.includes("Double pair royal")) this.inc("peg_double_royals");
    else if (text.includes("Pair royal")) this.inc("peg_pair_royals");
    if (text.includes("Run of")) this.inc("peg_runs");
    // Counting Cards: a run threat (two consecutive ranks) was showing and our card leaves no run
    if (prev.length >= 2 && Math.abs(RANK[prev.at(-1)] - RANK[prev.at(-2)]) === 1 && !text.includes("Run of") && count < 31) {
      const ranks = seq.map((c) => RANK[c]);
      let open = false;
      for (let r = 1; r <= 13 && !open; r++) if (count + Math.min(r, 10) <= 31 && makesRun([...ranks, r])) open = true;
      if (!open) this.inc("run_blocks");
    }
  }

  _ev_award(e, { pi, pts, kind }) {
    const hp = e.players[e.human];
    if (pi === e.human && ["peg", "go", "heels"].includes(kind)) {
      this.inc("peg_points", pts);
      if (kind === "go") this.inc("go_points", pts);
      if (kind === "heels") { this.inc("heels"); this.round.heels = pts; }
    }
    const lead = Math.max(...e.players.filter((_, i) => i !== e.human).map((p) => p.score));
    this.game.max_deficit = Math.max(this.game.max_deficit, lead - hp.score);
    if (e.winner !== null && !this.game.over) {
      this.game.over = true;
      this._gameOver(e, kind);
    }
  }

  _ev_show(e, { pi, kind, cards, items, total, starter, base }) {
    if (kind === "crib" && pi !== e.human) {
      if (total >= 15) this.inc("opp_cribs_15");
      if (total === 0) this.inc("opp_cribs_0");
      return;
    }
    if (pi !== e.human) return;
    const aces = cards.filter((c) => RANK[c] === 1).length === 4;   // all four Aces held (no starter)
    if (kind === "hand") {
      const sum = (f) => items.filter(([lbl]) => f(lbl)).reduce((t, it) => t + it[2], 0);
      const fifteens = sum((l) => l === "Fifteen");
      const runs = sum((l) => l.startsWith("Run"));
      const pairs = sum((l) => l === "Pair");
      for (const th of [12, 16, 20, 24]) if (total >= th) this.inc(`hands_${th}`);
      if (total === 28 || total === 29) this.inc(`hands_${total}`);
      if (fifteens >= 10) this.inc("hands_fifteens10");
      if (runs >= 12) this.inc("hands_runs12");
      if (pairs >= 12) this.inc("hands_pairs12");
      if (total >= 20 && total - base >= 10) this.inc("jackpots");
      const ranks = [...cards, starter].map((c) => RANK[c]);
      if (ranks.some((r) => ranks.filter((x) => x === r).length === 4)) this.inc("four_kinds");
      if (aces) this.inc("four_aces");
      const st = this.st;
      st.zero_streak = total === 0 ? (st.zero_streak || 0) + 1 : 0;
      st.ten_streak = total >= 10 ? (st.ten_streak || 0) + 1 : 0;
      this.best("best_zero_streak", st.zero_streak);
      this.best("best_ten_streak", st.ten_streak);
      this.round.hand = total;
    } else {
      if (aces) this.inc("four_aces");
      if (total > 0) this.inc("cribs_scored");
      for (const th of [15, 20, 24]) if (total >= th) this.inc(`cribs_${th}`);
      this.round.crib = total;
      const h = this.round.hand || 0;
      if (h >= 12 && total >= 12) this.inc("double_plays");
      if (e.dealer === e.human && h + total + (this.round.heels || 0) >= 20) this.inc("dealer_20");
    }
    if (items.some(([lbl]) => lbl === "His Nobs")) this.inc("nobs");
  }

  /** The screen reports a hand the player counted themselves. */
  manualCount(correct) {
    this.st.count_streak = correct ? (this.st.count_streak || 0) + 1 : 0;
    this.best("best_count_streak", this.st.count_streak);
    this._done();
  }

  _gameOver(e, finalKind) {
    const res = e.result();
    const lvl = e.difficulty;
    const st = this.st;
    this.inc("games_played");
    const human = e.players[e.human];
    const opps = e.players.filter((_, i) => i !== e.human);
    const oppBest = Math.max(...opps.map((p) => p.score));
    if (res.won) {
      this.inc("wins");
      if (opps.some((p) => baseName(p.name) === "grandma")) this.inc("beat_grandma");
      this.inc(`wins_${lvl}`);
      st.win_streak = (st.win_streak || 0) + 1;
      st.loss_streak = 0;
      this.best("best_win_streak", st.win_streak);
      const margin = res.margin;
      if (margin === 1) this.inc("win_by_1");
      if (margin <= 5) this.inc("win_by_5");
      if (margin >= 40) this.inc("win_by_40");
      if (oppBest < 100) this.inc("lockdowns");
      if (this.game.max_deficit >= 30) this.inc("comebacks");
      if (this.game.max_deficit >= 50 && lvl === "Expert") this.inc("expert_comebacks50");
      if (finalKind === "peg" || finalKind === "go") this.inc("last_laughs");
      if (finalKind === "heels") this.inc("win_heels");
      if (e.n === 3 && opps.every((p) => p.score < SKUNK_LINE)) this.inc("skunk_both");
      if (res.skunkGiven) {
        this.inc("skunks");
        if (res.skunkGiven === "double") this.inc("double_skunks");
        if (lvl === "Hard") this.inc("hard_skunks");
        st.skunk_streak = (st.skunk_streak || 0) + 1;
      } else st.skunk_streak = 0;
      this.best("best_skunk_streak", st.skunk_streak);
      if (lvl === "Expert") {
        st.expert_streak = (st.expert_streak || 0) + 1;
        this.best("best_expert_streak", st.expert_streak);
      }
    } else {
      st.win_streak = 0;
      const w = e.players[e.winner];
      if (!w.human && baseName(w.name) === "corey") this.inc("lost_to_corey");
      st.skunk_streak = 0;
      st.loss_streak = (st.loss_streak || 0) + 1;
      this.best("best_loss_streak", st.loss_streak);
      if (lvl === "Expert") st.expert_streak = 0;
      if (human.score >= 120) this.inc("agony");
      if (res.skunked && st.last_skunk_given) this.inc("karma");
    }
    st.last_skunk_given = Boolean(res.won && res.skunkGiven);
  }

  summary() {
    let total = 0, got = 0;
    const medals = Object.fromEntries(TIER_NAMES.map((t) => [t, 0]));
    for (const a of ACHIEVEMENTS) {
      total += a.tiers.length;
      const have = this.tiersReached(a);
      got += have;
      for (let i = 0; i < have; i++) medals[a.tierName(i)] += 1;
    }
    return { got, total, medals };
  }

  progressText(a) {
    const v = this.value(a), have = this.tiersReached(a);
    if (have >= a.tiers.length) return "Complete!";
    const nxt = a.tiers[have];
    return `${Math.min(v, nxt).toLocaleString("en-US")} / ${nxt.toLocaleString("en-US")}  for ${a.tierName(have)}`;
  }
}

/** Seed metrics from existing lifetime stats so earlier history counts. */
export function seedFromStats(stats) {
  try {
    const all = stats.aggregate(null, null);
    const seed = {
      wins: all.wins, games_played: all.games_played,
      skunks: all.skunks_given + all.double_skunks_given,
      double_skunks: all.double_skunks_given, best_win_streak: all.best_streak,
      hands_29: all.twenty_nines, peg_points: all.peg_points,
    };
    for (const lvl of ["Easy", "Medium", "Hard", "Expert"]) seed[`wins_${lvl}`] = stats.aggregate(null, lvl).wins;
    return seed;
  } catch { return {}; }
}
