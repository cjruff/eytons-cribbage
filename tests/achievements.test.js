// New achievements (Nov 2026): checked against hand-made event streams, plus a big simulation.
// Code: (c) Corey J Ruff
import { test } from "node:test";
import assert from "node:assert/strict";
import { AchievementTracker, ACHIEVEMENTS, BY_ID } from "../js/achievements.js";
import { GameSession } from "../js/session.js";
import { StatsStore } from "../js/stats.js";
import { ComputerAI } from "../js/ai.js";
import { SeededRng } from "../js/rng.js";
import { normalizeSettings } from "../js/settings.js";
import { Personalities } from "../js/personalities.js";

const card = (rank, suit = 0) => (rank - 1) * 4 + suit;

/** A pretend 2-player game the tracker can watch.  You are player 0. */
function fake({ n = 2, dealer = 1 } = {}) {
  const e = {
    n, human: 0, dealer, winner: null, difficulty: "Medium", levels: ["Medium"], observers: [],
    cribFrom: new Map(),
    players: Array.from({ length: n }, (_, i) => ({ name: i ? "Blue" : "You", human: i === 0, score: 0, pegHand: [1, 2, 3, 4], kept: [card(13), card(13, 1), card(12), card(12, 1)] })),
    result() {
      const me = this.players[0].score, others = this.players.slice(1).map((p) => p.score), top = Math.max(...others);
      const won = this.winner === 0, skunk = (s) => (s < 61 ? "double" : s < 91 ? "skunk" : null);
      return { won, humanScore: me, margin: won ? me - top : top - me,
        skunkGiven: won ? skunk(Math.min(...others)) : null, skunked: won ? null : skunk(me) };
    },
  };
  const t = new AchievementTracker(null);
  t.attach(e);
  const ev = (name, d = {}) => t.onEvent(name, d);
  const award = (pi, pts, kind = "peg") => {
    e.players[pi].score = Math.min(121, e.players[pi].score + pts);
    if (e.players[pi].score >= 121) e.winner = pi;
    ev("award", { pi, pts, kind });
  };
  return { e, t, ev, award, m: t.data.metrics };
}
const play = (pi, prev, reasons) => ({ pi, card: 0, prev, seq: [], count: 10, pts: 0, reasons });

test("list: 87 achievements; Pair-a-dice gone; renames; Diamond tier", () => {
  assert.equal(ACHIEVEMENTS.length, 88);
  assert.ok(!BY_ID.pair_a_dice);
  assert.equal(BY_ID.agony.name, "The Unthinkable");
  assert.equal(BY_ID.down_to_wire.name, "Ha, Ha... Suck it!");
  assert.equal(BY_ID.crib_monster.note, "");
  assert.equal(BY_ID.run_forrest.tierName(4), "Diamond");
});

test("Passing the Baton: 3 runs in a row, traded between you and an opponent", () => {
  const { ev, m } = fake();
  ev("round");
  ev("play", play(1, [], []));
  ev("play", play(0, [1], []));
  ev("play", play(1, [1, 2], ["Run of 3 for 3"]));
  ev("play", play(0, [1, 2, 3], ["Run of 4 for 4"]));
  assert.ok(!m.baton);
  ev("play", play(1, [1, 2, 3, 4], ["Run of 5 for 5"]));
  assert.equal(m.baton, 1);
  ev("play", play(0, [1, 2, 3, 4, 5], ["Run of 6 for 6"]));
  assert.equal(m.baton, 1);                 // same chain counts once
  assert.equal(m.peg_runs5, 1);             // Marathon Man: your run of 6
});
test("Passing the Baton needs you in the chain; a broken chain starts over", () => {
  const { ev, m } = fake({ n: 3 });
  ev("round");
  ev("play", play(1, [9], ["Run of 3 for 3"]));
  ev("play", play(2, [9, 9], ["Run of 4 for 4"]));
  ev("play", play(1, [9, 9, 9], ["Run of 5 for 5"]));
  assert.ok(!m.baton);                      // only the computers
  ev("play", play(0, [9, 9, 9, 9], ["Pair for 2"]));
  ev("play", play(1, [], ["Run of 3 for 3"]));   // new count, new chain
  assert.ok(!m.baton);
  assert.ok(!m.peg_runs5);                  // their runs don't count for Marathon Man
});

test("Small Ball: all the cards in the play add up to 31 or less", () => {
  const low = [[card(1), card(1, 1), card(2), card(2, 1)], [card(3), card(3, 1), card(4), card(4, 1)]];   // 1+1+2+2 + 3+3+4+4 = 20
  let { ev, m, e } = fake();
  e.players.forEach((p, i) => (p.kept = low[i]));
  ev("round"); ev("pegdone");
  assert.equal(m.small_ball, 1);
  ({ ev, m, e } = fake());
  e.players.forEach((p, i) => (p.kept = low[i]));
  e.players[1].kept[3] = card(13);          // 1+1+2+2 + 3+3+4+10 = 26: still fine
  ev("round"); ev("pegdone");
  assert.equal(m.small_ball, 1);
  ({ ev, m, e } = fake());
  e.players[0].kept = [card(10), card(10, 1), card(5), card(1)];   // 26
  e.players[1].kept = [card(2), card(2, 1), card(1, 1), card(1, 2)];   // 6 -> 32 total: no
  ev("round"); ev("pegdone");
  assert.ok(!m.small_ball);
  ({ ev, m, e } = fake());
  e.players[0].kept = [card(10), card(10, 1), card(5), card(1)];   // 26
  e.players[1].kept = [card(2), card(1, 1), card(1, 2), card(1, 3)];   // 5 -> exactly 31: yes
  ev("round"); ev("pegdone");
  assert.equal(m.small_ball, 1);
});

test("Do Pass Go: winning on a Go point counts, the last card does not", () => {
  let { ev, m, award, e } = fake();
  ev("round"); e.players[0].score = 120; award(0, 1, "go");
  assert.equal(m.win_go, 1);
  ({ ev, m, award, e } = fake());
  ev("round"); e.players[0].score = 120; e.players.forEach((p) => (p.pegHand = [])); award(0, 1, "go");
  assert.ok(!m.win_go);
  assert.equal(m.last_laughs, 1);
});

test("first play of the game: Off to a Good Start, Go Ahead Without Me, I'll Wait Here, You Wait There", () => {
  let { ev, m, award } = fake();
  ev("round"); award(0, 4); award(0, 2, "go"); award(1, 0); ev("pegdone");
  assert.equal(m.good_start, 1); assert.equal(m.wait_there, undefined);
  ({ ev, m, award } = fake());
  ev("round"); award(0, 2, "heels"); award(1, 6); ev("pegdone");     // His Heels isn't pegging
  assert.equal(m.go_ahead, 1); assert.ok(!m.wait_here);
  ev("round"); award(1, 7); ev("pegdone");
  assert.equal(m.wait_here, 1); assert.equal(m.go_ahead, 1);          // only the first hand counts for Go Ahead
  ev("round"); award(0, 8); ev("pegdone");
  assert.equal(m.wait_there, 1); assert.ok(!m.good_start);
});

test("R.I.P Lemmy: the Ace of Spades as the starter, whoever's crib", () => {
  const { ev, m, e } = fake({ dealer: 1 });
  ev("round"); ev("starter", { card: card(1, 0) });
  e.dealer = 0; ev("starter", { card: card(1, 0) });
  ev("starter", { card: card(1, 1) });      // Ace of Hearts: no
  assert.equal(m.ace_spades_starter, 2);
});

test("Low Rider, Ballsy Move, One Is the Loneliest Number, Bad Luck Brian, Run Forrest", () => {
  const { ev, m, e } = fake({ dealer: 1 });
  ev("cutdeal", { cards: [card(1), card(4)], dealer: 0 });
  assert.equal(m.low_rider, 1);
  ev("cutdeal", { cards: [card(2), card(1)], dealer: 1 });
  assert.equal(m.low_rider, 1);
  ev("round");
  e.cribFrom = new Map([[card(5, 0), 0], [card(5, 1), 0], [card(5, 2), 1], [card(9), 0]]);
  ev("starter", { card: card(3) });
  assert.equal(m.ballsy, 2);                // two of your 5s in Blue's crib
  e.dealer = 0;
  ev("starter", { card: card(3) });
  assert.equal(m.ballsy, 2);                // your own crib doesn't count
  ev("show", { pi: 0, kind: "hand", cards: [card(2), card(4), card(6), card(8)], items: [], total: 1, starter: card(13), base: 1 });
  assert.equal(m.one_point, 1);
  ev("show", { pi: 0, kind: "hand", cards: [card(2), card(4), card(6), card(8)], items: [], total: 0, starter: card(13), base: 0 });
  ev("show", { pi: 0, kind: "crib", cards: [card(2), card(4), card(6), card(8)], items: [], total: 0, starter: card(13), base: 0 });
  assert.equal(m.zero_both, 1);
  e.players[0].score = 31;
  ev("round");
  assert.equal(m.run_forrest, 1);           // checked once, when the second hand starts
  ev("round");
  assert.equal(m.run_forrest, 1);
});

test("Demoralized and Demoralizer; skunk achievements", () => {
  let { ev, m, award, e } = fake();
  ev("round"); e.players[0].score = 100; award(0, 6); e.players[1].score = 90; award(1, 31);
  assert.equal(m.demoralized, 1); assert.ok(!m.demoralizer);
  ({ ev, m, award, e } = fake());
  ev("round"); e.players[1].score = 107; award(1, 1); e.players[0].score = 110; award(0, 11);
  assert.equal(m.demoralizer, 1);
  ({ ev, m, award, e } = fake());
  ev("round"); e.players[0].score = 90; e.players[1].score = 120; award(1, 1);
  assert.deepEqual([m.skunked_count, m.skunked_90, m.double_skunked_count], [1, 1, undefined]);
  ({ ev, m, award, e } = fake());
  ev("round"); e.players[0].score = 40; e.players[1].score = 120; award(1, 1);
  assert.deepEqual([m.skunked_count, m.double_skunked_count, m.skunked_90], [1, 1, undefined]);
});

test("See one, play one: Sue, Larry, Corey, Grandma, Grandpa (and not Jack)", () => {
  for (const [who, says] of [["Sue", true], ["Larry", true], ["Corey", true], ["Grandma", true], ["Grandpa", true], ["Jack", false]]) {
    const said = [];
    const e = { n: 2, human: 0, starter: card(7, 0), played: [card(7, 1)], winner: null, observers: [],
      players: [{ name: "You", human: true }, { name: who, human: false }] };
    new Personalities(e, (pi, line) => said.push(line)).onEvent("play", { pi: 1, card: card(7, 1) });
    assert.equal(said.includes("See one, play one"), says, who);
  }
});

test("1,500 simulated games: every new achievement can happen, nothing breaks", () => {
  const stats = new StatsStore(null);
  const tracker = new AchievementTracker(null);
  const opps = ["Grandma", "Grandpa", "Larry", "Sue", "Corey", ""];
  for (let g = 0; g < 1500; g++) {
    const s = normalizeSettings({ players: 2 + (g % 3 === 0 ? 1 : 0), levels: ["Easy", "Hard"], cpu_names: [opps[g % 6], opps[(g + 2) % 6]] });
    const sess = new GameSession(s, stats, tracker, { deckRng: new SeededRng(g + 1), aiRngs: [new SeededRng(g + 7), new SeededRng(g + 9)] });
    const e = sess.engine, bot = new ComputerAI(["Easy", "Medium", "Expert"][g % 3], new SeededRng(g + 3));
    e.cutForDeal(); e.startRound();
    const me = e.players[0];
    while (!e.over) {
      e.aiDiscards();
      e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === 0, e.n));
      if (e.cutStarter()) break;
      e.startPegging();
      for (;;) {
        const st = e.pegAdvance();
        if (st === "human_play") e.humanPlay(bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(0), e.players[1].pegHand.length, e.n));
        else if (st === "human_go") e.humanGo();
        else if (st === "done" || st === "over") break;
      }
      if (e.over) break;
      e.startShow();
      while (e.showNext()) if (e.over) break;
      if (!e.over) e.nextRound();
    }
    sess.finish();
  }
  const m = tracker.data.metrics;
  const fresh = ["peg_runs5", "baton", "win_go", "low_rider", "good_start", "wait_here", "wait_there", "small_ball",
    "go_ahead", "demoralized", "demoralizer", "run_forrest", "skunked_count", "one_point", "ballsy", "zero_both"];
  const seen = Object.fromEntries(fresh.map((k) => [k, m[k] || 0]));
  console.log("   counts over 1,500 games:", JSON.stringify(seen));
  for (const k of fresh) assert.ok(seen[k] > 0, `${k} never happened`);
  assert.ok(seen.low_rider < 1500 && seen.good_start < 1500 && seen.run_forrest < 1500);   // at most once per game
});

test("Traditional board: 3 tracks of 120 holes in order, no jumps, single finish", async () => {
  const fs = await import("node:fs");
  const b = JSON.parse(fs.readFileSync(new URL("../boards/traditional.json", import.meta.url), "utf8"));
  assert.equal(b.tracks.length, 3);
  const all = [];
  for (const t of b.tracks) {
    assert.equal(t.length, 122);
    for (const [x, y] of t) { assert.ok(x > 0 && x < b.size[0] && y > 0 && y < b.size[1]); all.push([x, y]); }
    for (let i = 3; i < 122; i++) {                          // hole to hole along the track: one step, never a jump
      const d = Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]);
      assert.ok(d > 5 && d < 28, `step ${i - 1} -> ${i} is ${d.toFixed(1)}px`);
    }
    const last = t[121], d = Math.hypot(last[0] - b.finish[0], last[1] - b.finish[1]);
    assert.ok(d < 32, `hole 120 is ${d.toFixed(1)}px from the finish`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    assert.ok(Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) > 5, "two holes in the same place");
  }
  for (let i = 2; i < 122; i++) {                            // the three tracks run side by side
    const a = b.tracks[0][i], c = b.tracks[2][i];
    assert.ok(Math.hypot(a[0] - c[0], a[1] - c[1]) < 32, `tracks drift apart at hole ${i - 1}`);
  }
});
