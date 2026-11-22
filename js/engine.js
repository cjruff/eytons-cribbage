// Game engine (no screen code).  The user interface drives it and handles timing.
// Code: (c) Corey J Ruff
import { RANK, VAL, cardName, cardsText, sortCards, newDeck } from "./cards.js";
import { scoreHand, handBreakdown, pegScore } from "./scoring.js";
import { ComputerAI, DIFFICULTIES } from "./ai.js";
import { CryptoRng } from "./rng.js";

export const WIN_SCORE = 121;
export const SKUNK_LINE = 91;          // finishing below 91 = skunk
export const DOUBLE_SKUNK_LINE = 61;   // finishing below 61 = double skunk
export const DEFAULT_PEG_COLORS = ["#d62828", "#2563eb", "#f2c40f"];
const LOG_MAX = 200;

export class Player {
  constructor(name, human, color, level = null, rng = null) {
    this.name = name;
    this.human = human;
    this.color = color;
    this.level = level;
    this.ai = human ? null : new ComputerAI(level, rng);
    this.score = 0;
    this.back = -1;          // back peg (-1 / 0 = start holes)
    this.hand = [];          // current cards (during discard)
    this.dealt = [];         // all cards dealt this round (computer knowledge)
    this.kept = [];          // 4 cards kept for the show
    this.pegHand = [];       // cards not yet pegged
    this.lastGain = 0;
  }
}

/** Per-game numbers for the human that feed the lifetime statistics. */
export class HumanTally {
  constructor() {
    this.hands = 0; this.handPoints = 0; this.highestHand = 0; this.highestHandCards = "";
    this.cribs = 0; this.cribPoints = 0; this.highestCrib = 0;
    this.pegPoints = 0; this.highestPeg = 0; this.twentyNines = 0; this.zeroHands = 0;
  }
}

export class CribbageEngine {
  /**
   * @param nPlayers 2 or 3
   * @param levels one skill for every computer, or an array (one per computer)
   * @param opts { humanName, deckRng, colors, names, aiRngs }
   *   aiRngs: optional array of random generators, one per computer (tests use seeded ones)
   */
  constructor(nPlayers, levels, opts = {}) {
    if (nPlayers !== 2 && nPlayers !== 3) throw new Error("2 or 3 players");
    this.n = nPlayers;
    if (typeof levels === "string") levels = new Array(nPlayers - 1).fill(levels);
    this.levels = levels.slice(0, nPlayers - 1);
    // Stats are filed under the strongest opponent's level.
    this.difficulty = this.levels.reduce((a, b) => (DIFFICULTIES.indexOf(b) > DIFFICULTIES.indexOf(a) ? b : a));
    const colors = opts.colors || DEFAULT_PEG_COLORS;
    this.deckRng = opts.deckRng || new CryptoRng();
    const defaults = nPlayers === 2 ? ["Computer"] : ["Lefty", "Righty"];
    const names = defaults.map((d, i) => (opts.names && opts.names[i]) || d);
    this.players = [new Player(opts.humanName || "You", true, colors[0])];
    names.forEach((nm, i) => {
      const rng = opts.aiRngs ? opts.aiRngs[i] : null;
      this.players.push(new Player(nm, false, colors[i + 1], this.levels[i], rng));
    });
    this.human = 0;
    this.dealer = 0;
    this.phase = "cutdeal";
    this.log = [];
    this.tally = new HumanTally();
    this.winner = null;
    this.deck = []; this.crib = []; this.starter = null;
    this.cribFrom = new Map();
    this.cutCards = [];
    this.cutDeck = []; this.cutPicks = new Map(); this.cutResult = null;
    this.lastEvent = "";
    this.observers = [];         // functions (event, data) - achievements, personalities...
    this.lastPlay = "";          // e.g. "Computer plays K♣  -  count 10"
    this.lastScore = "";         // e.g. "Computer: Fifteen for 2"
    this.handsPlayed = 0;
    this._resetPegState();
    this.showSteps = []; this.showI = -1; this.showCurrent = null; this.showCommitted = true;
  }

  // ----- helpers -----
  _emit(ev, data = {}) {
    for (const fn of [...this.observers]) {
      try { fn(ev, data); } catch (e) { console.error("observer error:", ev, e); }  // never break the game
    }
  }
  say(msg) {
    this.log.push(msg);
    if (this.log.length > LOG_MAX) this.log.shift();
    this.lastEvent = msg;
  }
  nxt(i) { return (i + 1) % this.n; }
  get nDiscard() { return this.n === 2 ? 2 : 1; }
  get over() { return this.winner !== null; }

  /** Peg points.  Returns true when this wins the game. */
  award(pi, pts, reason, kind) {
    if (pts <= 0 || this.over) return false;
    const p = this.players[pi];
    p.back = p.score;
    p.score = Math.min(WIN_SCORE, p.score + pts);
    p.lastGain = pts;
    this.say(`${p.name}: ${reason}  (+${pts}, total ${p.score})`);
    const pegKind = kind === "peg" || kind === "go" || kind === "heels";
    if (pegKind) this.lastScore = `${p.name}: ${reason}`;
    if (p.human && pegKind) {
      this.tally.pegPoints += pts;
      if (kind === "peg") this.tally.highestPeg = Math.max(this.tally.highestPeg, pts);
    }
    const won = p.score >= WIN_SCORE;
    if (won) {
      this.winner = pi;
      this.phase = "over";
      this.say(`*** ${p.name} ${p.human ? "win" : "wins"} the game! ***`);
    }
    this._emit("award", { pi, pts, kind });
    return won;
  }

  // ----- cut for deal -----
  startCut() {
    this.cutDeck = newDeck(this.deckRng);
    this.cutPicks = new Map();      // player index -> position in cutDeck
    this.cutResult = null;          // null | "tie" | "done"
    this.phase = "cutdeal";
  }
  pickCut(pi, idx) {
    const taken = [...this.cutPicks.values()];
    if (this.cutPicks.has(pi) || taken.includes(idx) || idx < 0 || idx >= this.cutDeck.length) return false;
    this.cutPicks.set(pi, idx);
    this.say(`${this.players[pi].name} cut ${cardName(this.cutDeck[idx])}`);
    return true;
  }
  aiPickCut(pi) {
    const taken = [...this.cutPicks.values()];
    const free = [];
    for (let i = 0; i < this.cutDeck.length; i++) if (!taken.includes(i)) free.push(i);
    this.pickCut(pi, this.players[pi].ai.rng.choice(free));
  }
  /** Lowest card deals.  Returns true when settled, false on a tie (cut again). */
  resolveCut() {
    const ranks = [...this.cutPicks].map(([pi, i]) => [pi, RANK[this.cutDeck[i]]]);
    const low = Math.min(...ranks.map(([, r]) => r));
    const lows = ranks.filter(([, r]) => r === low).map(([pi]) => pi);
    if (lows.length > 1) {
      this.cutResult = "tie";
      this.say("Tie for low card - cut again.");
      return false;
    }
    this.dealer = lows[0];
    this.cutCards = this.players.map((_, i) => this.cutDeck[this.cutPicks.get(i)]);
    this.cutResult = "done";
    this._emit("cutdeal", { cards: [...this.cutCards], dealer: this.dealer });
    const d = this.players[this.dealer];
    this.say(`Low card deals: ${d.name} ${d.human ? "deal" : "deals"} first.`);
    return true;
  }
  /** Automatic cut (simulations / tests). */
  cutForDeal() {
    for (;;) {
      this.startCut();
      for (let pi = 0; pi < this.n; pi++) {
        const taken = [...this.cutPicks.values()];
        const free = [];
        for (let i = 0; i < 52; i++) if (!taken.includes(i)) free.push(i);
        this.pickCut(pi, this.deckRng.choice(free));
      }
      if (this.resolveCut()) break;
    }
  }

  // ----- round -----
  startRound() {
    this.deck = newDeck(this.deckRng);
    this.crib = []; this.starter = null;
    this.cribFrom = new Map();      // crib card -> player who put it there (null = off the deck)
    for (const p of this.players) { p.hand = []; p.kept = []; p.pegHand = []; p.dealt = []; }
    const per = this.n === 2 ? 6 : 5;
    let i = this.nxt(this.dealer);
    for (let k = 0; k < per * this.n; k++) {
      this.players[i].hand.push(this.deck.pop());
      i = this.nxt(i);
    }
    if (this.n === 3) {
      this.crib.push(this.deck.pop());
      this.cribFrom.set(this.crib[this.crib.length - 1], null);
    }
    for (const p of this.players) { p.hand = sortCards(p.hand); p.dealt = [...p.hand]; }
    this.handsPlayed++;
    this.showSteps = []; this.showI = -1; this.showCurrent = null;
    const d = this.players[this.dealer];
    this.say(`--- Hand ${this.handsPlayed}: ${d.name} ${d.human ? "deal" : "deals"} ---`);
    this.phase = "discard";
    this._resetPegState();
    this._emit("round");
  }
  aiDiscards() {
    this.players.forEach((p, i) => {
      if (p.human) return;
      const disc = p.ai.chooseDiscards(p.hand, this.nDiscard, i === this.dealer, this.n);
      for (const c of disc) p.hand.splice(p.hand.indexOf(c), 1);
      this.crib.push(...disc);
      for (const c of disc) this.cribFrom.set(c, i);
      p.kept = [...p.hand];
    });
  }
  humanDiscard(cards) {
    const p = this.players[this.human];
    if (cards.length !== this.nDiscard || !cards.every((c) => p.hand.includes(c))) throw new Error("bad discard");
    for (const c of cards) p.hand.splice(p.hand.indexOf(c), 1);
    this.crib.push(...cards);
    for (const c of cards) this.cribFrom.set(c, this.human);
    p.kept = [...p.hand];
    const whose = this.dealer === this.human ? "your" : `${this.players[this.dealer].name}'s`;
    this.say(`You put ${cardsText(cards)} in ${whose} crib.`);
    this.phase = "cut";
  }
  /** The player to the dealer's right cuts for the starter. */
  get cutter() { return (this.dealer - 1 + this.n) % this.n; }
  cutStarter() {
    this.starter = this.deck.splice(this.deckRng.randrange(this.deck.length), 1)[0];
    const c = this.players[this.cutter];
    this.say(`${c.name} ${c.human ? "cut" : "cuts"} - starter card: ${cardName(this.starter)}`);
    this._emit("starter", { card: this.starter, dealer: this.dealer, cutter: this.cutter });
    if (RANK[this.starter] === 11 && this.award(this.dealer, 2, "His Heels (Jack cut) for 2", "heels")) return true;
    return false;
  }

  // ----- pegging -----
  _resetPegState() {
    this.seq = []; this.prevSeq = []; this.count = 0;
    this.lastPlayer = null; this.saidGo = new Set();
    this.turn = 0; this.played = [];
    this.awaiting = null;
  }
  startPegging() {
    for (const p of this.players) p.pegHand = [...p.kept];
    this.seq = []; this.prevSeq = []; this.count = 0;
    this.lastPlayer = null; this.saidGo = new Set(); this.played = [];
    this.turn = this.nxt(this.dealer);
    this.phase = "peg";
    this.awaiting = null;
    this.lastPlay = this.lastScore = "";
  }
  legal(pi) { return this.players[pi].pegHand.filter((c) => VAL[c] + this.count <= 31); }
  _resetCount() {
    this.prevSeq = this.seq;
    this.seq = []; this.count = 0; this.saidGo = new Set();
  }
  /** One automatic pegging step: "human_play" | "human_go" | "acted" | "quick" | "done" | "over". */
  pegAdvance() {
    if (this.over) return "over";
    if (this.players.every((p) => !p.pegHand.length)) {
      if (this.seq.length && this.count !== 31 && this.lastPlayer !== null) {
        if (this.award(this.lastPlayer, 1, "Last card for 1", "go")) return "over";
      }
      this.phase = "peg_done";
      this._emit("pegdone", {});
      return "done";
    }
    if (!this.players.some((_, i) => this.legal(i).length)) {
      const lp = this.lastPlayer;
      if (lp !== null && this.count !== 31) {
        if (this.award(lp, 1, "Go for 1", "go")) return "over";
      }
      this._resetCount();
      this.turn = lp !== null ? this.nxt(lp) : this.nxt(this.dealer);
      return "acted";
    }
    const p = this.players[this.turn];
    if (!p.pegHand.length) { this.turn = this.nxt(this.turn); return "quick"; }
    const legal = this.legal(this.turn);
    if (!legal.length) {
      if (this.saidGo.has(this.turn)) { this.turn = this.nxt(this.turn); return "quick"; }
      if (p.human) { this.awaiting = "go"; return "human_go"; }
      this.saidGo.add(this.turn);
      this._emit("go", { pi: this.turn });
      this.say(`${p.name}: Go`);
      this.lastScore = `${p.name} says Go`;
      this.turn = this.nxt(this.turn);
      return "acted";
    }
    if (p.human) { this.awaiting = "play"; return "human_play"; }
    const card = p.ai.choosePlay(p.pegHand, [...this.seq], this.count, this.unseenFor(this.turn),
      this.players[this.nxt(this.turn)].pegHand.length, this.n);
    this.playCard(this.turn, card);
    return this.over ? "over" : "acted";
  }
  /** Cards player pi has not seen (its knowledge for pegging decisions). */
  unseenFor(pi) {
    const known = new Set([...this.players[pi].dealt, ...this.played]);
    if (this.starter !== null) known.add(this.starter);
    const out = [];
    for (let c = 0; c < 52; c++) if (!known.has(c)) out.push(c);
    return out;
  }
  playCard(pi, card) {
    const p = this.players[pi];
    p.pegHand.splice(p.pegHand.indexOf(card), 1);
    const prev = [...this.seq];
    this.seq.push(card);
    this.played.push(card);
    this.count += VAL[card];
    this.prevSeq = [];
    this.lastPlay = `${p.name} ${p.human ? "play" : "plays"} ${cardName(card)}  -  count ${this.count}`;
    this.lastScore = "";
    this.say(this.lastPlay);
    const [pts, reasons] = pegScore(this.seq);
    this._emit("play", { pi, card, prev, seq: [...this.seq], count: this.count, pts, reasons });
    this.lastPlayer = pi;
    if (pts && this.award(pi, pts, reasons.join(", "), "peg")) return;
    if (this.count === 31) this._resetCount();
    this.turn = this.nxt(pi);
  }
  humanPlay(card) {
    if (this.awaiting !== "play" || !this.legal(this.human).includes(card)) return false;
    this.awaiting = null;
    this.playCard(this.human, card);
    return true;
  }
  humanGo() {
    if (this.awaiting !== "go") return false;
    this.awaiting = null;
    this.saidGo.add(this.human);
    this._emit("go", { pi: this.human });
    this.say("You: Go");
    this.lastScore = "You say Go";
    this.turn = this.nxt(this.turn);
    return true;
  }

  // ----- the show -----
  startShow() {
    this.phase = "show";
    this.showSteps = [];
    for (let i = 0; i < this.n; i++) this.showSteps.push([(this.dealer + 1 + i) % this.n, "hand"]);
    this.showSteps.push([this.dealer, "crib"]);
    this.showI = -1;
    this.showCurrent = null;
  }
  /** Count the next hand; false when all are shown.  defer = prepare without scoring (call commitShow). */
  showNext(defer = false) {
    this.showI++;
    if (this.showI >= this.showSteps.length) return false;
    const [pi, kind] = this.showSteps[this.showI];
    const cards = sortCards(kind === "hand" ? this.players[pi].kept : this.crib);
    const items = handBreakdown(cards, this.starter, kind === "crib");
    const total = items.reduce((t, it) => t + it[2], 0);
    this.showCurrent = [pi, kind, cards, items, total];
    this.showCommitted = false;
    if (!defer) this.commitShow();
    return true;
  }
  /** Peg the points for the hand prepared by showNext(). */
  commitShow() {
    if (this.showCurrent === null || this.showCommitted) return;
    this.showCommitted = true;
    const [pi, kind, cards, items, total] = this.showCurrent;
    const p = this.players[pi];
    this._emit("show", { pi, kind, cards: [...cards], items, total, starter: this.starter,
      base: scoreHand(cards, null, kind === "crib") });
    const label = kind === "hand" ? "hand" : "crib";
    if (p.human) {
      const t = this.tally;
      if (kind === "hand") {
        t.hands++;
        t.handPoints += total;
        if (total >= t.highestHand) {
          t.highestHand = total;
          t.highestHandCards = `${cardsText(cards)} | ${cardName(this.starter)}`;
        }
        if (total === 29) t.twentyNines++;
        if (total === 0) t.zeroHands++;
      } else {
        t.cribs++;
        t.cribPoints += total;
        t.highestCrib = Math.max(t.highestCrib, total);
      }
    }
    if (total === 0) this.say(`${p.name}'s ${label}: ${cardsText(cards)} - nineteen (0)`);
    else this.award(pi, total, `${label} ${cardsText(cards)} for ${total}`, "show");
  }
  nextRound() {
    this.dealer = this.nxt(this.dealer);
    this.startRound();
  }

  // ----- results -----
  /** Outcome summary for stats (valid once the game is over). */
  result() {
    const hs = this.players[this.human].score;
    const losers = this.players.filter((_, i) => i !== this.winner);
    const cat = (s) => (s < DOUBLE_SKUNK_LINE ? "double" : s < SKUNK_LINE ? "skunk" : null);
    const won = this.winner === this.human;
    const res = { won, humanScore: hs, skunkGiven: null, skunked: null, margin: 0 };
    if (won) {
      const cats = losers.map((p) => cat(p.score));
      res.skunkGiven = cats.includes("double") ? "double" : cats.includes("skunk") ? "skunk" : null;
      res.margin = WIN_SCORE - Math.max(...losers.map((p) => p.score));
    } else {
      res.skunked = cat(hs);
    }
    return res;
  }
}
