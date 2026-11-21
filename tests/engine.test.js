// Engine tests (ported from test_cribbage.py).   Run:  npm test
// Code: (c) Corey J Ruff
import { test } from "node:test";
import assert from "node:assert/strict";
import { RANK, VAL } from "../js/cards.js";
import { scoreHand, handBreakdown, pegScore, pegPtsRanks } from "../js/scoring.js";
import { ComputerAI, DIFFICULTIES } from "../js/ai.js";
import { CribbageEngine, WIN_SCORE } from "../js/engine.js";
import { SeededRng, CryptoRng } from "../js/rng.js";

const S = 0, H = 1, D = 2, C = 3;
const card = (rank, suit) => (rank - 1) * 4 + suit;
const sum = (items) => items.reduce((t, it) => t + it[2], 0);
function check(hand, starter, expected, crib = false) {
  assert.equal(scoreHand(hand, starter, crib), expected);
  assert.equal(sum(handBreakdown(hand, starter, crib)), expected);
}

test("29 hand", () => check([card(5, S), card(5, H), card(5, D), card(11, C)], card(5, C), 29));
test("28 hand", () => check([card(5, S), card(5, H), card(5, D), card(5, C)], card(13, S), 28));
test("double-double run", () => check([card(7, S), card(7, H), card(8, D), card(8, C)], card(9, S), 24));
test("zero hand", () => check([card(2, S), card(4, H), card(6, D), card(8, C)], card(13, S), 0));
test("flush rules", () => {
  const hand = [card(2, H), card(4, H), card(6, H), card(8, H)];
  check(hand, card(13, S), 4);
  check(hand, card(13, S), 0, true);       // crib needs all five
  check(hand, card(13, H), 5);
  check(hand, card(13, H), 5, true);
});
test("his nobs", () => check([card(11, H), card(2, S), card(4, D), card(6, C)], card(9, H), 5));
test("fast score matches itemised count", () => {
  const r = new SeededRng(7);
  for (let i = 0; i < 4000; i++) {
    const c = r.sample([...Array(52).keys()], 5);
    const crib = r.random() < 0.3;
    assert.equal(scoreHand(c.slice(0, 4), c[4], crib), sum(handBreakdown(c.slice(0, 4), c[4], crib)));
  }
});

test("pegging: fifteens, pairs, royals", () => {
  assert.equal(pegScore([card(10, S), card(5, H)])[0], 2);
  assert.equal(pegScore([card(5, S), card(5, H), card(5, D)])[0], 8);
  assert.equal(pegScore([card(3, S), card(3, H), card(3, D), card(3, C)])[0], 12);
});
test("pegging: runs", () => {
  assert.equal(pegScore([card(4, S), card(6, H), card(5, D)])[0], 5);
  assert.equal(pegScore([card(2, S), card(4, H), card(3, D), card(5, C)])[0], 4);
  assert.equal(pegScore([card(4, S), card(4, H), card(5, D), card(6, C)])[0], 3);
  assert.equal(pegScore([card(4, S), card(5, H), card(4, D)])[0], 0);
});
test("pegging: 31", () => assert.equal(pegScore([card(10, S), card(10, H), card(11, D), card(1, C)])[0], 2));
test("rank scorer matches card scorer", () => {
  const r = new SeededRng(3);
  for (let i = 0; i < 3000; i++) {
    const deck = r.shuffle([...Array(52).keys()]);
    const seq = []; let count = 0;
    for (const c of deck) {
      if (count + VAL[c] > 31) break;
      seq.push(c); count += VAL[c];
      assert.equal(pegScore(seq)[0], pegPtsRanks(seq.map((x) => RANK[x]), count));
    }
  }
});

/** Simulate a whole game; the human seat is driven by a computer player. */
function playGame(n, levels, seed, humanLevel = "Medium", deckRng = null) {
  const e = new CribbageEngine(n, levels, {
    deckRng: deckRng || new SeededRng(seed),
    aiRngs: [new SeededRng(seed + 2), new SeededRng(seed + 3)],
  });
  const bot = new ComputerAI(humanLevel, new SeededRng(seed + 1));
  e.cutForDeal();
  e.startRound();
  const me = e.players[e.human];
  for (let k = 0; k < 200; k++) {
    e.aiDiscards();
    e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === e.human, n));
    if (e.cutStarter()) break;
    e.startPegging();
    for (;;) {
      const st = e.pegAdvance();
      if (st === "human_play") {
        assert.ok(e.humanPlay(bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(e.human),
          e.players[e.nxt(e.human)].pegHand.length)));
      } else if (st === "human_go") assert.ok(e.humanGo());
      else if (st === "done" || st === "over") break;
    }
    if (e.over) break;
    // every card is pegged exactly once
    assert.deepEqual([...e.played].sort((a, b) => a - b),
      e.players.flatMap((p) => p.kept).sort((a, b) => a - b));
    e.startShow();
    while (e.showNext()) if (e.over) break;
    if (e.over) break;
    e.nextRound();
  }
  assert.ok(e.over);
  assert.equal(e.players[e.winner].score, WIN_SCORE);
  return e;
}

test("games complete at every level, 2 and 3 players", () => {
  for (const n of [2, 3]) {
    for (const lvl of DIFFICULTIES) {
      for (let s = 0; s < 3; s++) {
        const e = playGame(n, lvl, s * 31 + n);
        assert.ok(e.result());
      }
    }
  }
});
test("games complete with real (crypto) shuffles", () => {
  for (let s = 0; s < 10; s++) playGame(2 + (s % 2), "Hard", s, "Easy", new CryptoRng());
});
test("difficulty never changes the cards", () => {
  const deals = DIFFICULTIES.map((lvl) => {
    const e = new CribbageEngine(2, lvl, { deckRng: new SeededRng(99) });
    e.cutForDeal();
    e.startRound();
    return JSON.stringify(e.players.map((p) => p.hand));
  });
  assert.ok(deals.every((d) => d === deals[0]));
});
test("computer never sees hidden cards", () => {
  const e = new CribbageEngine(2, "Expert", { deckRng: new SeededRng(5) });
  e.cutForDeal(); e.startRound(); e.aiDiscards();
  const me = e.players[e.human];
  e.humanDiscard(me.hand.slice(0, 2));
  e.cutStarter(); e.startPegging();
  const unseen = new Set(e.unseenFor(1));
  assert.ok(me.kept.every((c) => unseen.has(c)));                 // your cards stay unknown
  assert.ok(e.players[1].dealt.every((c) => !unseen.has(c)));
});

test("interactive cut for deal and ties", () => {
  const e = new CribbageEngine(3, ["Easy", "Expert"], { deckRng: new SeededRng(2) });
  assert.equal(e.difficulty, "Expert");
  assert.deepEqual(e.players.map((p) => p.level), [null, "Easy", "Expert"]);
  for (let a = 0; a < 50; a++) {
    e.startCut();
    assert.ok(e.pickCut(0, 10));
    assert.ok(!e.pickCut(0, 11));
    e.aiPickCut(1); e.aiPickCut(2);
    assert.equal(new Set(e.cutPicks.values()).size, 3);
    if (e.resolveCut()) {
      const low = Math.min(...e.cutCards.map((c) => RANK[c]));
      assert.equal(RANK[e.cutCards[e.dealer]], low);
      break;
    }
    assert.equal(e.cutResult, "tie");
  }
  const t = new CribbageEngine(2, "Medium");
  t.startCut();
  t.cutDeck = [card(4, S), card(4, H), ...t.cutDeck.slice(2)];
  t.pickCut(0, 0); t.pickCut(1, 1);
  assert.ok(!t.resolveCut());
});
test("names and colours", () => {
  const e = new CribbageEngine(3, "Easy", { names: ["Blue", "Ace"], colors: ["#111", "#222", "#333"] });
  assert.deepEqual(e.players.slice(1).map((p) => p.name), ["Blue", "Ace"]);
  assert.deepEqual(e.players.map((p) => p.color), ["#111", "#222", "#333"]);
  assert.equal(new CribbageEngine(2, "Easy").players[1].name, "Computer");
});
test("crib remembers who put each card in", () => {
  const e = new CribbageEngine(3, "Hard", { deckRng: new SeededRng(4) });
  e.dealer = 1; e.startRound(); e.aiDiscards();
  e.humanDiscard(e.players[0].hand.slice(0, 1));
  assert.deepEqual([...e.cribFrom.values()].map(String).sort(), ["0", "1", "2", "null"]);
});
