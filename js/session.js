// One game for one profile: builds the engine from settings and wires up
// achievements, lifetime stats and opponent personalities.  No screen code.
// Code: (c) Corey J Ruff
import { CribbageEngine } from "./engine.js";
import { PEG_PALETTE, computerNames, computerLevels, presetOpponents, baseName } from "./settings.js";
import { Personalities } from "./personalities.js";

export class GameSession {
  /**
   * settings: a profile's settings; stats: StatsStore; tracker: AchievementTracker (or null)
   * opts: { onSay(pi, line, trigger), deckRng, aiRngs }
   */
  constructor(settings, stats, tracker, opts = {}) {
    this.settings = settings;
    this.stats = stats;
    this.tracker = tracker;
    const s = settings;
    const names = computerNames(s);
    this.engine = new CribbageEngine(s.players, computerLevels(s, names), {
      humanName: s.name || "You",
      colors: s.colors.map((c) => PEG_PALETTE[c]),
      names, deckRng: opts.deckRng, aiRngs: opts.aiRngs,
    });
    if (tracker) tracker.attach(this.engine);
    this.voices = new Personalities(this.engine, opts.onSay || null, opts.now);
    this.recorded = false;
    if (opts.greet !== false) this.voices.greet();
  }

  get inProgress() { const e = this.engine; return !e.over && e.handsPlayed > 0; }

  /** Call once the game is won or lost.  Returns what the screen needs to show. */
  finish() {
    const e = this.engine;
    const res = e.result();
    if (!this.recorded) {
      this.stats.record(e.n, e.difficulty, e.tally, res.won ? "win" : "loss", res, presetOpponents(e));
      this.recorded = true;
    }
    const w = e.players[e.winner];
    return {
      result: res,
      youLose: !w.human && baseName(w.name) === "corey",        // Corey's picture
      newAchievements: this.tracker ? [...this.tracker.newThisGame] : [],
    };
  }

  /** Leaving a game part way through (new game, closing the page). */
  abandon() {
    const e = this.engine;
    if (!this.recorded && this.inProgress) {
      this.stats.record(e.n, e.difficulty, e.tally, "abandoned", null, presetOpponents(e));
    }
    this.recorded = true;
  }
}
