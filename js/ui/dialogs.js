// The game's windows (ported from cribbage.py / achievements.py):
// New Game, Settings, Statistics, Achievements, Players & Backups, How to Play, About.
// Code: (c) Corey J Ruff
import { DIFFICULTIES } from "../ai.js";
import { BOARD_STYLES, SPEEDS, CARD_BACKS, BACK_PRESETS, PEG_PALETTE, PRESET_OPPONENTS, FAMILY_OPPONENTS, PET_OPPONENTS, forcedLevel, isPreset, baseName } from "../settings.js";
import { STAT_ROWS } from "../stats.js";
import { ACHIEVEMENTS, CATEGORIES, TIER_NAMES, MEDAL_COLORS, MEDAL_DARK, medalImage } from "../achievements.js";
import { openWindow, confirmBox, messageBox, h, esc, pickColour } from "./windows.js";

export const APP_TITLE = "Eyton's Cribbage";
export const BUG_EMAIL = "me@coreyruff.com";

const radios = (name, options, value, onChange = null) => h("div.radios", {}, ...options.map(([val, label]) =>
  h("label", {}, h("input", { type: "radio", name, value: String(val), checked: String(val) === String(value),
    on: onChange ? { change: () => onChange(val) } : {} }), " ", label)));
const radioValue = (root, name) => root.querySelector(`input[name="${name}"]:checked`)?.value;
const group = (title, ...kids) => h("fieldset", {}, h("legend", {}, title), ...kids);
const select = (options, value, props = {}) => h("select", props, ...options.map((o) => h("option", { value: o, selected: o === value }, o)));

/**
 * A text box with a dropdown that always lists every choice (like Python's Combobox):
 * pick a name, or type any other.  blankLabel = the first choice, which clears the box.
 * A null in choices draws a divider line.
 */
function combo(input, choices, blankLabel) {
  const btn = h("button.combo-btn", { type: "button", tabIndex: -1, "aria-label": "Show choices" }, "\u25be");
  const wrap = h("span.combo", {}, input, btn);
  let list = null;
  const close = () => { if (list) { list.remove(); list = null; document.removeEventListener("pointerdown", outside, true); } };
  const outside = (ev) => { if (list && !list.contains(ev.target) && !wrap.contains(ev.target)) close(); };
  const choose = (v) => { input.value = v; close(); input.dispatchEvent(new Event("change", { bubbles: true })); input.focus(); input.select(); };
  const open = () => {
    if (list || input.disabled) { close(); return; }
    list = h("div.combo-list", {}, h("button.combo-item.dim", { type: "button", on: { click: () => choose("") } }, blankLabel),
      ...choices.map((c) => c == null ? h("div.combo-sep") :
        h("button.combo-item" + (c.toLowerCase() === input.value.trim().toLowerCase() ? ".on" : ""), { type: "button", on: { click: () => choose(c) } }, c)));
    const r = wrap.getBoundingClientRect();
    Object.assign(list.style, { left: r.left + "px", top: r.bottom + 2 + "px", minWidth: r.width + "px" });
    document.body.append(list);
    const below = window.innerHeight - r.bottom - 8;                 // flip up if there's no room below
    if (list.offsetHeight > below && r.top > below) list.style.top = Math.max(4, r.top - list.offsetHeight - 2) + "px";
    document.addEventListener("pointerdown", outside, true);
  };
  btn.addEventListener("click", open);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || (ev.altKey && ev.key === "ArrowDown")) { ev.preventDefault(); if (!list) open(); list?.querySelector(".combo-item")?.focus(); }
    else if (ev.key === "Escape" && list) { ev.stopPropagation(); close(); }
  });
  wrap.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && list) { ev.stopPropagation(); close(); input.focus(); } }, true);
  new MutationObserver(() => { btn.disabled = input.disabled; if (input.disabled) close(); }).observe(input, { attributes: true, attributeFilter: ["disabled"] });
  input.addEventListener("input", close);
  wrap.closeList = close;
  return wrap;
}

/**
 * Square picture button for a player row.  who() gives the current name (null = you).
 * Family and pets show their built-in portrait (locked); anyone else can have a photo
 * from the camera, photo library or a file; the little x removes it.
 */
function photoButton(app, who) {
  const img = h("img", { alt: "" });
  const cam = h("span.cam", {}, "\u{1F4F7}");
  const btn = h("button.photo-btn", { type: "button" }, img, cam);
  const del = h("button.photo-del", { type: "button", title: "Remove photo" }, "\u00d7");
  const wrap = h("span.photo-wrap", {}, btn, del);
  const refresh = () => {
    const name = who();
    let src = null, locked = false, own = false;
    if (name === null) { src = app.store.photo(app.pid); own = !!src; }
    else if (!name.trim()) locked = true;
    else if (isPreset(name)) { src = `assets/portraits/${encodeURIComponent(baseName(name))}.webp`; locked = true; }
    else { src = app.store.opponentPhoto(baseName(name)); own = !!src; }
    img.style.display = src ? "" : "none";
    if (src) img.src = src;
    cam.style.display = src ? "none" : "";
    btn.disabled = locked;
    btn.title = locked ? (name && name.trim() ? `${name.trim()} has a built-in picture` : "Type a name to add a photo")
      : own ? "Change photo" : "Add a photo (camera, photo library or file)";
    del.style.display = own ? "" : "none";
  };
  btn.addEventListener("click", async () => { if (await app.addPhoto(who())) refresh(); });
  del.addEventListener("click", () => { app.removePhoto(who()); refresh(); });
  wrap.refresh = refresh;
  refresh();
  return wrap;
}

/** Save a JSON file to the device's downloads. */
function downloadJson(obj, fname) {
  const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })), download: fname });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const today = () => new Date().toISOString().slice(0, 10);
const fileName = (app, what) => `EytonsCribbage-${app.playerName().replace(/[^\w-]+/g, "_")}-${what}-${today()}.json`;
export const exportStats = (app) => downloadJson(app.store.raw(app.pid).stats || {}, fileName(app, "stats"));
export const exportAchievements = (app) => downloadJson(app.store.raw(app.pid).achievements || { metrics: {}, unlocked: {}, state: {} }, fileName(app, "achievements"));
/** An achievement name with its *italic* words as <i>. */
const richName = (name) => name.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => /^\*.+\*$/.test(t) ? h("i", {}, t.slice(1, -1)) : t);

// ------------------------------------------------------------- New Game
export const FAMILY_LABEL = "Rouech / Ruff Family";
export const PETS_LABEL = "Furry Friends";
const NEW_OPP = "__new__";

/** Round picture for the setup screen: your photo / an opponent's photo or portrait, or a letter. */
function avatar(app, name, me = false) {
  let src = null;
  if (me) src = app.store.photo(app.pid) || (isPreset(name) ? `assets/portraits/${encodeURIComponent(baseName(name))}.webp` : null);
  else if (isPreset(name)) src = `assets/portraits/${encodeURIComponent(baseName(name))}.webp`;
  else src = app.store.opponentPhoto(baseName(name));
  return src ? h("img", { src, alt: "" }) : h("span.letter", {}, (name || "?").trim().charAt(0).toUpperCase() || "?");
}

/** Small window: type a new opponent's name, optionally add a photo.  Resolves to the name or null. */
function newOpponentWindow(app) {
  return new Promise((res) => {
    let result = null;
    const err = h("p.msg", { style: { color: "#a01818" } });
    const nameIn = h("input", { type: "text", maxlength: 16, placeholder: "Their name", autofocus: true });
    let photo = null;
    const pic = h("button.photo-btn", { type: "button", title: "Add a photo (camera, photo library or file)" }, h("span.cam", {}, "\u{1F4F7}"));
    pic.addEventListener("click", async () => {
      const { pickPhoto } = await import("../photo.js");
      const url = await pickPhoto();
      if (url) { photo = url; pic.replaceChildren(h("img", { src: url, alt: "" })); }
    });
    const add = () => {
      const nm = nameIn.value.trim().slice(0, 16);
      if (!nm) { err.textContent = "Please type a name."; return false; }
      const preset = PRESET_OPPONENTS.find((o) => o.toLowerCase() === nm.toLowerCase());
      if (preset) { result = preset; return; }                    // already one of ours: just pick them
      const name = app.store.addOpponent(nm);
      if (photo && !app.store.setOpponentPhoto(baseName(name), photo)) err.textContent = "There isn't room to save that photo.";
      result = name;
    };
    openWindow({ title: "New opponent", width: 400, cls: "on-setup",
      body: [h("div.row", {}, pic, nameIn), h("p.note", {}, "The photo is optional; tap the box to take one or pick one from your photos or files. Without one they get a silhouette."), err],
      buttons: [["Cancel", null], ["Add", add, true]], onClose: () => res(result) });
  });
}

/** Game setup (looks like Moe's Dominoes' start screen): players, board, opponents, skill, pegs. */
export function newGameWindow(app, { startup = false } = {}) {
  const s = app.settings;
  const palette = Object.keys(PEG_PALETTE);
  let players = s.players;
  const colors = [...s.colors];
  // opponents: saved choices; a blank (old "peg colour" name) becomes the next free family member
  const opps = [0, 1].map((i) => (s.cpu_names[i] || "").trim());
  opps.forEach((nm, i) => {
    if (nm && !isPreset(nm)) app.store.addOpponent(nm);
    if (!nm) opps[i] = ["Grandpa", "Grandma", ...FAMILY_OPPONENTS].find((f) => !opps.includes(f));
  });
  const levels = [...s.levels];

  const seg = (values, value, onPick) => {
    const el = h("div.seg", {}, ...values.map(([v, label]) => h("button" + (String(v) === String(value) ? ".on" : ""), { type: "button",
      on: { click: (ev) => { el.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === ev.currentTarget)); onPick(v); } } }, label)));
    return el;
  };
  const field = (label, ...kids) => h("div.field", {}, h("label.flabel", {}, label), ...kids);
  const peg = (i) => {
    const b = h("button.peg", { type: "button" });
    const paint = () => { b.style.background = PEG_PALETTE[colors[i]]; b.title = `${colors[i]} pegs (tap to change)`; };
    b.addEventListener("click", () => {
      const used = colors.slice(0, players).filter((_, k) => k !== i);
      let k = palette.indexOf(colors[i]);
      do k = (k + 1) % palette.length; while (used.includes(palette[k]));
      colors[i] = palette[k]; paint();
    });
    paint();
    return b;
  };

  // your row
  const myAv = h("button.av", { type: "button", title: "Your photo: tap to take one or pick one" });
  const paintMe = () => myAv.replaceChildren(avatar(app, app.playerName(), true), h("span.cam", {}, "\u{1F4F7}"));
  myAv.addEventListener("click", async () => {
    if (app.store.photo(app.pid) && await confirmBox("Your photo", "Change your photo, or remove it?", "Change", "Remove") === false) app.removePhoto(null);
    else await app.addPhoto(null);
    paintMe();
  });
  paintMe();
  const meRow = h("div.prow", {}, myAv, h("div.me-name", {}, app.playerName()),
    h("button.small", { type: "button", on: { click: () => { win.close(); app.switchPlayer(); } } }, "Switch"), peg(0));

  // computer rows
  const cpuBox = h("div.cpus");
  const renderCpus = () => {
    cpuBox.replaceChildren();
    for (let i = 0; i < players - 1; i++) {
      const taken = opps.filter((_, k) => k !== i && k < players - 1).map((x) => x.toLowerCase());
      const opt = (nm) => h("option", { value: nm, selected: nm === opps[i], disabled: taken.includes(nm.toLowerCase()) }, nm);
      const custom = app.store.opponents();
      const who = h("select.opp-pick", { "aria-label": `Computer player ${i + 1}` },
        h("option", { value: NEW_OPP }, "+ Create New Opponent"),
        ...custom.map(opt),
        h("optgroup", { label: `── ${FAMILY_LABEL} ──` }, ...FAMILY_OPPONENTS.map(opt)),
        h("optgroup", { label: `── ${PETS_LABEL} ──` }, ...PET_OPPONENTS.map(opt)));
      who.addEventListener("change", async () => {
        if (who.value === NEW_OPP) {
          const nm = await newOpponentWindow(app);
          if (nm && !opps.some((o, k) => k !== i && o.toLowerCase() === nm.toLowerCase())) opps[i] = nm;
        } else opps[i] = who.value;
        renderCpus();
      });
      const lock = forcedLevel(opps[i]);                         // Corey: Expert only
      if (lock) levels[i] = lock;
      const skill = h("select.skill", { "aria-label": "Skill", on: { change: (ev) => { levels[i] = ev.target.value; } } },
        ...DIFFICULTIES.map((d) => h("option", { value: d, selected: d === levels[i], disabled: !!lock && d !== lock }, d)));
      const av = h("button.av", { type: "button" }, avatar(app, opps[i]));
      if (isPreset(opps[i])) { av.disabled = true; av.title = opps[i]; }
      else {
        av.append(h("span.cam", {}, "\u{1F4F7}"));
        av.title = `Photo for ${opps[i]}: tap to change`;
        av.addEventListener("click", async () => {
          if (app.store.opponentPhoto(baseName(opps[i])) && await confirmBox(`${opps[i]}'s photo`, "Change the photo, or remove it?", "Change", "Remove") === false) app.removePhoto(opps[i]);
          else await app.addPhoto(opps[i]);
          renderCpus();
        });
      }
      cpuBox.append(h("div.prow", {}, av, who, skill, peg(i + 1)));
    }
  };
  renderCpus();

  const board = h("select", { "aria-label": "Board" }, ...BOARD_STYLES.map((b) => h("option", { value: b, selected: b === s.board }, b)));
  const deal = () => {
    const used = colors.slice(0, players);
    if (new Set(used).size < used.length) { messageBox("Peg colours", "Please give each player a different peg colour."); return; }
    const spare = palette.filter((c) => !used.includes(c));
    const lv = opps.map((nm, i) => forcedLevel(nm) || levels[i]);
    const next = { ...s, players, levels: lv, colors: [...used, ...spare.slice(0, 3 - players)], board: board.value, cpu_names: [...opps], difficulty: lv[0] };
    win.close();
    app.startGame(next);
  };
  const more = (label, fn) => h("button.more", { type: "button", on: { click: fn } }, label);
  const body = h("div.setup-card", {},
    h("img.hero.ga-hero", { src: "assets/eyton-setup.webp", alt: "Eyton, a cat holding cards at a cribbage board" }),
    h("h1.ga-title", {}, "Eyton's ", h("span", {}, "Cribbage")),
    h("p.sub.ga-sub", {}, "2 or 3 players · first to 121"),
    h("div.two.ga-two", {},
      field("Players", seg([[2, "2"], [3, "3"]], players, (v) => { players = +v; renderCpus(); })),
      field("Board", board)),
    h("div.ga-you", {}, field("You", meRow)),
    h("div.ga-cpus", {}, field("Computer players", cpuBox)),
    h("p.hint.ga-hint", {}, "Skill only changes how well a computer plays, never the cards. Tap a peg to change its colour."),
    h("button.deal.ga-deal", { type: "button", on: { click: deal } }, "Deal"),
    h("div.mores.ga-mores", {},
      more("Achievements", () => achievementsWindow(app, [])), more("Stats", () => statsWindow(app)),
      more("Settings", () => settingsWindow(app)), more("Players", () => playersWindow(app)),
      more("How to Play", () => helpWindow()), more("About", () => aboutWindow())),
    h("p.credit.ga-credit", {}, "Code: © Corey J Ruff"));
  const win = openWindow({ title: "New Game", width: "min(560px, 96vw)", cls: "setup", backCls: "setup-back", body, buttons: [],
    onClose: () => { if (startup) app.table.requestRedraw(); } });
  return win;
}

// ------------------------------------------------------------- Game over
/**
 * The results card after a game (green, like the start screen).  Medals earned this game are
 * shown as pictures: hover (or tap) one to see what it was for.
 */
export function resultsWindow(app) {
  const e = app.table.engine, res = e.result(), w = e.players[e.winner];
  let sub = "";
  if (res.won && res.skunkGiven) sub = res.skunkGiven === "double" ? "Double skunk!" : "Skunk!";
  else if (!res.won && res.skunked) sub = res.skunked === "double" ? "You were double skunked" : "You were skunked";
  const scores = h("div.res-scores", {}, ...[...e.players].sort((a, b) => b.score - a.score).map((p) =>
    h("div.res-row" + (p === w ? ".top" : ""), {}, h("span.dot", { style: { background: p.color } }), h("span.nm", {}, p.name), h("span.sc", {}, String(p.score)))));
  const b = app.stats.aggregate(e.n, e.difficulty);
  const mixed = new Set(e.levels).size > 1;
  const record = h("p.res-record", {}, `Your lifetime record vs ${mixed ? e.levels.join(" & ") : e.difficulty} (${e.n} players): `, h("b", {}, `${b.wins} - ${b.losses}`),
    mixed ? ` (filed under ${e.difficulty})` : "");
  const nw = app.tracker ? app.tracker.newThisGame : [];
  const tiles = nw.map(([a, t]) => {
    const tn = a.tierName(t);
    const target = a.tiers[t];
    const tile = h("button.medal-tile", { type: "button", "aria-label": `${a.name.replace(/\*/g, "")}, ${tn}` },
      h("img", { src: medalImage(tn), alt: "" }),
      h("span.mt-name", {}, ...richName(a.name)), h("span.mt-tier", {}, tn),
      h("span.tip", {}, h("b", {}, ...richName(a.name), ` \u00b7 ${tn}`), h("span", {}, a.desc),
        a.tiers.length > 1 ? h("small", {}, `This level: ${target.toLocaleString("en-US")}`) : null));
    const tip = tile.querySelector(".tip");
    const showTip = (on) => {
      medals.querySelectorAll(".tip").forEach((x) => { x.style.display = "none"; });
      if (!on) return;
      tip.style.display = "block";
      const r = tile.getBoundingClientRect(), th = tip.offsetHeight, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))}px`;
      tip.style.top = `${r.top - th - 8 >= 8 ? r.top - th - 8 : Math.min(innerHeight - th - 8, r.bottom + 8)}px`;
    };
    tile.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse") showTip(true); });
    tile.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") showTip(false); });
    tile.addEventListener("click", () => showTip(tip.style.display !== "block"));
    return tile;
  });
  const medals = h("div.res-medals", {}, ...tiles);
  const go = (name) => () => { win.close(); app.gameOverButton(name); };
  const body = h("div.res-card", {},
    h("img.hero", { src: "assets/eyton-setup.webp", alt: "" }),
    h("h1" + (res.won ? ".won" : ""), {}, res.won ? "You win!" : `${w.name} wins`),
    sub ? h("p.res-sub", {}, sub) : null,
    h("div.res-cols", {},
      h("div.res-left", {}, scores, record),
      h("div.res-right", {}, h("h3", {}, nw.length ? `New medals this game: ${nw.length}` : "No new medals this game"),
        nw.length ? h("p.res-hint", {}, "Hover over a medal (or tap it) to see what it was for.") : null, medals)),
    h("div.res-buttons", {},
      h("button.deal", { type: "button", on: { click: go("new") } }, "New Game"),
      h("button.more", { type: "button", on: { click: () => achievementsWindow(app, nw.map(([a]) => a.id)) } }, "Achievements"),
      h("button.more", { type: "button", on: { click: () => statsWindow(app) } }, "Statistics"),
      h("button.more", { type: "button", on: { click: () => win.close() } }, "See the table")));
  const win = openWindow({ title: "Results", width: "min(760px, 96vw)", cls: "setup.results", backCls: "results-back", body, buttons: [],
    onClose: () => { app.resultsWin = null; app.table.requestRedraw(); } });
  return win;
}

// ------------------------------------------------------------- Settings
export function settingsWindow(app) {
  const s = app.settings;
  let backCol = s.card_back_color;
  const sw = h("span.swatch", { style: { background: backCol } });
  const body = [
    group("Board", radios("st-board", BOARD_STYLES.map((b) => [b, b]), s.board)),
    group("Computer speed", radios("st-speed", Object.keys(SPEEDS).map((v) => [v, v]), s.speed)),
    group("Card back", radios("st-back", CARD_BACKS.map((v) => [v, v]), s.card_back),
      h("div.row", {}, "Eyton colour: ", sw, " ",
        h("button", { on: { click: async () => { const c = await pickColour(backCol); if (c) { backCol = c; sw.style.background = c; } } } }, "Choose..."))),
    group("Counting", h("label", {}, h("input#st-manual", { type: "checkbox", checked: !!s.manual_count }), " Count my own hands before they're revealed (practice)")),
    h("p.note", {}, "Players, computer skill and peg colours are chosen in Game > New Game.", h("br"), "Background colour: use the Background menu."),
  ];
  const save = () => {
    const el = win.el;
    app.updateSettings({ board: radioValue(el, "st-board"), speed: radioValue(el, "st-speed"),
      card_back: radioValue(el, "st-back"), card_back_color: backCol, manual_count: el.querySelector("#st-manual").checked });
  };
  const win = openWindow({ title: "Settings", width: 520, body, buttons: [["Cancel", null], ["Save", save, true]] });
}

// ------------------------------------------------------------- Statistics
export function statsWindow(app) {
  const stats = app.stats;
  let mode = String(app.settings.players);
  const tableEl = h("table.stats");
  const best = h("p.best");
  const fill = () => {
    const pl = mode === "all" ? null : +mode;
    // family columns always; a pet's column appears once you've played them
    const opps = [...FAMILY_OPPONENTS, ...PET_OPPONENTS.filter((o) => stats.aggregate(pl, null, o).games_played > 0)];
    const cols = [...DIFFICULTIES, "All levels", ...opps];
    const buckets = [...DIFFICULTIES.map((d) => stats.aggregate(pl, d)), stats.aggregate(pl, null), ...opps.map((o) => stats.aggregate(pl, null, o))];
    const allb = buckets[DIFFICULTIES.length];
    tableEl.innerHTML = "";
    tableEl.append(h("tr", {}, h("th", {}, "Statistic"), ...cols.map((c) => h("th" + (PRESET_OPPONENTS.includes(c) ? ".opp" : c === "All levels" ? ".all" : ""), {}, PRESET_OPPONENTS.includes(c) ? "vs " + c : c))));
    for (const [label, fn] of STAT_ROWS) tableEl.append(h("tr", {}, h("td", {}, label), ...buckets.map((b, i) => h("td" + (i === DIFFICULTIES.length ? ".all" : i > DIFFICULTIES.length ? ".opp" : ""), {}, String(fn(b))))));
    best.textContent = allb.highest_hand_cards ? `Best hand ever: ${allb.highest_hand_cards}  (${allb.highest_hand})` : "";
  };
  const body = [
    h("div.row", {}, "Show: ", radios("ss-mode", [["2", "2 players"], ["3", "3 players"], ["all", "Combined"]], mode, (v) => { mode = v; fill(); })),
    h("div.scroll-x", {}, tableEl), best,
  ];
  fill();
  const reset = async () => {
    if (await confirmBox("Reset statistics", "Erase ALL lifetime statistics?\nThis cannot be undone.")) { stats.reset(); fill(); app.changed(); }
    return false;
  };
  openWindow({ title: `Lifetime Statistics - ${app.playerName()}`, width: "min(1180px, 96vw)", cls: "tall.green", body,
    buttons: [["Reset stats...", reset, false, true], ["Export stats", () => { exportStats(app); return false; }], ["Close", null, true]] });
}

// ------------------------------------------------------------- Achievements
export function achievementsWindow(app, highlight = []) {
  const tracker = app.tracker;
  const hl = new Set(highlight);
  const summary = h("span.summary");
  const show = select(["All", "Earned", "In progress", "Not started", ...CATEGORIES], "All");
  const list = h("div.ach-list");
  // your medal pictures; not earned yet = greyed out
  const medal = (r, tn, earned) => h("img.medal-img" + (earned ? "" : ".locked"), { src: medalImage(tn), alt: tn, title: tn,
    width: 2 * r, height: 2 * r, style: { width: 2 * r + "px", height: 2 * r + "px" } });
  const draw = () => {
    const { got, total, medals } = tracker.summary();
    summary.textContent = `${got} of ${total} medals   |   ` + TIER_NAMES.map((n) => `${n}: ${medals[n]}`).join("   ");
    list.innerHTML = "";
    const mode = show.value;
    for (const cat of CATEGORIES) {
      if (CATEGORIES.includes(mode) && mode !== cat) continue;
      const rows = ACHIEVEMENTS.filter((a) => {
        if (a.category !== cat) return false;
        const have = tracker.tiersReached(a), v = tracker.value(a);
        if (mode === "Earned" && !have) return false;
        if (mode === "In progress" && (have >= a.tiers.length || v === 0)) return false;
        if (mode === "Not started" && v > 0) return false;
        return true;
      });
      if (!rows.length) continue;
      const inCat = ACHIEVEMENTS.filter((a) => a.category === cat);
      list.append(h("div.ach-cat", {}, h("span", {}, cat), h("span", {}, `${inCat.reduce((t, a) => t + tracker.tiersReached(a), 0)} / ${inCat.reduce((t, a) => t + a.tiers.length, 0)}`)));
      for (const a of rows) {
        const have = tracker.tiersReached(a), v = tracker.value(a), isNew = hl.has(a.id);
        const bestTier = have ? a.tierName(have - 1) : a.tierName(0);
        let frac = 1;
        if (have < a.tiers.length) {
          const lo = have ? a.tiers[have - 1] : 0, hi = a.tiers[have];
          frac = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
        }
        const dates = (tracker.data.unlocked[a.id] || {}).dates || [];
        list.append(h("div.ach-row" + (isNew ? ".new" : have ? ".got" : ""), {},
          medal(20, bestTier, !!have),
          h("div.ach-text", {}, h("div.ach-name", {}, ...richName(a.name), isNew ? "   NEW!" : ""), h("div.ach-desc", {}, a.desc + (a.note ? `   (${a.note})` : ""))),
          h("div.ach-pips", {}, ...a.tiers.map((th, i) => h("span.pip", {}, medal(10, a.tierName(i), i < have), h("small", {}, a.tiers.length > 1 || th > 1 ? th.toLocaleString("en-US") : "")))),
          h("div.ach-prog", {}, h("div", {}, tracker.progressText(a)),
            h("div.bar", {}, h("div", { style: { width: `${frac * 100}%`, background: MEDAL_COLORS[a.tierName(Math.min(have, a.tiers.length - 1))] } })),
            h("div.date", {}, have && dates.length ? `Earned ${dates[dates.length - 1]}` : ""))));
      }
    }
  };
  show.addEventListener("change", draw);
  draw();
  const reset = async () => {
    if (await confirmBox("Reset achievements", "Erase ALL achievement progress?\nThis cannot be undone.")) { tracker.reset(); draw(); }
    return false;
  };
  openWindow({ title: `Achievements - ${app.playerName()}`, width: "min(900px, 96vw)", cls: "tall.green",
    body: [h("div.row", {}, summary, h("span", { style: { marginLeft: "auto" } }, "Show: "), show), list],
    buttons: [["Reset achievements...", reset, false, true], ["Export achievements", () => { exportAchievements(app); return false; }], ["Close", null, true]] });
}

// ------------------------------------------------------------- Players & backups
export function playersWindow(app) {
  const store = app.store;
  const msg = h("p.msg");
  const say = (t, bad = false) => { msg.textContent = t; msg.style.color = bad ? "#a01818" : "#1e6b34"; };
  const nameIn = h("input", { type: "text", maxlength: 20, value: app.playerName() });
  const download = (obj, fname) => {
    const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })), download: fname });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const safeName = () => app.playerName().replace(/[^\w-]+/g, "_");
  const fileIn = (multi, fn) => {
    const inp = h("input", { type: "file", accept: ".json,application/json", multiple: multi, style: { display: "none" } });
    inp.addEventListener("change", async () => { const files = [...inp.files]; inp.remove(); if (files.length) await fn(files); });
    document.body.append(inp); inp.click();
  };
  const myPic = photoButton(app, () => null);
  const body = [
    group("This player",
      h("div.row", {}, myPic, h("span.note", {}, "Your picture at the table: tap the box to take a photo or pick one from your photos or files.")),
      h("div.row", {}, nameIn, h("button", { on: { click: () => {
        try { store.rename(app.pid, nameIn.value); app.changed(); say("Renamed."); } catch (err) { say(err.message, true); }
      } } }, "Rename"),
      h("button.danger", { style: { marginLeft: "auto" }, on: { click: async () => {
        if (await confirmBox("Delete player", `Delete ${app.playerName()} and all of their stats and achievements?\nThis can't be undone.`)) {
          win.close(); app.deletePlayer();
        }
      } } }, "Delete player..."))),
    opponentsGroup(app),
    group("Backups (moving to another device or browser)",
      h("div.row", {}, h("button", { on: { click: () => download(store.exportBackup([app.pid]), `EytonsCribbage-${app.playerName().replace(/[^\w-]+/g, "_")}-${stamp()}.json`) } }, "Save this player to a file"),
        h("button", { on: { click: () => download(store.exportBackup(), `EytonsCribbage-everyone-${stamp()}.json`) } }, "Save everyone to a file"),
        h("button", { on: { click: () => fileIn(false, async ([f]) => {
          try {
            const rep = store.importBackup(JSON.parse(await f.text()));
            say("Loaded: " + rep.map((r) => `${r.name} (${r.action})`).join(", "));
            app.reloadPlayer();
          } catch (err) { say(err.message.startsWith("That file") ? err.message : "That file couldn't be read as a backup.", true); }
        }) } }, "Load a backup...")),
      h("p.note", {}, "Stats are kept in this browser. Clearing \"cookies and site data\" erases them, so save a backup now and then. Loading a backup replaces players with the same name and adds new ones.")),
    group("Stats and achievements files",
      h("div.row", {}, h("button", { on: { click: () => exportStats(app) } }, "Export stats"),
        h("button", { on: { click: () => exportAchievements(app) } }, "Export achievements")),
      h("p.note", {}, "Import takes these files, or the ones from the Windows (Python) version, which use the same layout. On that PC they're in ",
        h("b", {}, "%USERPROFILE%\\.pycribbage"), " (type that into the file picker's address bar): ",
        h("b", {}, "stats.json"), ", ", h("b", {}, "achievements.json"), " and ", h("b", {}, "settings.json"), ". Pick any of them (Ctrl-click for several); each one replaces that part of this player's data."),
      h("button", { on: { click: () => fileIn(true, async (files) => {
        if (!(await confirmBox("Import", `Replace ${app.playerName()}'s data with what's in ${files.length === 1 ? files[0].name : "these files"}?`))) return;
        try {
          const texts = {};
          for (const f of files) texts[f.name] = await f.text();
          const done = store.importPython(app.pid, texts);
          app.reloadPlayer();
          say(`Imported ${done.join(", ")} for ${app.playerName()}.`);
        } catch (err) { say(err.message, true); }
      }) } }, "Import stats / achievements files...")),
    msg,
  ];
  const win = openWindow({ title: "Players & Backups", width: 620, body, buttons: [["Close", null, true]] });
}

function opponentsGroup(app) {
  const box = h("div.opp-list");
  const fill = () => {
    const all = app.store.opponents();
    box.replaceChildren(...(all.length ? all.map((nm) => h("div.opp-item", {}, h("span.opp-av", {}, avatar(app, nm)), h("span", {}, nm),
      h("button", { on: { click: async () => {
        if (await confirmBox("Remove opponent", `Take ${nm} off the opponent list?  (Their games stay in your stats.)`)) { app.store.removeOpponent(nm); fill(); }
      } } }, "Remove"))) : [h("p.note", {}, "None yet. Pick \"+ Create New Opponent\" on the New Game screen to add one.")]));
  };
  fill();
  return group("Opponents you added", box);
}

/** How to put the game on a home screen / desktop (shown on the Who's playing window). */
function installHelp() {
  const ua = navigator.userAgent;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return h("p.note", {}, "You're using the installed version - nice. Your players, stats and achievements stay on this device; nothing is sent to the developer.");
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const how = [
    ["iPhone / iPad (Safari)", ios, "Tap the Share button (the square with an arrow; on newer iPhones it's inside the ••• menu), then Add to Home Screen, then Add."],
    ["Android (Chrome)", android, "Tap the ⋮ menu at the top right, then Add to Home screen (or Install app), then Install."],
    ["Windows / Mac computer", !ios && !android, "Chrome: click the install icon at the right end of the address bar (a screen with a down arrow), or ⋮ menu > Cast, save and share > Install page as app. Edge: ⋯ menu > Apps > Install this site as an app. Safari on a Mac: File > Add to Dock."],
  ];
  how.sort((a, b) => b[1] - a[1]);
  return h("details.install", { open: true },
    h("summary", {}, "For the best experience, add it to your home screen or desktop"),
    h("p.note", {}, "It then opens full screen in its own window, like an app, and works without internet. This isn't an app-store install: it's a shortcut to this web page, so nothing extra is put on your device. Your players, stats and achievements are saved only on this device, and nothing is shared with the developer."),
    h("ul", {}, ...how.map(([who, here, txt]) => h("li" + (here ? ".here" : ""), {}, h("b", {}, who + (here ? " (this device)" : "") + ": "), txt))),
    h("p.note", {}, "Tip: clearing this site's \"cookies and site data\" erases stats. Players & Backups can save a copy."));
}

// ------------------------------------------------------------- Who's playing
export function whoWindow(app, { canClose = false } = {}) {
  const err = h("p.msg", { style: { color: "#a01818" } });
  const nameIn = h("input", { type: "text", maxlength: 20, placeholder: "New player's name", autofocus: !app.store.list().length });
  const list = h("div.who");
  for (const p of app.store.list()) {
    const g = app.store.stats(p.id).aggregate();
    list.append(h("button.who-btn" + (p.id === app.pid ? ".on" : ""), { on: { click: () => { win.close(); app.choosePlayer(p.id); } } },
      p.name, h("small", {}, `${g.wins} wins of ${g.games_played}`)));
  }
  const add = () => {
    try { const p = app.store.create(nameIn.value); win.close(); app.choosePlayer(p.id); }
    catch (e) { err.textContent = e.message; }
    return false;
  };
  nameIn.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); add(); } });
  const win = openWindow({ title: "Who's playing?", width: "min(560px, 96vw)", cls: canClose ? "who-win" : "who-win.locked", backCls: "green-back",
    body: [list.children.length ? list : h("p", {}, "Welcome! Type your name to make a player. Everyone who plays on this device gets their own stats and achievements."),
      h("div.row", {}, nameIn, h("button.primary", { on: { click: add } }, "Add player")), err, installHelp()],
    buttons: canClose ? [["Cancel", null]] : [] });
  if (!canClose) win.el.querySelector(".win-x").remove();
  return win;
}

// ------------------------------------------------------------- Help / About
export function aboutWindow() {
  const img = h("img.about", { src: "assets/about.webp", alt: "", on: { error: () => { if (img.src.endsWith(".webp")) img.src = "assets/about.png"; else img.remove(); } } });
  openWindow({ title: "About", width: 380, body: [
    h("div.center", {}, h("h2", {}, APP_TITLE), img,
      h("p", {}, "Code: © Corey J Ruff, 2026"),
      h("p", {}, "Find a bug? Please report it to ", h("a", { href: `mailto:${BUG_EMAIL}?subject=${encodeURIComponent("Eyton's Cribbage bug")}` }, BUG_EMAIL)),
      h("p.dim", {}, "HTML / JavaScript")),
  ] });
}

/** How to Play: the illustrated guide (how-to-play.pdf) in a new tab; it's kept for offline play too. */
export function helpWindow() {
  const a = h("a", { href: "how-to-play.pdf", target: "_blank", rel: "noopener" });
  document.body.append(a); a.click(); a.remove();
}

/** The old built-in rules window (kept in case the guide can't be opened). */
export function helpWindowText() {
  const sc = (pairs) => h("table.score", {}, ...pairs.map(([a, b, c, d]) => h("tr", {}, h("td", {}, a), h("td.pts", {}, b), h("td", {}, c || ""), h("td.pts", {}, d || ""))));
  const P = (t) => h("p", { html: t });
  openWindow({ title: "How to Play", width: "min(720px, 96vw)", cls: "tall help", body: [
    h("h3", {}, "Goal"), P("Be first to peg <b>121</b> points."),
    h("h3", {}, "New game (F2)"), P("Choose 2 or 3 players, a skill level for each computer, everyone's peg colour, and the board. With mixed skill levels, stats are filed under the strongest one."),
    P("Opponents can be the family, our furry friends (Eyton, Morgan, Nala, Rhys and Wally - they play, but they don't talk), or anyone you add with \"+ Create New Opponent\". Tap the round picture beside you or someone you added to take a photo or pick one from your photos or files. Family and pets keep their own pictures. Tap a peg to change its colour. Players &amp; Backups lists the opponents you added, so you can remove them."),
    h("h3", {}, "Cut for deal"), P("Click any card in the face-down spread, then each computer cuts. Low card deals (ace is low). A tie means everyone cuts again."),
    h("h3", {}, "The deal"), P("<b>2 players:</b> 6 cards each, discard 2 to the crib.<br><b>3 players:</b> 5 cards each, one card goes straight to the crib, each player discards 1.<br>The crib belongs to the dealer. The deal rotates every hand. Tap cards to choose them (or drag them up), then press the Send button."),
    h("h3", {}, "The starter"), P('After discards the deck is cut and a starter card turned up. If it is a Jack the dealer pegs 2 ("His Heels").'),
    h("h3", {}, "Pegging (the play)"), P("Starting left of the dealer, players take turns laying cards, keeping a running count that may not pass 31. <b>Double-click</b> a card to play it, <b>drag</b> it up onto the table, or click it and press Enter / Play Card. If you cannot play, press <b>Go</b>."),
    sc([["Count of 15", 2, "Pair", 2], ["Count of 31", 2, "Three of a kind", 6], ["Go / last card", 1, "Four of a kind", 12], ["Run of 3+ (any order, uninterrupted)", "1 per card"]]),
    P("After 31 or a Go the count starts again at 0."),
    h("h3", {}, "The show"), P('Hands are counted left of the dealer first, then the dealer\'s hand, then the crib, each together with the starter. Everything is counted automatically - press "Show Count" to see the itemised breakdown.'),
    sc([["Each combination totalling 15", 2, "Each pair", 2], ["Each run of 3 or more", "1 per card"], ["Flush: 4 in hand (5 with starter); the crib needs all 5", ""], ["His Nobs: Jack in hand of the starter's suit", 1]]),
    h("h3", {}, "Achievements"), P('94 achievements with Bronze / Silver / Gold / Platinum / Diamond medals. Unlocks pop up during play, are listed on the win/lose screen, and can be browsed any time from Game &gt; Achievements. Settings &gt; "Count my own hands" asks you to count your hand before it is revealed.'),
    h("h3", {}, "Skunks"), P("Lose with fewer than 91 points = skunk; fewer than 61 = double skunk. The board marks these lines with S and SS."),
    h("h3", {}, "Computer skill"),
    sc([["Easy", "makes beginner choices and often misses pegging chances"], ["Medium", "keeps the best-looking hand and takes points when it sees them"],
      ["Hard", "averages every possible starter and weighs the crib; avoids feeding you points"], ["Expert", "simulates hundreds of crib outcomes and looks ahead in the pegging"]]),
    P("Skill never changes the cards: the deck is shuffled by the browser's secure random generator and the computer only knows its own cards and what has been played face-up."),
    h("h3", {}, "Players and stats"), P("Everyone who plays on this device picks their name at the start (Game &gt; Switch Player to change). Stats and achievements are saved in this browser for each player. Use Game &gt; Players &amp; Backups to save a backup or move them to another device."),
  ] });
}

export { esc };
