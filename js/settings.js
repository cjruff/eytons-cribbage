// Settings: defaults, validation and computer names (ported from cribbage.py).
// Code: (c) Corey J Ruff
import { DIFFICULTIES } from "./ai.js";

export const BOARD_STYLES = ["29 Board", "Traditional", "Cribbagemaster", "Traditional Loop"];
export const BG_PRESETS = {
  "Green (default)": "#1e6b34", "Dark Green": "#0f4a26", "Blue": "#1d4e89",
  "Burgundy": "#6b1e2e", "Charcoal": "#2f3437",
};
export const SPEEDS = { Fast: 350, Normal: 750, Slow: 1300 };
export const CARD_BACKS = ["Eyton", "Classic blue"];
export const BACK_PRESETS = {
  "Dark Gray": "#3a3d42", "Charcoal": "#26282c", "Navy (default)": "#1b2a4a",
  "Forest": "#1f3b2a", "Wine": "#5a0f18",
};
export const PEG_PALETTE = {
  Red: "#d62828", Blue: "#2563eb", Gold: "#f2c40f", Green: "#16a34a",
  Purple: "#8b3fd1", Orange: "#f97316", White: "#f5f5f5", Black: "#262626",
};
export const DEFAULT_PEG_COLORS = ["Red", "Blue", "Gold"];
export const DEFAULT_SETTINGS = {
  players: 2,
  difficulty: "Medium",
  levels: ["Medium", "Medium"],        // skill of computer 1 and computer 2
  colors: ["Red", "Blue", "Gold"],     // peg colour of you, computer 1, computer 2
  board: "29 Board",
  background: "#1e6b34",
  speed: "Normal",
  name: "You",
  manual_count: false,                 // count your own hand before it is revealed
  cpu_names: ["", ""],                 // blank = use the computer's peg colour as its name
  card_back: "Eyton",
  card_back_color: "#1b2a4a",          // Navy
};

const isList = (v, n) => Array.isArray(v) && v.length === n;

/** Fill in defaults and repair anything invalid (same rules as load_settings in Python). */
export function normalizeSettings(raw) {
  const s = { ...structuredClone(DEFAULT_SETTINGS), ...(raw && typeof raw === "object" ? raw : {}) };
  if (s.players !== 2 && s.players !== 3) s.players = 2;
  if (!DIFFICULTIES.includes(s.difficulty)) s.difficulty = "Medium";
  if (s.board === "Rectangular") s.board = "Cribbagemaster";      // renamed
  if (!BOARD_STYLES.includes(s.board)) s.board = "29 Board";
  if (!(s.speed in SPEEDS)) s.speed = "Normal";
  if (!(isList(s.levels, 2) && s.levels.every((x) => DIFFICULTIES.includes(x)))) s.levels = [s.difficulty, s.difficulty];
  if (!CARD_BACKS.includes(s.card_back)) s.card_back = "Eyton";
  const cbc = s.card_back_color;
  if (!(typeof cbc === "string" && cbc.length === 7 && cbc.startsWith("#"))) s.card_back_color = "#1b2a4a";
  if (!(isList(s.cpu_names, 2) && s.cpu_names.every((x) => typeof x === "string"))) s.cpu_names = ["", ""];
  const cl = s.colors;
  if (!(isList(cl, 3) && cl.every((x) => x in PEG_PALETTE) && new Set(cl).size === 3)) s.colors = [...DEFAULT_PEG_COLORS];
  return s;
}

/** "Grandma 2" -> "grandma" */
export const baseName = (name) => (name || "").trim().replace(/\s+\d+$/, "").toLowerCase();

export const PRESET_OPPONENTS = ["Grandma", "Grandpa", "Larry", "Sue", "Corey", "Alex", "Jack", "Lori"];
export const FORCED_LEVEL = { corey: "Expert" };      // opponents who only play at one skill level

/** Skill a named opponent always plays at (null = any). */
export const forcedLevel = (name) => FORCED_LEVEL[baseName(name)] || null;

export const computerLevels = (s, names) => names.map((nm, i) => forcedLevel(nm) || s.levels[i]);

/** Computer names from settings; a blank name becomes its peg colour (e.g. "Blue"). */
export function computerNames(s) {
  const used = new Set([(s.name || "You").toLowerCase()]);
  const out = [];
  for (let i = 0; i < (s.players || 2) - 1; i++) {
    const typed = ((s.cpu_names || ["", ""])[i] || "").trim().slice(0, 16);
    let name = typed || s.colors[i + 1];
    const base = name;
    for (let k = 2; used.has(name.toLowerCase()); k++) name = `${base} ${k}`;   // keep every name unique
    used.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Preset family opponents in a game (lower-case base names), e.g. ["grandpa"]. */
export function presetOpponents(engine) {
  const presets = new Set(PRESET_OPPONENTS.map((p) => p.toLowerCase()));
  return engine.players.filter((p) => !p.human).map((p) => baseName(p.name)).filter((b) => presets.has(b));
}

/** Local date as YYYY-MM-DD (what the Python version writes). */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
