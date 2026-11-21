// Session 2 tests: profiles, saving, backups, Python import, achievements, personalities.
// Code: (c) Corey J Ruff
import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileStore, MemoryStorage, classifyPythonFile } from "../js/profiles.js";
import { ACHIEVEMENTS, BY_ID } from "../js/achievements.js";
import { GameSession } from "../js/session.js";
import { ComputerAI } from "../js/ai.js";
import { SeededRng } from "../js/rng.js";
import { computerNames, normalizeSettings } from "../js/settings.js";
import { fixed } from "../js/stats.js";

function playOut(sess, humanLevel = "Expert", seed = 1) {
  const e = sess.engine, n = e.n;
  const bot = new ComputerAI(humanLevel, new SeededRng(seed));
  e.cutForDeal(); e.startRound();
  const me = e.players[0];
  while (!e.over) {
    e.aiDiscards();
    e.humanDiscard(bot.chooseDiscards(me.hand, e.nDiscard, e.dealer === 0, n));
    if (e.cutStarter()) break;
    e.startPegging();
    for (;;) {
      const st = e.pegAdvance();
      if (st === "human_play") e.humanPlay(bot.choosePlay(me.pegHand, [...e.seq], e.count, e.unseenFor(0), e.players[1].pegHand.length, n));
      else if (st === "human_go") e.humanGo();
      else if (st === "done" || st === "over") break;
    }
    if (e.over) break;
    e.startShow();
    while (e.showNext()) if (e.over) break;
    if (!e.over) e.nextRound();
  }
  return sess.finish();
}

test("achievement list is complete", () => {
  assert.equal(ACHIEVEMENTS.length, 71);
  assert.equal(ACHIEVEMENTS.reduce((t, a) => t + a.tiers.length, 0), 188);
  assert.ok(BY_ID.goat && BY_ID.aces_high && !BY_ID.all_fours);
});

test("profiles: create, rename, unique names, remove", () => {
  const ps = new ProfileStore(new MemoryStorage());
  const a = ps.create("Eyton");
  assert.throws(() => ps.create(" eyton "), /already/);
  assert.throws(() => ps.create("   "), /name/);
  const b = ps.create("Corey");
  assert.equal(ps.settings(a.id).name, "Eyton");
  ps.rename(a.id, "Eyton R");
  assert.equal(ps.get(a.id).name, "Eyton R");
  assert.equal(ps.settings(a.id).name, "Eyton R");
  assert.throws(() => ps.rename(a.id, "corey"), /already/);
  ps.select(b.id);
  assert.equal(ps.lastId, b.id);
  ps.remove(b.id);
  assert.equal(ps.lastId, null);
  assert.deepEqual(ps.list().map((p) => p.name), ["Eyton R"]);
});

test("each profile keeps its own stats and achievements, and they survive a reload", () => {
  const storage = new MemoryStorage();
  let ps = new ProfileStore(storage);
  const a = ps.create("Eyton"), b = ps.create("Dad");
  const stats = ps.stats(a.id);
  const sess = new GameSession(ps.settings(a.id), stats, ps.achievements(a.id, stats), { deckRng: new SeededRng(3) });
  playOut(sess);
  ps = new ProfileStore(storage);                            // "reload the page"
  assert.equal(ps.stats(a.id).aggregate().games_played, 1);
  assert.equal(ps.stats(b.id).aggregate().games_played, 0);
  assert.ok(ps.achievements(a.id).data.metrics.games_played === 1);
  assert.ok(!ps.achievements(b.id).data.metrics.games_played);
});

test("games against family are filed under the opponent too; Corey's picture flag", () => {
  const ps = new ProfileStore(new MemoryStorage());
  const p = ps.create("Eyton");
  const s = normalizeSettings({ players: 3, cpu_names: ["Corey", "Grandma"], levels: ["Easy", "Easy"], name: "Eyton" });
  assert.deepEqual(computerNames(s), ["Corey", "Grandma"]);
  const stats = ps.stats(p.id);
  const said = [];
  const sess = new GameSession(s, stats, ps.achievements(p.id, stats), { deckRng: new SeededRng(11), onSay: (pi, line) => said.push(line) });
  assert.equal(sess.engine.players[1].level, "Expert");      // Corey only plays Expert
  assert.ok(said.includes("I only play on expert because I wrote the damn game"));
  const out = playOut(sess, "Easy", 4);
  assert.equal(stats.aggregate(3, null, "Corey").games_played, 1);
  assert.equal(stats.aggregate(3, null, "Grandma").games_played, 1);
  assert.equal(stats.aggregate(3, "Expert").games_played, 1);
  assert.equal(out.youLose, sess.engine.players[sess.engine.winner].name === "Corey");
});

test("abandoned games are counted only when a hand has been played", () => {
  const ps = new ProfileStore(new MemoryStorage());
  const p = ps.create("Eyton");
  const stats = ps.stats(p.id);
  const s1 = new GameSession(ps.settings(p.id), stats, null);
  s1.abandon();
  assert.equal(stats.aggregate().abandoned, 0);
  const s2 = new GameSession(ps.settings(p.id), stats, null, { deckRng: new SeededRng(2) });
  s2.engine.cutForDeal(); s2.engine.startRound(); s2.engine.handsPlayed = 1;
  s2.abandon(); s2.abandon();
  assert.equal(stats.aggregate().abandoned, 1);
});

test("backup export and import (replace or keep both)", () => {
  const ps = new ProfileStore(new MemoryStorage());
  const a = ps.create("Eyton");
  const st = ps.stats(a.id);
  playOut(new GameSession(ps.settings(a.id), st, ps.achievements(a.id, st), { deckRng: new SeededRng(8) }));
  const backup = JSON.parse(JSON.stringify(ps.exportBackup()));
  const other = new ProfileStore(new MemoryStorage());          // e.g. a phone
  assert.deepEqual(other.importBackup(backup), [{ name: "Eyton", action: "added" }]);
  const id = other.findByName("Eyton").id;
  assert.deepEqual(other.stats(id).data, st.data);
  assert.deepEqual(other.importBackup(backup, { replace: false }), [{ name: "Eyton (2)", action: "added" }]);
  assert.deepEqual(other.importBackup(backup), [{ name: "Eyton", action: "replaced" }]);
  assert.equal(other.list().length, 2);
  assert.throws(() => other.importBackup({ hello: 1 }), /backup/);
});

test("importing the Python version's files", () => {
  const pyStats = { "2p|Hard": { games_played: 40, wins: 25, losses: 15, abandoned: 1, skunks_given: 3,
    double_skunks_given: 1, skunked: 0, double_skunked: 0, hands_counted: 300, hand_points: 2400,
    cribs_counted: 150, crib_points: 700, peg_points: 900, twenty_nines: 1, zero_hands: 12,
    points_scored: 4500, highest_hand: 29, highest_crib: 20, highest_peg: 12, best_streak: 6,
    biggest_win_margin: 44, current_streak: 2, highest_hand_cards: "5♠ 5♥ 5♦ J♣ + 5♣", last_played: "2026-11-20" },
    "2p|vs:grandpa": { games_played: 10, wins: 7, losses: 3 } };
  const pySettings = { players: 3, board: "Rectangular", colors: ["Green", "Red", "Blue"], name: "You", cpu_names: ["Grandpa", ""] };
  assert.equal(classifyPythonFile("stats.json", JSON.stringify(pyStats)).kind, "stats");
  assert.equal(classifyPythonFile("x.json", JSON.stringify({ metrics: {}, unlocked: {} })).kind, "achievements");
  assert.equal(classifyPythonFile("settings.json", JSON.stringify(pySettings)).kind, "settings");
  assert.equal(classifyPythonFile("photo.json", "not json"), null);

  const ps = new ProfileStore(new MemoryStorage());
  const p = ps.create("Corey");
  assert.throws(() => ps.importPython(p.id, { "notes.txt": "hello" }), /doesn't look/);
  const done = ps.importPython(p.id, { "stats.json": JSON.stringify(pyStats), "settings.json": JSON.stringify(pySettings) });
  assert.deepEqual(done, ["stats", "settings"]);
  assert.equal(ps.stats(p.id).aggregate(2, "Hard").wins, 25);
  assert.equal(ps.stats(p.id).aggregate(2, null, "Grandpa").wins, 7);
  const s = ps.settings(p.id);
  assert.equal(s.board, "Cribbagemaster");
  assert.equal(s.name, "Corey");                               // profile name kept
  // no achievements file: earlier history still unlocks what it proves
  const t = ps.achievements(p.id);
  assert.equal(t.tiersReached(BY_ID.first_victory), 1);
  assert.equal(t.tiersReached(BY_ID.perfect_29), 1);
  assert.equal(t.tiersReached(BY_ID.undefeated), 1);           // best streak 6
});

test("broken saved data never stops the game", () => {
  const storage = new MemoryStorage();
  storage.setItem("eyton.profiles", "{not json");
  const ps = new ProfileStore(storage);
  assert.deepEqual(ps.list(), []);
  const p = ps.create("Eyton");
  storage.setItem(`eyton.${p.id}.stats`, "garbage");
  storage.setItem(`eyton.${p.id}.settings`, JSON.stringify({ players: 9, colors: ["Red", "Red", "Red"] }));
  assert.equal(ps.stats(p.id).aggregate().games_played, 0);
  assert.equal(ps.settings(p.id).players, 2);
  assert.deepEqual(ps.settings(p.id).colors, ["Red", "Blue", "Gold"]);
});

test("Python-style rounding in the stats table", () => {
  assert.equal(fixed(102.35, 1), "102.3");
  assert.equal(fixed(0.125, 2), "0.12");
  assert.equal(fixed(2 / 3, 2), "0.67");
});
