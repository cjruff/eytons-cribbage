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
import { pegScore } from "../js/scoring.js";

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
  assert.equal(ACHIEVEMENTS.length, 94);
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

test("See one, play one: every computer player, family or not", () => {
  for (const [who, says] of [["Sue", true], ["Larry", true], ["Corey", true], ["Grandma", true], ["Grandpa", true], ["Jack", true], ["Blue", true], ["Uncle Bob", true]]) {
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

test("Passing the Baton with the real scoring: 3-4-5-3-4 (runs of 3, never longer)", () => {
  const { ev, m } = fake();
  ev("round");
  const ranks = [3, 4, 5, 3, 4], who = [1, 0, 1, 0, 1], seq = [];
  const runs = [];
  ranks.forEach((r, i) => {
    const prev = [...seq];
    seq.push(card(r, i % 4));
    const [, reasons] = pegScore(seq);
    runs.push(reasons.filter((x) => x.startsWith("Run")).join(""));
    ev("play", play(who[i], prev, reasons));
  });
  assert.deepEqual(runs.map((x) => x.slice(0, 8)), ["", "", "Run of 3", "Run of 3", "Run of 3"]);
  assert.equal(m.baton, 1);
});

test("Gonna Be a Fast Game: 16+ pegging points between everyone in one hand's play", () => {
  let { ev, m, award } = fake();
  ev("round"); award(0, 6); award(1, 8); award(0, 1, "go"); ev("pegdone");
  assert.ok(!m.fast_game);                  // 15
  ev("round"); award(0, 6); award(1, 8); award(0, 2, "go"); ev("pegdone");
  assert.equal(m.fast_game, 1);             // 16
  ev("round"); award(0, 2, "heels"); award(1, 14); ev("pegdone");
  assert.equal(m.fast_game, 1);             // His Heels isn't pegging
});

test("Lori says Heeeeey when anyone's front peg lands on 69; Alex's new losing line", () => {
  const said = [];
  const e = { n: 3, human: 0, starter: null, played: [], winner: null, observers: [],
    players: [{ name: "You", human: true, score: 65 }, { name: "Lori", human: false, score: 0 }, { name: "Alex", human: false, score: 0 }] };
  const v = new Personalities(e, (pi, line) => said.push(`${e.players[pi].name}: ${line}`));
  e.players[0].score = 69; v.onEvent("award", { pi: 0, pts: 4, kind: "peg" });
  e.players[2].score = 69; v.onEvent("award", { pi: 2, pts: 69, kind: "hand" });
  e.players[2].score = 75; v.onEvent("award", { pi: 2, pts: 6, kind: "peg" });
  assert.deepEqual(said, ["Lori: Heeeeey", "Lori: Heeeeey"]);
  e.players[0].score = 121; e.winner = 0; v.onEvent("award", { pi: 0, pts: 52, kind: "hand" });
  assert.ok(said.includes("Alex: Well, we don't play this at Widener"));
});

test("Traditional Loop is retired: saved settings move to the 29 Board", async () => {
  const { normalizeSettings, BOARD_STYLES } = await import("../js/settings.js");
  assert.ok(!BOARD_STYLES.includes("Traditional Loop"));
  assert.equal(normalizeSettings({ board: "Traditional Loop" }).board, "29 Board");
  assert.equal(normalizeSettings({ board: "Rectangular" }).board, "Cribbagemaster");
});

test("6-6-6: The Devil's Play, and Corey / Alex / Jack say \"The Devil\"", () => {
  const six = (s) => card(6, s);
  const { ev, m } = fake();
  ev("round");
  const step = (pi, seq) => ev("play", { pi, card: seq[seq.length - 1], prev: seq.slice(0, -1), seq, count: 0, pts: 0, reasons: [] });
  step(1, [six(0)]); step(0, [six(0), six(1)]);
  assert.ok(!m.devils_play);
  step(1, [six(0), six(1), six(2)]);
  assert.equal(m.devils_play, 1);
  step(0, [six(0), six(1), six(2), six(3)]);  // a fourth 6 doesn't count again
  assert.equal(m.devils_play, 1);
  step(1, [card(5), six(0), six(1)]);         // only two in a row
  assert.equal(m.devils_play, 1);

  const said = [];
  const e = { n: 3, human: 0, starter: null, played: [1, 2, 3], winner: null, observers: [],
    players: [{ name: "You", human: true }, { name: "Jack", human: false }, { name: "Grandma", human: false }] };
  const v = new Personalities(e, (pi, line) => said.push(`${e.players[pi].name}: ${line}`));
  v.onEvent("play", { pi: 2, card: six(2), seq: [six(0), six(1), six(2)] });
  v.onEvent("play", { pi: 0, card: six(3), seq: [six(0), six(1), six(2), six(3)] });
  assert.deepEqual(said, ["Jack: The Devil"]);
});

test("Death Wish and Stocking the Pond: a pair of 5s in a crib", () => {
  const { ev, m, e } = fake({ dealer: 1 });
  ev("round");
  e.cribFrom = new Map([[card(5, 0), 0], [card(5, 1), 0], [card(9), 1], [card(2), 1]]);
  ev("starter", { card: card(3) });
  assert.deepEqual([m.death_wish, m.stocking_pond, m.ballsy], [1, undefined, 2]);
  e.cribFrom = new Map([[card(5, 0), 0], [card(9), 0], [card(5, 1), 1], [card(2), 1]]);   // one 5 each: no pair from you
  ev("starter", { card: card(3) });
  assert.deepEqual([m.death_wish, m.ballsy], [1, 3]);
  e.dealer = 0;
  e.cribFrom = new Map([[card(5, 2), 0], [card(5, 3), 0], [card(9), 1], [card(2), 1]]);
  ev("starter", { card: card(3) });
  assert.deepEqual([m.death_wish, m.stocking_pond, m.ballsy], [1, 1, 3]);
});

test("Diamond everywhere: every multi-level achievement has 5 levels; R.I.P. Lemmy 1-5-10-25-50", () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.tiers.length === 1 || a.tiers.length === 5, a.name);
    for (let i = 1; i < a.tiers.length; i++) assert.ok(a.tiers[i] > a.tiers[i - 1], a.name);
  }
  assert.deepEqual(BY_ID.lemmy.tiers, [1, 5, 10, 25, 50]);
  assert.deepEqual(BY_ID.pegging_pro.tiers, [500, 2500, 5000, 10000, 25000]);
  assert.deepEqual(BY_ID.nice_hand.tiers, [1, 10, 50, 200, 500]);
  assert.deepEqual(BY_ID.lucky_cut.tiers, [1, 10, 25, 50, 100]);
});

test("Export stats / achievements files and import them into another player", async () => {
  const { ProfileStore, MemoryStorage } = await import("../js/profiles.js");
  const ps = new ProfileStore(new MemoryStorage());
  const a = ps.create("Eyton"), b = ps.create("Dad");
  const st = ps.stats(a.id); const tr = ps.achievements(a.id, st);
  st.record(2, "Hard", { hands: 3, handPoints: 20, cribs: 1, cribPoints: 4, twentyNines: 0, zeroHands: 0, highestHand: 12, highestHandCards: "", highestCrib: 4, highestPeg: 3, pegPoints: 9 },
    "win", { won: true, humanScore: 121, margin: 30, skunkGiven: null, skunked: null });
  tr.inc("wins", 3); tr._done();
  const statsFile = JSON.stringify(ps.raw(a.id).stats), achFile = JSON.stringify(ps.raw(a.id).achievements);
  // Dad already has a medal; importing only a stats file keeps it
  const trB = ps.achievements(b.id); trB.inc("nobs", 25); trB._done();
  assert.deepEqual(ps.importPython(b.id, { "stats.json": statsFile }), ["stats"]);
  assert.equal(ps.stats(b.id).aggregate(2, "Hard").wins, 1);
  assert.equal(ps.achievements(b.id).data.metrics.nobs, 25);
  assert.deepEqual(ps.importPython(b.id, { "achievements.json": achFile }), ["achievements"]);
  assert.equal(ps.achievements(b.id).data.metrics.wins, 3);
  assert.ok(!ps.achievements(b.id).data.metrics.nobs);              // the achievements file replaced Dad's
});

test("our furry friends play but never talk", () => {
  for (const pet of ["Eyton", "Morgan", "Nala", "Rhys", "Wally", "Nala 2"]) {
    const said = [];
    const e = { n: 2, human: 0, starter: card(7, 0), played: [card(7, 1)], winner: null, observers: [],
      players: [{ name: "You", human: true, score: 0 }, { name: pet, human: false, score: 0 }] };
    const v = new Personalities(e, (pi, line) => said.push(line));
    v.onEvent("play", { pi: 1, card: card(7, 1) });                       // would be "See one, play one"
    e.players[1].score = 121; e.winner = 1; v.onEvent("award", { pi: 1, pts: 20, kind: "hand" });
    assert.deepEqual(said, [], pet);
    assert.deepEqual(v.personality(1), {}, pet);
  }
});

// ---------------------------------------------------------------- family lines, round 3
const voiceGame = (names, scores = null) => {
  const e = { n: names.length, human: 0, starter: null, played: [], winner: null, observers: [], cribFrom: new Map(),
    players: names.map((nm, i) => ({ name: nm, human: i === 0, score: scores ? scores[i] : 0 })) };
  return e;
};
const showItems = async (hand, starter) => (await import("../js/scoring.js")).handBreakdown(hand, starter, false);

test("pegging shows '3 of a kind' and '4 of a kind!'", () => {
  assert.ok(pegScore([card(5), card(5, 1), card(5, 2)])[1].includes("3 of a kind for 6"));
  assert.ok(pegScore([card(3), card(3, 1), card(3, 2), card(3, 3)])[1].includes("4 of a kind for 12!"));
});

test("Grandpa: luckiest person only after losing to you 3 games running", () => {
  const mem = new Map();
  const memory = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) };
  const game = (youWin) => {
    const said = [];
    const e = voiceGame(["You", "Grandpa"], [100, 100]);
    const v = new Personalities(e, (pi, line) => said.push(line), undefined, { memory });
    e.winner = youWin ? 0 : 1; e.players[e.winner].score = 121;
    v.onEvent("award", { pi: e.winner, pts: 21, kind: "show" });
    return said;
  };
  assert.ok(!game(true).includes("You are the luckiest person I know"));
  assert.ok(!game(true).includes("You are the luckiest person I know"));
  assert.ok(game(true).includes("You are the luckiest person I know"));     // 3rd in a row
  assert.ok(game(true).includes("You are the luckiest person I know"));     // and while it lasts
  assert.ok(game(false).includes("Hot Damn!"));                              // he wins: streak over
  assert.ok(!game(true).includes("You are the luckiest person I know"));
});

test("Grandma: skunked by you costs 50 cents", () => {
  for (const [score, line] of [[80, "You skunked me!  Here's 50 cents."], [100, "Here's your quarter"]]) {
    const said = [];
    const e = voiceGame(["You", "Grandma"], [121, score]);
    const v = new Personalities(e, (pi, l) => said.push(l));
    e.winner = 0; v.onEvent("award", { pi: 0, pts: 10, kind: "show" });
    assert.deepEqual(said, [line]);
  }
});

test("Grandpa: High Hand at least", async () => {
  const run = (behindBy, grandpaPegs, othersPeg, gpHand, youHand) => {
    const said = [];
    const e = voiceGame(["You", "Grandpa"], [60, 60 - behindBy]);
    const v = new Personalities(e, (pi, l) => said.push(l));
    v.onEvent("round", {});
    if (othersPeg) v.onEvent("award", { pi: 0, pts: othersPeg, kind: "peg" });
    if (grandpaPegs) v.onEvent("award", { pi: 1, pts: grandpaPegs, kind: "go" });
    e.players[0].score += othersPeg;
    v.onEvent("pegdone", {});
    v.onEvent("show", { pi: 0, kind: "hand", items: [], total: youHand });
    v.onEvent("show", { pi: 1, kind: "hand", items: [], total: gpHand });
    v.onEvent("show", { pi: 1, kind: "crib", items: [], total: 2, cards: [] });
    return said.includes("High Hand at least");
  };
  assert.ok(run(30, 0, 5, 12, 8));          // 30 behind + 5 more pegged by you = 35 behind
  assert.ok(!run(20, 0, 5, 12, 8));         // only 25 behind
  assert.ok(!run(40, 1, 5, 12, 8));         // he pegged a point
  assert.ok(!run(40, 0, 4, 12, 8));         // others pegged only 4
  assert.ok(!run(40, 0, 6, 8, 8));          // tied hand isn't the high hand
});

test("Grandma / Sue: hold this crazy - at least once, never more than 3", () => {
  for (const [rng, expect] of [[() => 0, 3], [() => 0.99, 1]]) {
    const said = [];
    const e = voiceGame(["You", "Sue", "Grandma"]);
    const v = new Personalities(e, (pi, l) => said.push(`${e.players[pi].name}: ${l}`), undefined, { rng });
    for (let k = 0; k < 9; k++) v.onEvent("discards", {});
    for (const who of ["Sue", "Grandma"]) assert.equal(said.filter((x) => x === `${who}: I'm going to hold this crazy`).length, expect);
  }
  const said = [];
  const e = voiceGame(["You", "Larry"]);
  const v = new Personalities(e, (pi, l) => said.push(l), undefined, { rng: () => 0 });
  for (let k = 0; k < 5; k++) v.onEvent("discards", {});
  assert.deepEqual(said, []);
});

test("Sue / Larry: losing to Corey by 36+, once a game; Larry's Fiddle sticks", () => {
  for (const human of ["Corey", "Pat"]) {
    const said = [];
    const e = voiceGame([human, "Sue", "Larry"], [50, 10, 14]);
    if (human === "Pat") e.players.push({ name: "Corey", human: false, score: 50 }), e.n = 4;
    const v = new Personalities(e, (pi, l) => said.push(`${e.players[pi].name}: ${l}`));
    const cp = human === "Corey" ? 0 : 3;
    e.players[cp].score = 52; v.onEvent("award", { pi: cp, pts: 2, kind: "peg" });   // Sue 42 behind, Larry 38
    e.players[cp].score = 60; v.onEvent("award", { pi: cp, pts: 8, kind: "show" });
    assert.equal(said.filter((x) => x === "Sue: My son was always far superior at this game than I").length, 1);
    assert.equal(said.filter((x) => x === "Larry: My son was always far superior at this game than I").length, 1);
  }
  const said = [];
  const e = voiceGame(["You", "Larry"]);
  new Personalities(e, (pi, l) => said.push(l)).onEvent("show", { pi: 1, kind: "hand", items: [], total: 0 });
  assert.deepEqual(said, ["Oh Fiddle sticks"]);
});

test("anyone: Double run of 5 for 10 (10-J-J-Q-K, no nobs); Grandpa's new cadence", async () => {
  const { handBreakdown } = await import("../js/scoring.js");
  const sayFor = (hand, starter, who = "Uncle Bob") => {
    const said = [];
    const e = voiceGame(["You", who]);
    const items = handBreakdown(hand, starter, false);
    new Personalities(e, (pi, l) => said.push(l)).onEvent("show", { pi: 1, kind: "hand", items, total: items.reduce((t, x) => t + x[2], 0) });
    return said;
  };
  assert.deepEqual(sayFor([card(10, 0), card(11, 1), card(11, 2), card(12, 3)], card(13, 0)), ["Double run of 5 for 10"]);
  assert.deepEqual(sayFor([card(10, 0), card(11, 0), card(11, 2), card(12, 3)], card(13, 0)), []);   // nobs makes 11
  assert.deepEqual(sayFor([card(10, 0), card(11, 1), card(11, 2), card(12, 3)], card(13, 0), "Nala"), []);   // pets stay quiet
  // Grandpa: 5's line on a player's 13th five, double runs on the 8th
  const said = [];
  const e = voiceGame(["You", "Grandpa"]);
  const v = new Personalities(e, (pi, l) => said.push(l));
  for (let k = 1; k <= 13; k++) { e.played = [card(2), card(5)]; v.onEvent("play", { pi: 0, card: card(5, k % 4) }); assert.equal(said.length, k === 13 ? 1 : 0); }
});

test("Now That Is (Really) How To Peg: 31 on the 3rd / 4th Ace in a row", () => {
  const { e, ev, m } = fake();
  ev("round");
  const A = [card(1, 0), card(1, 1), card(1, 2), card(1, 3)];
  ev("play", { pi: 0, card: A[2], prev: [card(10), card(9), card(9, 1), A[0], A[1]], seq: [card(10), card(9), card(9, 1), A[0], A[1], A[2]], count: 31, pts: 8, reasons: ["Thirty-one for 2", "3 of a kind for 6"] });
  ev("play", { pi: 0, card: A[3], prev: [card(10), card(10, 1), card(3), A[0], A[1], A[2]], seq: [card(10), card(10, 1), card(3), ...A], count: 31, pts: 14, reasons: ["Thirty-one for 2", "4 of a kind for 12!"] });
  ev("play", { pi: 1, card: A[2], prev: [], seq: [card(10), card(9), card(9, 1), A[0], A[1], A[2]], count: 31, pts: 8, reasons: [] });   // computer's: no
  assert.deepEqual([m.peg_aces31_3, m.peg_aces31_4, m.peg_pair_royals, m.peg_double_royals], [1, 1, 1, 1]);
  assert.equal(BY_ID.really_how_to_peg.tiers.join(), "1,10,25,50,100");
  assert.equal(e.n, 2);
});
