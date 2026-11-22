// The game's windows (ported from cribbage.py / achievements.py):
// New Game, Settings, Statistics, Achievements, Players & Backups, How to Play, About.
// Code: (c) Corey J Ruff
import { DIFFICULTIES } from "../ai.js";
import { BOARD_STYLES, SPEEDS, CARD_BACKS, BACK_PRESETS, PEG_PALETTE, PRESET_OPPONENTS, forcedLevel } from "../settings.js";
import { STAT_ROWS } from "../stats.js";
import { ACHIEVEMENTS, CATEGORIES, TIER_NAMES, MEDAL_COLORS, MEDAL_DARK } from "../achievements.js";
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
      ...choices.map((c) => h("button.combo-item" + (c.toLowerCase() === input.value.trim().toLowerCase() ? ".on" : ""), { type: "button", on: { click: () => choose(c) } }, c)));
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

// ------------------------------------------------------------- New Game
/** Game setup: players, each computer's skill, peg colours, board.  start(newSettings) begins the game. */
export function newGameWindow(app, { startup = false } = {}) {
  const s = app.settings;
  const nameLine = h("div.player-name", {}, app.playerName());
  const rows = [];
  const table = h("table.setup", {}, h("tr", {}, ...["Player", "Computer skill", "Peg colour", ""].map((t) => h("th", {}, t))));
  for (let r = 0; r < 3; r++) {
    const who = r === 0 ? nameLine : h("input", { type: "text", maxlength: 16, value: s.cpu_names[r - 1] || "", placeholder: "(peg colour)" });
    const skill = r === 0 ? h("span.dim", {}, "(you)") : select(DIFFICULTIES, s.levels[r - 1]);
    const colour = select(Object.keys(PEG_PALETTE), s.colors[r]);
    const swatch = h("span.swatch");
    rows.push({ who, skill, colour, swatch });
    table.append(h("tr", {}, h("td", {}, r === 0 ? who : combo(who, PRESET_OPPONENTS, "New Entry")), h("td", {}, skill), h("td", {}, colour), h("td", {}, swatch)));
  }
  let players = s.players;
  const refresh = () => {
    rows.forEach(({ who, skill, colour, swatch }, r) => {
      const active = r < players;
      if (r > 0) {
        who.disabled = !active;
        const lock = forcedLevel(who.value);               // e.g. Corey: Expert only
        if (lock) skill.value = lock;
        for (const opt of skill.options) opt.disabled = !!lock && opt.value !== lock;
        skill.disabled = !active;
      }
      colour.disabled = !active;
      swatch.style.background = active ? PEG_PALETTE[colour.value] || "#888" : "#dddddd";
    });
  };
  rows.forEach(({ who, colour }, r) => {
    colour.addEventListener("change", refresh);
    if (r > 0) { who.addEventListener("input", refresh); who.addEventListener("change", refresh); }
  });
  const playersGroup = group("Number of players", radios("ng-players", [[2, "2 players  (you + 1 computer)"], [3, "3 players  (you + 2 computers)"]], s.players, (v) => { players = +v; refresh(); }));
  const boardGroup = group("Board", radios("ng-board", BOARD_STYLES.map((b) => [b, b]), s.board));
  const body = [
    playersGroup,
    group("Players", table, h("p.note", {}, "Pick a family opponent or type any name; blank = its peg colour.", h("br"),
      "Skill only changes how well a computer plays - never the cards.")),
    boardGroup,
  ];
  refresh();
  const start = () => {
    const colors = rows.map((r) => r.colour.value);
    if (new Set(colors.slice(0, players)).size < players) {
      messageBox("Peg colours", "Please give each player a different peg colour.");
      return false;
    }
    const spare = Object.keys(PEG_PALETTE).filter((c) => !colors.slice(0, players).includes(c));
    const cpu = rows.slice(1).map((r) => r.who.value.trim().slice(0, 16));
    const levels = rows.slice(1).map((r, i) => forcedLevel(cpu[i]) || r.skill.value);
    const next = { ...s, players, levels, colors: [...colors.slice(0, players), ...spare.slice(0, 3 - players)],
      board: radioValue(win.el, "ng-board"), cpu_names: cpu, difficulty: levels[0] };
    win.close();
    app.startGame(next);
  };
  const win = openWindow({ title: "New Game", width: 600, body, buttons: [["Cancel", null], ["Start Game", start, true]],
    onClose: () => { if (startup) app.table.requestRedraw(); } });
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
  const cols = [...DIFFICULTIES, "All levels", ...PRESET_OPPONENTS];
  const fill = () => {
    const pl = mode === "all" ? null : +mode;
    const buckets = [...DIFFICULTIES.map((d) => stats.aggregate(pl, d)), stats.aggregate(pl, null), ...PRESET_OPPONENTS.map((o) => stats.aggregate(pl, null, o))];
    const allb = buckets[DIFFICULTIES.length];
    tableEl.innerHTML = "";
    tableEl.append(h("tr", {}, h("th", {}, "Statistic"), ...cols.map((c) => h("th" + (PRESET_OPPONENTS.includes(c) ? ".opp" : c === "All levels" ? ".all" : ""), {}, PRESET_OPPONENTS.includes(c) ? "vs " + c : c))));
    for (const [label, fn] of STAT_ROWS) tableEl.append(h("tr", {}, h("td", {}, label), ...buckets.map((b, i) => h("td" + (i === DIFFICULTIES.length ? ".all" : ""), {}, String(fn(b))))));
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
  openWindow({ title: `Lifetime Statistics - ${app.playerName()}`, width: "min(1180px, 96vw)", cls: "tall", body,
    buttons: [["Reset stats...", reset, false, true], ["Close", null, true]] });
}

// ------------------------------------------------------------- Achievements
export function achievementsWindow(app, highlight = []) {
  const tracker = app.tracker;
  const hl = new Set(highlight);
  const summary = h("span.summary");
  const show = select(["All", "Earned", "In progress", "Not started", ...CATEGORIES], "All");
  const list = h("div.ach-list");
  const medal = (r, tn, earned, label = "") => h("span.medal", { style: { width: 2 * r + "px", height: 2 * r + "px", fontSize: Math.max(7, Math.trunc(r * 0.8)) + "px",
    background: earned ? MEDAL_COLORS[tn] : "#dedad0", borderColor: earned ? MEDAL_DARK[tn] : "#b5b0a3", color: earned ? "#2b2b2b" : "#9a958a" } }, label);
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
          medal(20, bestTier, !!have, have ? bestTier[0] : "?"),
          h("div.ach-text", {}, h("div.ach-name", {}, a.name + (isNew ? "   NEW!" : "")), h("div.ach-desc", {}, a.desc + (a.note ? `   (${a.note})` : ""))),
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
  openWindow({ title: `Achievements - ${app.playerName()}`, width: "min(900px, 96vw)", cls: "tall",
    body: [h("div.row", {}, summary, h("span", { style: { marginLeft: "auto" } }, "Show: "), show), list],
    buttons: [["Reset achievements...", reset, false, true], ["Close", null, true]] });
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
  const fileIn = (multi, fn) => {
    const inp = h("input", { type: "file", accept: ".json,application/json", multiple: multi, style: { display: "none" } });
    inp.addEventListener("change", async () => { const files = [...inp.files]; inp.remove(); if (files.length) await fn(files); });
    document.body.append(inp); inp.click();
  };
  const body = [
    group("This player",
      h("div.row", {}, nameIn, h("button", { on: { click: () => {
        try { store.rename(app.pid, nameIn.value); app.changed(); say("Renamed."); } catch (err) { say(err.message, true); }
      } } }, "Rename"),
      h("button.danger", { style: { marginLeft: "auto" }, on: { click: async () => {
        if (await confirmBox("Delete player", `Delete ${app.playerName()} and all of their stats and achievements?\nThis can't be undone.`)) {
          win.close(); app.deletePlayer();
        }
      } } }, "Delete player..."))),
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
    group("Bring in stats from the Windows (Python) version",
      h("p.note", {}, "On the Windows PC the files are in ", h("b", {}, "%USERPROFILE%\\.pycribbage"), " (type that into the file picker's address bar): ",
        h("b", {}, "stats.json"), ", ", h("b", {}, "achievements.json"), " and ", h("b", {}, "settings.json"), ". Pick any of them (Ctrl-click for several). They replace this player's stats and achievements."),
      h("button", { on: { click: () => fileIn(true, async (files) => {
        if (!(await confirmBox("Import", `Replace ${app.playerName()}'s stats and achievements with the ones from these files?`))) return;
        try {
          const texts = {};
          for (const f of files) texts[f.name] = await f.text();
          const done = store.importPython(app.pid, texts);
          app.reloadPlayer();
          say(`Imported ${done.join(", ")} for ${app.playerName()}.`);
        } catch (err) { say(err.message, true); }
      }) } }, "Choose files from the Python version...")),
    msg,
  ];
  const win = openWindow({ title: "Players & Backups", width: 620, body, buttons: [["Close", null, true]] });
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
  const win = openWindow({ title: "Who's playing?", width: 560, cls: canClose ? "" : "locked",
    body: [list.children.length ? list : h("p", {}, "Welcome! Type your name to make a player. Everyone who plays on this device gets their own stats and achievements."),
      h("div.row", {}, nameIn, h("button.primary", { on: { click: add } }, "Add player")), err],
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

export function helpWindow() {
  const sc = (pairs) => h("table.score", {}, ...pairs.map(([a, b, c, d]) => h("tr", {}, h("td", {}, a), h("td.pts", {}, b), h("td", {}, c || ""), h("td.pts", {}, d || ""))));
  const P = (t) => h("p", { html: t });
  openWindow({ title: "How to Play", width: "min(720px, 96vw)", cls: "tall help", body: [
    h("h3", {}, "Goal"), P("Be first to peg <b>121</b> points."),
    h("h3", {}, "New game (F2)"), P("Choose 2 or 3 players, a skill level for each computer, everyone's peg colour, and the board. With mixed skill levels, stats are filed under the strongest one."),
    h("h3", {}, "Cut for deal"), P("Click any card in the face-down spread, then each computer cuts. Low card deals (ace is low). A tie means everyone cuts again."),
    h("h3", {}, "The deal"), P("<b>2 players:</b> 6 cards each, discard 2 to the crib.<br><b>3 players:</b> 5 cards each, one card goes straight to the crib, each player discards 1.<br>The crib belongs to the dealer. The deal rotates every hand. Tap cards to choose them (or drag them up), then press the Send button."),
    h("h3", {}, "The starter"), P('After discards the deck is cut and a starter card turned up. If it is a Jack the dealer pegs 2 ("His Heels").'),
    h("h3", {}, "Pegging (the play)"), P("Starting left of the dealer, players take turns laying cards, keeping a running count that may not pass 31. <b>Double-click</b> a card to play it, <b>drag</b> it up onto the table, or click it and press Enter / Play Card. If you cannot play, press <b>Go</b>."),
    sc([["Count of 15", 2, "Pair", 2], ["Count of 31", 2, "Three of a kind", 6], ["Go / last card", 1, "Four of a kind", 12], ["Run of 3+ (any order, uninterrupted)", "1 per card"]]),
    P("After 31 or a Go the count starts again at 0."),
    h("h3", {}, "The show"), P('Hands are counted left of the dealer first, then the dealer\'s hand, then the crib, each together with the starter. Everything is counted automatically - press "Show Count" to see the itemised breakdown.'),
    sc([["Each combination totalling 15", 2, "Each pair", 2], ["Each run of 3 or more", "1 per card"], ["Flush: 4 in hand (5 with starter); the crib needs all 5", ""], ["His Nobs: Jack in hand of the starter's suit", 1]]),
    h("h3", {}, "Achievements"), P('87 achievements with Bronze / Silver / Gold / Platinum (and a few Diamond) medals. Unlocks pop up during play, are listed on the win/lose screen, and can be browsed any time from Game &gt; Achievements. Settings &gt; "Count my own hands" asks you to count your hand before it is revealed.'),
    h("h3", {}, "Skunks"), P("Lose with fewer than 91 points = skunk; fewer than 61 = double skunk. The board marks these lines with S and SS."),
    h("h3", {}, "Computer skill"),
    sc([["Easy", "makes beginner choices and often misses pegging chances"], ["Medium", "keeps the best-looking hand and takes points when it sees them"],
      ["Hard", "averages every possible starter and weighs the crib; avoids feeding you points"], ["Expert", "simulates hundreds of crib outcomes and looks ahead in the pegging"]]),
    P("Skill never changes the cards: the deck is shuffled by the browser's secure random generator and the computer only knows its own cards and what has been played face-up."),
    h("h3", {}, "Players and stats"), P("Everyone who plays on this device picks their name at the start (Game &gt; Switch Player to change). Stats and achievements are saved in this browser for each player. Use Game &gt; Players &amp; Backups to save a backup or move them to another device."),
  ] });
}

export { esc };
