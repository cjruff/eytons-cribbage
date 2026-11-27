// What each family opponent says, and when (thought bubbles).  Ported from cribbage.py.
// Code: (c) Corey J Ruff
import { RANK, sameRankTail } from "./cards.js";
import { SKUNK_LINE } from "./engine.js";
import { baseName, isPet } from "./settings.js";

export const BUBBLE_SECONDS = 5;
// say it on a player's Nth one in a game: more than 12 fives played, more than 7 double/triple/double-double runs
export const TRIGGER_AT = { five_played: 13, double_run: 8 };
export const LUCKY_STREAK = 3;           // Grandpa: "luckiest person" once he's lost to you this many games running
export const HIGH_HAND_BEHIND = 30;      // Grandpa: "High Hand at least" when behind by more than this...
export const HIGH_HAND_OTHERS_PEG = 5;   // ...pegged nothing while the others pegged at least this, and has the high hand
export const SON_BEHIND = 35;            // Sue / Larry: losing to Corey by more than this
export const CRAZY_MAX = 3;              // Grandma / Sue: "hold this crazy" at most this many times a game
export const CRAZY_CHANCE = 0.3;         // ...on any one discard (and for sure by their 3rd discard if not yet said)
const NEVER_PLAYED = "Well, I've never played this game before";
const SEE_ONE = "See one, play one";
/** Lines every computer player has, family or not (a family member's own line wins). */
export const EVERYONE = { see_one: SEE_ONE, double_run_five: "Double run of 5 for 10" };
const CRAZY = "I'm going to hold this crazy";
export const PERSONALITIES = {
  grandpa: {
    double_run: "You get more double runs than anyone I know",
    five_played: "You get more 5's than anyone I know",
    lucky: "You are the luckiest person I know",           // only after losing to you 3 games in a row
    high_hand: "High Hand at least",
    skunked: "God dammit, we're playing again!",
    win: "Hot Damn!",
    see_one: SEE_ONE,
  },
  grandma: {
    crib_five: "You put a 5 in the crib?!?!",
    zero_count: "Oh Sugar",
    cut_ace: "Oh look at that!",
    lose: "Here's your quarter",
    skunked_by_you: "You skunked me!  Here's 50 cents.",
    crazy: CRAZY,
    see_one: SEE_ONE,
  },
  larry: { lose: "Waaaaah, I don't like to lose", zero_count: "Oh Fiddle sticks", son: "My son was always far superior at this game than I", see_one: SEE_ONE },
  alex: { devil: "The Devil", start: NEVER_PLAYED, lose: "Well, we don't play this at Widener" },
  jack: { devil: "The Devil", start: NEVER_PLAYED, lose: NEVER_PLAYED, thinking: "duuuuur..." },
  lori: { start: NEVER_PLAYED, lose: NEVER_PLAYED, sixty_nine: "Heeeeey" },
  corey: { see_one: SEE_ONE, devil: "The Devil" },
  sue: { see_one: SEE_ONE, crazy: CRAZY, son: "My son was always far superior at this game than I" },
};

/**
 * Watches an engine and decides when an opponent speaks.
 * onSay(pi, line, trigger) is called for each bubble; `bubbles` holds the ones showing
 * ({ line, until } keyed by player index) for the screen to draw.
 */
export class Personalities {
  /**
   * opts.rng: random numbers (tests); opts.memory: { get(key), set(key, value) } kept between
   * games for this profile (Grandpa's losing streak against you).
   */
  constructor(engine, onSay = null, now = () => Date.now(), opts = {}) {
    this.engine = engine;
    this.onSay = onSay;
    this.now = now;
    this.rng = opts.rng || Math.random;
    this.memory = opts.memory || null;
    this.bubbles = new Map();
    this.counts = new Map();
    this.onceSaid = new Set();             // "trigger|pi" lines said at most once a game
    this.crazy = new Map();                // pi -> { said, seen }
    this.round = null;
    this.saidGoodbye = false;
    this.fn = (ev, d) => this.onEvent(ev, d);
    engine.observers.push(this.fn);
  }

  personality(pi) {
    const p = this.engine.players[pi];
    return p.human || isPet(p.name) ? {} : { ...EVERYONE, ...(PERSONALITIES[baseName(p.name)] || {}) };   // pets never talk
  }
  /** "thinking..." text while this computer decides. */
  thinking(pi) { return this.personality(pi).thinking || "thinking..."; }

  say(pi, trigger) {
    const line = this.personality(pi)[trigger];
    if (!line) return;
    this.bubbles.set(pi, { line, until: this.now() + BUBBLE_SECONDS * 1000 });
    if (this.onSay) this.onSay(pi, line, trigger);
  }
  /** Bubbles still showing (expired ones are dropped). */
  active() {
    const t = this.now();
    for (const [pi, b] of this.bubbles) if (b.until <= t) this.bubbles.delete(pi);
    return this.bubbles;
  }

  /** Greeting at the start of a game. */
  greet() { for (let i = 1; i < this.engine.n; i++) this.say(i, "start"); }
  /** A computer picked a card while cutting for deal. */
  cutPick(pi, card) { if (RANK[card] === 1) this.say(pi, "cut_ace"); }

  /** Grandpa, after the show: way behind, pegged nothing while the others pegged 5+, but has the best hand. */
  _highHand() {
    const e = this.engine, r = this.round;
    for (let i = 0; i < e.n; i++) {
      if (!this.personality(i).high_hand || !r.hand.has(i)) continue;
      const mine = r.hand.get(i);
      const othersPeg = r.peg.reduce((t, v, j) => t + (j === i ? 0 : v), 0);
      const best = [...r.hand].every(([j, v]) => j === i || v < mine);
      if (r.behind[i] > HIGH_HAND_BEHIND && r.peg[i] === 0 && othersPeg >= HIGH_HAND_OTHERS_PEG && best) this.say(i, "high_hand");
    }
  }

  _counted(trigger, pi) {
    const key = `${trigger}|${pi}`;
    const n = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, n);
    return n === (TRIGGER_AT[trigger] || 1);
  }

  _once(pi, trigger) {
    const key = `${trigger}|${pi}`;
    if (this.onceSaid.has(key) || !this.personality(pi)[trigger]) return;
    this.onceSaid.add(key);
    this.say(pi, trigger);
  }

  onEvent(ev, d) {
    const e = this.engine;
    const others = (pi) => [...Array(e.n).keys()].filter((i) => i !== pi);
    if (ev === "round") this.round = { peg: Array(e.n).fill(0), hand: new Map(), behind: Array(e.n).fill(0) };
    else if (ev === "award" && (d.kind === "peg" || d.kind === "go") && this.round) this.round.peg[d.pi] += d.pts;
    else if (ev === "pegdone" && this.round) {
      const sc = e.players.map((p) => p.score);
      this.round.behind = sc.map((v, i) => Math.max(...sc.filter((_, j) => j !== i)) - v);
    } else if (ev === "discards") {
      // Grandma / Sue: "I'm going to hold this crazy" - random, at least once (by their 3rd discard), never more than 3
      for (let i = 0; i < e.n; i++) {
        if (!this.personality(i).crazy) continue;
        const c = this.crazy.get(i) || { said: 0, seen: 0 };
        c.seen++;
        if (c.said < CRAZY_MAX && ((c.said === 0 && c.seen >= 3) || this.rng() < CRAZY_CHANCE)) { c.said++; this.say(i, "crazy"); }
        this.crazy.set(i, c);
      }
    }
    if (ev === "award" && d.pts > 0 && e.winner === null) {
      // Sue / Larry: once a game, when Corey is beating them by more than 35
      for (let i = 0; i < e.n; i++) {
        if (!this.personality(i).son) continue;
        if (e.players.some((p, j) => j !== i && baseName(p.name) === "corey" && p.score - e.players[i].score > SON_BEHIND)) this._once(i, "son");
      }
    }
    if (ev === "play") {
      // The first card of the hand matches the starter's rank ("see one, play one").
      // Only a remark: it never changes which card the computer chooses.
      if (e.played.length === 1 && e.starter !== null && RANK[d.card] === RANK[e.starter]) this.say(d.pi, "see_one");
      // 6-6-6 played in a row (only when the third 6 lands, not again for a fourth)
      if (RANK[d.card] === 6 && d.seq && sameRankTail(d.seq) === 3) for (let i = 0; i < e.n; i++) this.say(i, "devil");
      if (RANK[d.card] === 5 && this._counted("five_played", d.pi)) for (const i of others(d.pi)) this.say(i, "five_played");
    } else if (ev === "award" && d.pts > 0 && e.players[d.pi].score === 69) {
      // Lori, whenever anyone's front peg lands on 69 (hers or an opponent's)
      for (let i = 0; i < e.n; i++) this.say(i, "sixty_nine");
    }
    if (ev === "show") {
      const runs = d.items.filter(([lbl]) => lbl.startsWith("Run")).length;
      // all five cards in a double run of four, and nothing else: 10-J-J-Q-K without nobs
      if (d.total === 10 && d.items.filter(([lbl]) => lbl === "Run of 4").length === 2) this.say(d.pi, "double_run_five");
      if (d.kind === "hand" && this.round) this.round.hand.set(d.pi, d.total);
      if (runs >= 2 && this._counted("double_run", d.pi)) for (const i of others(d.pi)) this.say(i, "double_run");
      if (d.kind === "crib") {
        const owner = d.pi;                                   // only the crib's owner reacts...
        const given = e.cribFrom || new Map();
        if (d.cards.some((c) => RANK[c] === 5 && ![null, undefined, owner].includes(given.get(c)))) {
          this.say(owner, "crib_five");                       // ...to a 5 someone else put in it
        }
      }
      if (d.total === 0) this.say(d.pi, "zero_count");
      if (d.kind === "crib" && this.round) this._highHand();
    } else if (ev === "starter" && RANK[d.card] === 1) {
      this.say(d.cutter, "cut_ace");
    } else if (ev === "award" && e.winner !== null && !this.saidGoodbye) {
      this.saidGoodbye = true;
      this.say(e.winner, "win");
      const winner = "lose_to:" + baseName(e.players[e.winner].name);
      const youWon = !!e.players[e.winner].human;
      const streaks = new Map();                            // Grandpa's games in a row lost to you
      for (let i = 0; i < e.n; i++) {
        if (!("lucky" in this.personality(i))) continue;
        const key = `lostToYou.${baseName(e.players[i].name)}`;
        const streak = youWon ? (+(this.memory?.get(key)) || 0) + 1 : 0;
        this.memory?.set(key, streak);
        streaks.set(i, streak);
      }
      for (const i of others(e.winner)) {
        const mine = this.personality(i);
        const skunked = e.players[i].score < SKUNK_LINE;
        const streak = streaks.get(i) || 0;
        if (winner in mine) this.say(i, winner);
        else if (skunked && youWon && "skunked_by_you" in mine) this.say(i, "skunked_by_you");
        else if (skunked && "skunked" in mine) this.say(i, "skunked");
        else if ("lucky" in mine) { if (youWon && streak >= LUCKY_STREAK) this.say(i, "lucky"); }
        else this.say(i, "lose");
      }
    }
  }
}
