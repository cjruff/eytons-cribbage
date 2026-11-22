// What each family opponent says, and when (thought bubbles).  Ported from cribbage.py.
// Code: (c) Corey J Ruff
import { RANK } from "./cards.js";
import { SKUNK_LINE } from "./engine.js";
import { baseName } from "./settings.js";

export const BUBBLE_SECONDS = 5;
export const TRIGGER_AT = { five_played: 4, double_run: 4 };   // say it on a player's Nth one in a game
const NEVER_PLAYED = "Well, I've never played this game before";
const SEE_ONE = "See one, play one";
export const PERSONALITIES = {
  grandpa: {
    double_run: "You get more double runs than anyone I know",
    five_played: "You get more 5's than anyone I know",
    lose: "You are the luckiest person I know",
    skunked: "God dammit, we're playing again!",
    win: "Hot Damn!",
    see_one: SEE_ONE,
  },
  grandma: {
    crib_five: "You put a 5 in the crib?!?!",
    zero_count: "Oh Sugar",
    cut_ace: "Oh look at that!",
    lose: "Here's your quarter",
    see_one: SEE_ONE,
  },
  larry: { lose: "Waaaaah, I don't like to lose", see_one: SEE_ONE },
  alex: { start: NEVER_PLAYED, lose: NEVER_PLAYED },
  jack: { start: NEVER_PLAYED, lose: NEVER_PLAYED, thinking: "duuuuur..." },
  lori: { start: NEVER_PLAYED, lose: NEVER_PLAYED },
  corey: { see_one: SEE_ONE },
  sue: { see_one: SEE_ONE },
};

/**
 * Watches an engine and decides when an opponent speaks.
 * onSay(pi, line, trigger) is called for each bubble; `bubbles` holds the ones showing
 * ({ line, until } keyed by player index) for the screen to draw.
 */
export class Personalities {
  constructor(engine, onSay = null, now = () => Date.now()) {
    this.engine = engine;
    this.onSay = onSay;
    this.now = now;
    this.bubbles = new Map();
    this.counts = new Map();
    this.saidGoodbye = false;
    this.fn = (ev, d) => this.onEvent(ev, d);
    engine.observers.push(this.fn);
  }

  personality(pi) {
    const p = this.engine.players[pi];
    return p.human ? {} : PERSONALITIES[baseName(p.name)] || {};
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

  _counted(trigger, pi) {
    const key = `${trigger}|${pi}`;
    const n = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, n);
    return n === (TRIGGER_AT[trigger] || 1);
  }

  onEvent(ev, d) {
    const e = this.engine;
    const others = (pi) => [...Array(e.n).keys()].filter((i) => i !== pi);
    if (ev === "play") {
      // The first card of the hand matches the starter's rank ("see one, play one").
      // Only a remark: it never changes which card the computer chooses.
      if (e.played.length === 1 && e.starter !== null && RANK[d.card] === RANK[e.starter]) this.say(d.pi, "see_one");
      if (RANK[d.card] === 5 && this._counted("five_played", d.pi)) for (const i of others(d.pi)) this.say(i, "five_played");
    } else if (ev === "show") {
      const runs = d.items.filter(([lbl]) => lbl.startsWith("Run")).length;
      if (runs >= 2 && this._counted("double_run", d.pi)) for (const i of others(d.pi)) this.say(i, "double_run");
      if (d.kind === "crib") {
        const owner = d.pi;                                   // only the crib's owner reacts...
        const given = e.cribFrom || new Map();
        if (d.cards.some((c) => RANK[c] === 5 && ![null, undefined, owner].includes(given.get(c)))) {
          this.say(owner, "crib_five");                       // ...to a 5 someone else put in it
        }
      }
      if (d.total === 0) this.say(d.pi, "zero_count");
    } else if (ev === "starter" && RANK[d.card] === 1) {
      this.say(d.cutter, "cut_ace");
    } else if (ev === "award" && e.winner !== null && !this.saidGoodbye) {
      this.saidGoodbye = true;
      this.say(e.winner, "win");
      const winner = "lose_to:" + baseName(e.players[e.winner].name);
      for (const i of others(e.winner)) {
        const mine = this.personality(i);
        if (winner in mine) this.say(i, winner);
        else if (e.players[i].score < SKUNK_LINE && "skunked" in mine) this.say(i, "skunked");
        else this.say(i, "lose");
      }
    }
  }
}
