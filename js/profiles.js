// Player profiles ("Who's playing?"), saving, backup files and import of the Python version's files.
// Everything is kept in the browser (localStorage).  Each profile has its own settings,
// stats and achievements, saved in the same layout as the Python files.
// Code: (c) Corey J Ruff
import { normalizeSettings } from "./settings.js";
import { StatsStore } from "./stats.js";
import { AchievementTracker, seedFromStats } from "./achievements.js";

export const APP_ID = "Eyton's Cribbage";
export const BACKUP_VERSION = 1;
const PREFIX = "eyton.";

/** Stand-in for localStorage (tests, or a browser with storage switched off). */
export class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

/** localStorage when it works (it can throw in private windows), otherwise memory. */
export function browserStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = PREFIX + "probe";
    s.setItem(probe, "1"); s.removeItem(probe);
    return { storage: s, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

const cleanName = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 20);

export class ProfileStore {
  constructor(storage) {
    this.s = storage;
    this.index = this._read("profiles") || { list: [], last: null, nextId: 1 };
  }

  _read(key) {
    try { const v = this.s.getItem(PREFIX + key); return v ? JSON.parse(v) : null; } catch { return null; }
  }
  _write(key, value) {
    try { this.s.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }      // storage full or blocked: the game keeps going
  }
  _saveIndex() { this._write("profiles", this.index); }

  // ----- the list of players -----
  list() { return this.index.list.map((p) => ({ ...p })); }
  get(id) { return this.index.list.find((p) => p.id === id) || null; }
  findByName(name) {
    const n = cleanName(name).toLowerCase();
    return this.index.list.find((p) => p.name.toLowerCase() === n) || null;
  }
  get lastId() { return this.get(this.index.last) ? this.index.last : null; }

  /** Make a new profile.  Throws an Error with a friendly message if the name is bad or taken. */
  create(name) {
    const nm = cleanName(name);
    if (!nm) throw new Error("Please type a name.");
    const dup = this.findByName(nm);
    if (dup) throw new Error(`There is already a player called ${dup.name}.`);
    const p = { id: `p${this.index.nextId++}`, name: nm, created: new Date().toISOString() };
    this.index.list.push(p);
    this._saveIndex();
    const s = normalizeSettings(null);
    s.name = nm;                                // the name shown at the table
    this._write(`${p.id}.settings`, s);
    return { ...p };
  }
  rename(id, name) {
    const p = this.get(id);
    const nm = cleanName(name);
    if (!p) throw new Error("No such player.");
    if (!nm) throw new Error("Please type a name.");
    const other = this.findByName(nm);
    if (other && other.id !== id) throw new Error(`There is already a player called ${other.name}.`);
    const s = this.settings(id);
    if (!s.name || s.name === p.name) { s.name = nm; this.saveSettings(id, s); }
    p.name = nm;
    this._saveIndex();
  }
  remove(id) {
    this.index.list = this.index.list.filter((p) => p.id !== id);
    if (this.index.last === id) this.index.last = null;
    for (const k of ["settings", "stats", "achievements"]) this.s.removeItem(`${PREFIX}${id}.${k}`);
    this._saveIndex();
  }
  select(id) { if (this.get(id)) { this.index.last = id; this._saveIndex(); } }

  // ----- one player's data -----
  settings(id) { return normalizeSettings(this._read(`${id}.settings`)); }
  saveSettings(id, s) { return this._write(`${id}.settings`, normalizeSettings(s)); }
  stats(id) { return new StatsStore(this._read(`${id}.stats`), (d) => this._write(`${id}.stats`, d)); }
  achievements(id, stats = null) {
    const saved = this._read(`${id}.achievements`);
    return new AchievementTracker(saved, {
      seed: saved ? null : seedFromStats(stats || this.stats(id)),
      onSave: (d) => this._write(`${id}.achievements`, d),
    });
  }
  raw(id) {
    return { settings: this._read(`${id}.settings`), stats: this._read(`${id}.stats`), achievements: this._read(`${id}.achievements`) };
  }
  resetStats(id) { this.s.removeItem(`${PREFIX}${id}.stats`); }
  resetAchievements(id) { this.s.removeItem(`${PREFIX}${id}.achievements`); }

  // ----- backup files -----
  /** Everything (or the listed profiles) as one backup object, ready for JSON.stringify. */
  exportBackup(ids = null) {
    const chosen = this.index.list.filter((p) => !ids || ids.includes(p.id));
    return {
      app: APP_ID, version: BACKUP_VERSION, exported: new Date().toISOString(),
      profiles: chosen.map((p) => ({ name: p.name, created: p.created, ...this.raw(p.id) })),
    };
  }

  /**
   * Load a backup.  A profile whose name already exists is replaced when replace=true,
   * otherwise it is added as "Name (2)".  Returns [{ name, action }].
   */
  importBackup(obj, { replace = true } = {}) {
    if (!obj || obj.app !== APP_ID || !Array.isArray(obj.profiles)) {
      throw new Error("That file isn't an Eyton's Cribbage backup.");
    }
    const report = [];
    for (const prof of obj.profiles) {
      let name = cleanName(prof.name) || "Player";
      let target = this.findByName(name);
      let action = "added";
      if (target && replace) action = "replaced";
      else if (target) {
        let k = 2;
        while (this.findByName(`${name} (${k})`)) k++;
        name = `${name} (${k})`;
        target = null;
      }
      const p = target || this.create(name);
      this._load(p.id, prof);
      report.push({ name, action });
    }
    return report;
  }

  _load(id, { settings = null, stats = null, achievements = null }) {
    const p = this.get(id);
    if (settings) this.saveSettings(id, { ...settings, name: settings.name || p.name });
    if (stats && typeof stats === "object") this._write(`${id}.stats`, stats); else this.resetStats(id);
    if (achievements && typeof achievements === "object") {
      this._write(`${id}.achievements`, { metrics: achievements.metrics || {}, unlocked: achievements.unlocked || {}, state: achievements.state || {} });
    } else this.resetAchievements(id);
  }

  /**
   * Bring in files from the Python version (~/.pycribbage): any of stats.json,
   * achievements.json, settings.json, given as { "stats.json": text, ... }.
   * Returns a list of what was imported.  Files are checked before anything is changed.
   */
  importPython(id, files) {
    const parsed = {};
    for (const [fname, text] of Object.entries(files)) {
      const kind = classifyPythonFile(fname, text);
      if (!kind) throw new Error(`${fname} doesn't look like an Eyton's Cribbage file.`);
      parsed[kind.kind] = kind.data;
    }
    const done = [];
    if (parsed.stats) { this._write(`${id}.stats`, parsed.stats); done.push("stats"); }
    if (parsed.achievements) {
      const a = parsed.achievements;
      this._write(`${id}.achievements`, { metrics: a.metrics || {}, unlocked: a.unlocked || {}, state: a.state || {} });
      done.push("achievements");
    } else if (parsed.stats) {
      this.resetAchievements(id);       // rebuilt from the imported stats next time it loads
    }
    if (parsed.settings) {
      const keepName = this.settings(id).name;
      this.saveSettings(id, { ...parsed.settings, name: keepName });
      done.push("settings");
    }
    return done;
  }
}

/** Work out what a Python file is from its content (names may have been changed). */
export function classifyPythonFile(fname, text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if ("metrics" in data || "unlocked" in data) return { kind: "achievements", data };
  const keys = Object.keys(data);
  if (keys.length && keys.every((k) => /^[23]p\|/.test(k))) return { kind: "stats", data };
  if (keys.length === 0 && /stats/i.test(fname)) return { kind: "stats", data };
  if ("players" in data || "board" in data || "colors" in data) return { kind: "settings", data };
  return null;
}
