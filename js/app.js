// Eyton's Cribbage - the game page: menus, windows, players and the table.
// Code: (c) Corey J Ruff
import { ProfileStore, browserStorage } from "./profiles.js";
import { BOARD_STYLES, BG_PRESETS, CARD_BACKS, BACK_PRESETS, normalizeSettings, isPreset, baseName } from "./settings.js";
import { pickPhoto } from "./photo.js";
import { Table } from "./ui/table.js";
import { buildMenuBar, openWindow, confirmBox, windowOpen, pickColour, h } from "./ui/windows.js";
import { newGameWindow, settingsWindow, statsWindow, achievementsWindow, playersWindow, whoWindow, aboutWindow, helpWindow } from "./ui/dialogs.js";

const { storage, persistent } = browserStorage();

class App {
  constructor() {
    this.store = new ProfileStore(storage);
    this.pid = null;
    this.settings = normalizeSettings(null);
    this.stats = null;
    this.tracker = null;
    this.canvas = document.getElementById("table");
    this.table = new Table(this.canvas, {
      settings: this.settings, stats: null, tracker: null, assets: "assets/",
      askCount: (what) => this.askCount(what),
      onYouLose: () => this.youLose(),
      onGameOverButton: (name) => this.gameOverButton(name),
      onChange: () => this.changed(),
      photoFor: (p) => this.photoFor(p),
    });
    this.menus = buildMenuBar(document.getElementById("menubar"), this.menuSpec());
    this.title = h("span.title");
    document.getElementById("menubar").append(this.title);
    window.addEventListener("keydown", (ev) => this.onKey(ev));
    window.addEventListener("pagehide", () => { if (this.table.session) this.table.session.abandon(); });
    document.addEventListener("fullscreenchange", () => this.table.requestRedraw());
  }

  async start() {
    // Offline copy: on the real site always; on your own PC (localhost) only with ?offline in the address,
    // so edits you make while testing show up straight away.
    const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      if (!local || new URLSearchParams(location.search).has("offline")) {
        navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Offline mode unavailable:", err));
      } else {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      }
    }
    navigator.storage?.persist?.().catch(() => {});      // ask the browser not to clear saved stats on its own
    await this.table.loadAssets();
    this.table.redraw();
    if (!persistent) {
      openWindow({ title: "Stats won't be saved", body: h("p.msg", {}, "This browser isn't letting the game save (a private window, or storage is switched off). You can play, but stats and achievements will be lost when you close it.") });
    }
    whoWindow(this);                       // everyone picks their name at the start
  }

  /** Photo to show for a player at the table (null = use the built-in portrait / silhouette). */
  photoFor(p) {
    if (p.human) return this.pid ? this.store.photo(this.pid) : null;
    if (isPreset(p.name)) return null;                    // family and pets keep their portraits
    return this.store.opponentPhoto(baseName(p.name));
  }
  /** Ask for a picture and save it for you (human) or a typed-in opponent; redraws the table. */
  async addPhoto(forName = null) {
    const url = await pickPhoto();
    if (!url) return false;
    const ok = forName == null ? this.store.setPhoto(this.pid, url) : this.store.setOpponentPhoto(baseName(forName), url);
    if (!ok) { openWindow({ title: "Photo", body: h("p.msg", {}, "There isn't enough room in this browser to save that picture.") }); return false; }
    this.table.requestRedraw();
    return true;
  }
  removePhoto(forName = null) {
    if (forName == null) this.store.setPhoto(this.pid, null); else this.store.setOpponentPhoto(baseName(forName), null);
    this.table.requestRedraw();
  }

  playerName() { return this.pid ? this.store.get(this.pid).name : ""; }
  changed() { this.title.innerHTML = this.pid ? `Playing as <b>${this.playerName().replace(/</g, "&lt;")}</b>` : ""; }

  // ----- players -----
  async choosePlayer(id) {
    if (this.pid && id !== this.pid && this.table.gameInProgress() &&
        !(await confirmBox("Switch player", "Abandon the current game?\n(It will be recorded as abandoned, not as a loss.)"))) {
      return;
    }
    if (this.table.session && id !== this.pid) this.table.session.abandon();
    this.pid = id;
    this.store.select(id);
    this._load();
    await this.table.newGame(this.settings, { greet: false, stats: this.stats, tracker: this.tracker });   // table behind the dialog
    this.changed();
    newGameWindow(this, { startup: true });
  }
  _load() {
    this.settings = this.store.settings(this.pid);
    this.settings.name = this.playerName();
    this.stats = this.store.stats(this.pid);
    this.tracker = this.store.achievements(this.pid, this.stats);
  }
  /** After an import/backup load: drop the current game without recording it, reload, start fresh. */
  async reloadPlayer() {
    if (this.table.session) this.table.session.recorded = true;
    if (!this.store.get(this.pid)) { this.pid = null; whoWindow(this); return; }
    this._load();
    await this.table.newGame(this.settings, { greet: false, stats: this.stats, tracker: this.tracker });
    this.changed();
  }
  deletePlayer() {
    if (this.table.session) this.table.session.recorded = true;
    this.store.remove(this.pid);
    this.pid = null;
    this.changed();
    whoWindow(this);
  }
  /** Pick someone else (asks about the current game only if a different player is chosen). */
  switchPlayer() { whoWindow(this, { canClose: !!this.pid }); }

  // ----- games and settings -----
  async newGame(startup = false) {
    if (!this.pid) { whoWindow(this); return; }
    if (windowOpen()) return;
    if (!startup && this.table.gameInProgress() &&
        !(await confirmBox("New Game", "Abandon the current game and start a new one?\n(It will be recorded as abandoned, not as a loss.)"))) return;
    newGameWindow(this);
  }
  async startGame(next) {
    Object.assign(this.settings, next, { name: this.playerName() });
    this.store.saveSettings(this.pid, this.settings);
    this.settings = this.store.settings(this.pid);        // normalised copy
    this.settings.name = this.playerName();
    await this.table.newGame(this.settings, { stats: this.stats, tracker: this.tracker });
    this.canvas.focus();
  }
  updateSettings(patch) {
    for (const [k, v] of Object.entries(patch)) {
      this.settings[k] = v;
      this.table.setSetting(k, v);
    }
    if (this.pid) this.store.saveSettings(this.pid, this.settings);
  }
  async askCount(what) {
    return new Promise((res) => {
      let value = null;
      const inp = h("input", { type: "number", min: 0, max: 29, inputmode: "numeric", autofocus: true, style: { fontSize: "20px", width: "110px", padding: "4px 8px" } });
      openWindow({ title: `Count your ${what}`, width: 380,
        body: [h("p", {}, "How many points is it worth (with the starter)?"), inp],
        buttons: [["Skip", null], ["OK", () => { if (inp.value !== "") value = Math.max(0, Math.min(29, parseInt(inp.value, 10))); }, true]],
        onClose: () => { this.canvas.focus(); res(value); } });
    });
  }
  youLose() {
    const img = h("img", { src: "assets/youlose.webp", alt: "" });
    const alt = h("h2", { style: { display: "none", textAlign: "center", color: "#8a1c1c" } }, "Corey wins. You lose!");
    img.addEventListener("error", () => {
      if (img.src.endsWith(".webp")) { img.src = "assets/youlose.png"; return; }      // a picture you dropped in
      img.remove(); alt.style.display = "";
    });
    openWindow({ title: "You lose!", width: "auto", cls: "youlose", body: h("div#youlose", {}, img, alt) });
  }
  gameOverButton(name) {
    if (name === "new") this.newGame(true);
    else if (name === "achievements") achievementsWindow(this, this.tracker ? this.tracker.newThisGame.map(([a]) => a.id) : []);
    else if (name === "stats") statsWindow(this);
    else if (name === "quit") this.quit();
  }
  /** Close the game.  An installed app closes its window; a browser tab can't be closed by the page,
   *  so show a goodbye screen instead. */
  async quit() {
    if (this.table.gameInProgress() &&
        !(await confirmBox("Quit", "Abandon the current game and quit?\n(It will be recorded as abandoned, not as a loss.)"))) return;
    if (this.table.session) this.table.session.abandon();
    window.close();
    setTimeout(() => {
      if (window.closed) return;
      const scr = h("div#goodbye", {}, h("div", {},
        h("img", { src: "assets/about.webp", alt: "" }),
        h("h1", {}, "Thanks for playing!"),
        h("p", {}, "You can close this tab now."),
        h("button", { on: { click: () => { scr.remove(); whoWindow(this, { canClose: false }); } } }, "Play Again")));
      document.body.append(scr);
    }, 250);
  }
  setFullscreen(on) {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen?.();
  }

  // ----- menus -----
  menuSpec() {
    const s = () => this.settings;
    const needPlayer = (fn) => () => (this.pid ? fn() : whoWindow(this));
    return [
      { label: "Game", items: () => [
        { label: "New Game...", key: "F2", act: () => this.newGame() },
        { label: "Statistics...", act: needPlayer(() => statsWindow(this)) },
        { label: "Achievements...", act: needPlayer(() => achievementsWindow(this, [])) },
        { label: "Settings...", act: needPlayer(() => settingsWindow(this)) },
        { sep: true },
        { label: "Switch Player...", act: () => this.switchPlayer() },
        { label: "Players & Backups...", act: needPlayer(() => playersWindow(this)) },
      ] },
      { label: "Board", items: () => BOARD_STYLES.map((b) => ({ label: b, radio: true, checked: s().board === b, act: () => this.updateSettings({ board: b }) })) },
      { label: "Background", items: () => [
        ...Object.entries(BG_PRESETS).map(([nm, col]) => ({ label: nm, swatch: col, radio: true, checked: s().background === col, act: () => this.updateSettings({ background: col }) })),
        { label: "Custom colour...", act: async () => { const c = await pickColour(s().background); if (c) this.updateSettings({ background: c }); } },
      ] },
      { label: "Card Back", items: () => [
        ...CARD_BACKS.map((b) => ({ label: b, radio: true, checked: s().card_back === b, act: () => this.updateSettings({ card_back: b }) })),
        { sep: true },
        ...Object.entries(BACK_PRESETS).map(([nm, col]) => ({ label: `Eyton colour: ${nm}`, swatch: col, radio: true, checked: s().card_back_color === col, act: () => this.updateSettings({ card_back_color: col }) })),
        { label: "Eyton colour: Custom...", act: async () => { const c = await pickColour(s().card_back_color); if (c) this.updateSettings({ card_back_color: c }); } },
      ] },
      { label: "View", items: () => [
        { label: "Full Screen", key: "F11", checked: !!document.fullscreenElement, act: () => this.setFullscreen(!document.fullscreenElement) },
      ] },
      { label: "Help", items: () => [
        { label: "How to Play", act: () => helpWindow() },
        { label: "About", act: () => aboutWindow() },
      ] },
    ];
  }

  onKey(ev) {
    if (ev.key === "F11") { ev.preventDefault(); this.setFullscreen(!document.fullscreenElement); return; }
    if (windowOpen() || document.querySelector(".menu-drop")) return;
    if (ev.key === "F2") { ev.preventDefault(); this.newGame(); return; }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(ev.target.tagName)) return;
    this.table.onKey(ev);
  }
}

const app = new App();
window.app = app;                 // handy for testing in the browser console
window.table = app.table;
await app.start();
