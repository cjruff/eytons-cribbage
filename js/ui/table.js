// The game table (ported from CribbageApp in cribbage.py): drawing, timing and input.
// Menus and dialogs come from the page that hosts it.
// Code: (c) Corey J Ruff
import { RANK, SUIT, RANK_NAMES, SUIT_SYMBOLS, cardName, sortCards } from "../cards.js";
import { WIN_SCORE } from "../engine.js";
import { SPEEDS, baseName } from "../settings.js";
import { GameSession } from "../session.js";
import { MEDAL_COLORS, MEDAL_DARK } from "../achievements.js";
import { Painter, LW, LH, shade, mix, SERIF } from "./paint.js";
import { TRACK_OFFSETS, loadGeometry } from "./geometry.js";

export const CW = 90, CH = 128;                 // card size
const RED_SUITS = new Set([1, 2]);
const FACE_FRAME = { false: "#1f3561", true: "#b3122e" };   // black suits blue, red suits red
const BACK_GOLD = "#d9b54a";
const FACE_IMAGES = { 11: "jacks", 12: "queens", 13: "kings" };
const DRAG_START_PX = 10;                        // movement before a press becomes a drag
const DOUBLE_MS = 400;
const now = () => performance.now() / 1000;

/**
 * Where everything goes.  "desktop" is the Python table (1400 x 880); "phone" is a landscape
 * layout for small screens (1400 x 660): no game log, smaller board, bigger hand cards.
 */
export const LAYOUTS = {
  desktop: {
    name: "desktop", W: LW, H: LH, ts: 1,
    board: { x: 10, y: 10, k: 1 },
    side: { x1: 1145, x2: 1390, top: 14, head: 34, log: true, bottom: 866, ch: { 2: 170, 3: 138 }, pw: null },
    cx: 830, midL: 548, midR: 1132,
    opp: { nameY: 28, y: 48, k: 1, step: { 2: 38, 3: 26 }, anchors: { 2: [830], 3: [720, 1015] }, goY: 112, thinkY: 192 },
    deck: { x: 552, y: 240, labelY: 384, k: 1 }, starter: { x: 579, y: 218, labelY: 204 },
    crib: { own: [548, 392], k: 0.8, gap: 98, labelDy: 116 },
    discardMsg: { x: 960, y: 300, w: 330 },
    peg: { x0: 770, y0: 222, k: 1, step: 34, box: [880, 372, 1040, 432], countY: 402, restartY: 446, lastX: 945, lastY: 472, lastW: 400 },
    show: { titleY: 206, x0: 588, y: 232, k: 1, step: 97, totalY: 392, ofY: 420, msgY: 506, btnY: 440, btnX: [660, 840] },
    cut: { titleY: 206, cardY: 238, k: 1, span: 150, nameY: 392, spreadL: 548, spreadR: 1128, base: 460, msgY: 640, btnY: 672 },
    hand: { y: 598, k: 1, step: 100, lift: 24, promptY: 560, btnY: 750, nameY: 846 },
    dropY: 556, dragRect: [560, 196, 1128, 540], dragTextY: 525,
    breakdown: { x1: 560, x2: 1120, y1: 120, ymin: 500, ymax: 830 },
    gameover: [570, 140, 1110, 700], toast: [600, 8, 1060, 72],
  },
};

/** Phone layout when the table area is short (a phone held sideways). */
export const isPhone = (cssW, cssH) => cssH < 560 || cssW < 820;

/**
 * Phone (landscape) layout: a smaller 1150 x 540 table, so everything is drawn bigger, with
 * 30% bigger text.  The board fills the full height; the play area takes what is left.
 */
export function phoneLayout(g) {
  const W = 1150, H = 540, top = 6;
  let k, bx, by, right;
  if (g && g.isImage) {                       // picture boards: fill the height, at most 420 wide
    const iw = g.W * g.fit, ih = g.H * g.fit;
    k = Math.min((H - 2 * top) / ih, 420 / iw);
    bx = 4 - g.ox * k; by = top - g.oy * k; right = 4 + iw * k;
  } else {                                     // drawn boards: fit the wooden outline
    const box = g && g.style === "Cribbagemaster" ? [22, 24, 478, 812] : [22, 16, 478, 846];
    k = Math.min((H - 2 * top) / (box[3] - box[1] + 6), 420 / (box[2] - box[0] + 6));
    bx = 4 - box[0] * k; by = top - box[1] * k; right = 4 + (box[2] - box[0] + 6) * k;
  }
  const side = { x1: 978, x2: 1146, top: 4, head: 30, log: false, bottom: 536, ch: { 2: 252, 3: 168 }, pw: 64, ph: 82, phone: true };
  const midL = right + 12, midR = side.x1 - 10, mw = midR - midL, cx = (midL + midR) / 2;
  const handK = 1.04, hw = CW * handK;
  return {
    name: "phone", W, H, ts: 1.3,
    board: { x: bx, y: by, k }, side, cx, midL, midR,
    opp: { nameY: 10, y: 24, k: 0.62, step: { 2: 22, 3: 18 }, anchors: { 2: [cx + 40], 3: [midL + mw * 0.36, midL + mw * 0.8] }, goY: 64, thinkY: null },
    deck: { x: midL + 4, y: 132, labelY: null, k: 0.85 }, starter: { x: midL + 26, y: 120, labelY: 108 },
    crib: { own: [midR - 52, 120], k: 0.45, gap: 60 },
    discardMsg: { x: (midL + 130 + midR - 70) / 2, y: 175, w: mw - 220 },
    peg: { x0: midL + 124, y0: 120, k: 0.85, step: 30, box: [midL + 184, 254, midL + 384, 292], countY: 273, restartY: null, lastX: cx, lastY: 311, lastW: mw - 20, calloutY: 216 },
    show: { titleY: 104, x0: cx - 208, y: 122, k: 0.85, step: 82, totalY: 258, ofY: 286, msgY: 310, btnY: 492, btnX: [cx - 170, cx + 10] },
    cut: { titleY: 56, cardY: 76, k: 0.85, span: 130, nameY: 198, spreadL: midL, spreadR: midR, base: 226, msgY: 354, btnY: 376 },
    hand: { y: 356, k: handK, step: Math.min(105, (mw - hw) / 5), lift: 10, promptY: 334, btnY: 492, nameY: null, short: true },
    dropY: 340, dragRect: [midL, 104, midR, 336], dragTextY: 322,
    breakdown: { x1: 255, x2: 895, y1: 6, ymin: 430, ymax: 534 },
    gameover: [150, 8, 1000, 532], toast: [cx - 260, 4, cx + 260, 76],
  };
}

function loadImage(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** First of several files that loads (e.g. a .webp, else a .png you dropped in). */
async function loadFirst(paths) {
  for (const p of paths) { const img = await loadImage(p); if (img) return img; }
  return null;
}
const variants = (base) => [".webp", ".png", ".jpg", ".jpeg"].map((ext) => base + ext);

/** Source rectangle that fills a w x h box from an image (centre-cropped, like ImageOps.fit). */
function fitRect(img, w, h, cx = 0.5, cy = 0.5) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const want = w / h, have = iw / ih;
  let sw = iw, sh = ih;
  if (have > want) sw = ih * want; else sh = iw / want;
  return [(iw - sw) * cx, (ih - sh) * cy, sw, sh];
}

export class Table {
  /**
   * host: { settings, stats, tracker, assets (base path), onYouLose(), onGameOverButton(name),
   *         askCount(what) -> Promise<number|null>, onChange() }
   */
  constructor(canvas, host) {
    this.canvas = canvas;
    this.p = new Painter(canvas);
    this.host = host;
    this.assets = host.assets || "assets/";
    this.settings = host.settings;
    this.session = null;
    this.engine = null;
    this.geoms = {};
    this.images = {};
    this.toasts = [];
    this.gen = 0;
    this._raf = 0;
    this.overlay = null;
    this._bind();
  }

  // ------------------------------------------------------------- setup
  async loadAssets() {
    const a = this.assets;
    const [jacks, queens, kings, back] = await Promise.all(
      [FACE_IMAGES[11], FACE_IMAGES[12], FACE_IMAGES[13], "card_back"].map((f) => loadFirst(variants(a + f))));
    this.images.face = { 11: jacks, 12: queens, 13: kings };
    this.images.back = back;
    this.images.portraits = {};
    if (this.settings) await this.board();
  }
  async board() {
    const st = this.settings.board;
    if (!this.geoms[st]) this.geoms[st] = await loadGeometry(st, "boards/");
    return this.geoms[st];
  }
  geometry() { return this.geoms[this.settings.board] || null; }

  /** Portrait for a player: assets/portraits/<name>.webp / .png / .jpg (loaded once). */
  portrait(name) {
    const base = baseName(name);
    const pm = this.images.portraits;
    if (!(base in pm)) {
      pm[base] = null;
      (async () => {
        const img = await loadFirst(variants(`${this.assets}portraits/${encodeURIComponent(base)}`));
        if (img) { pm[base] = img; this.requestRedraw(); }
      })();
    }
    return pm[base];
  }

  get delay() { return SPEEDS[this.settings.speed] || 750; }
  later(ms, fn) { const g = this.gen; setTimeout(() => { if (g === this.gen) fn(); }, ms); }
  gameInProgress() { const e = this.engine; return !!e && !e.over && e.handsPlayed > 0; }

  /** Start a new game with these settings (the page asks about abandoning first). */
  async newGame(settings, { greet = true, stats, tracker } = {}) {
    if (this.session) this.session.abandon();
    this.gen++;
    this.settings = settings;
    if (stats) this.host.stats = stats;
    if (tracker !== undefined) this.host.tracker = tracker;
    await this.board();
    this.session = new GameSession(settings, this.host.stats, this.host.tracker, {
      greet, onSay: () => { this.requestRedraw(); setTimeout(() => this.requestRedraw(), 5050); },
    });
    this.engine = this.session.engine;
    this.hideTotal = false; this.countMsg = "";
    this.selected = new Set();
    this.pegSel = null;
    this.press = null; this.drag = null;
    this.pegDisp = this.engine.players.map(() => [-1, 0]);
    this.anim = null;
    this.overlay = null;
    this.flash = "";
    this.busy = false;
    this.toasts = [];
    this.engine.startCut();
    this.cutStage = "pick";
    this.requestRedraw();
  }
  setSetting(key, value) {
    this.settings[key] = value;
    if (key === "board") this.board().then(() => this.requestRedraw());
    this.requestRedraw();
  }

  // ------------------------------------------------------------- game flow
  humanCut(idx) {
    const e = this.engine;
    if (e.phase !== "cutdeal" || this.cutStage !== "pick") return;
    if (!e.pickCut(e.human, idx)) return;
    this.cutStage = "ai";
    this.redraw();
    this.later(this.delay, () => this._aiCut());
  }
  _aiCut() {
    const e = this.engine;
    const todo = [...Array(e.n).keys()].filter((i) => !e.cutPicks.has(i));
    if (todo.length) {
      e.aiPickCut(todo[0]);
      this.session.voices.cutPick(todo[0], e.cutDeck[e.cutPicks.get(todo[0])]);
      this.redraw();
      this.later(this.delay, () => this._aiCut());
      return;
    }
    e.resolveCut();
    this.cutStage = e.cutResult === "tie" ? "tie" : "done";
    this.redraw();
  }
  cutAgain() { this.engine.startCut(); this.cutStage = "pick"; this.requestRedraw(); }

  beginRound(first = false) {
    const e = this.engine;
    if (first) e.startRound(); else e.nextRound();
    this.selected = new Set();
    this.busy = true;
    this.redraw();
    this.later(30, () => { e.aiDiscards(); this.busy = false; this.requestRedraw(); });
  }
  toggleSelect(card) {
    const e = this.engine;
    if (e.phase !== "discard" || this.busy) return;
    if (this.selected.has(card)) this.selected.delete(card);
    else if (this.selected.size < e.nDiscard) this.selected.add(card);
    else if (e.nDiscard === 1) this.selected = new Set([card]);
    this.requestRedraw();
  }
  doDiscard() {
    const e = this.engine;
    if (e.phase !== "discard" || this.busy || this.selected.size !== e.nDiscard) return;
    e.humanDiscard(sortCards([...this.selected]));
    this.selected = new Set();
    this.busy = true;
    this.redraw();
    this.later(this.delay, () => this._cut());
  }
  _cut() {
    const e = this.engine;
    if (e.cutStarter()) { this.finishGame(); return; }
    e.startPegging();
    this.redraw();
    this.later(this.delay, () => this.pegLoop());
  }
  pegLoop() {
    const e = this.engine;
    let st;
    do st = e.pegAdvance(); while (st === "quick");
    if (st === "over") { this.busy = false; this.finishGame(); }
    else if (st === "human_play" || st === "human_go") { this.busy = false; this.redraw(); }
    else if (st === "done") { this.redraw(); this.later(this.delay, () => this.beginShow()); }
    else { this.busy = true; this.redraw(); this.later(this.delay, () => this.pegLoop()); }
  }
  humanPlay(card) {
    const e = this.engine;
    if (e.phase !== "peg" || e.awaiting !== "play") return;
    if (!e.legal(e.human).includes(card)) {
      this.flash = `${cardName(card)} would take the count past 31.`;
      this.requestRedraw();
      return;
    }
    this.flash = "";
    this.pegSel = null;
    e.humanPlay(card);
    if (e.over) { this.finishGame(); return; }
    this.busy = true;
    this.redraw();
    this.later(this.delay, () => this.pegLoop());
  }
  selectPegCard(card) {
    const e = this.engine;
    if (e.phase !== "peg" || e.awaiting !== "play") return;
    if (!e.legal(e.human).includes(card)) {
      this.flash = `${cardName(card)} would take the count past 31.`;
      this.pegSel = null;
    } else {
      this.flash = "";
      this.pegSel = this.pegSel === card ? null : card;
    }
    this.requestRedraw();
  }
  humanGo() {
    const e = this.engine;
    if (e.humanGo()) {
      this.busy = true;
      this.redraw();
      this.later(Math.max(200, Math.floor(this.delay / 2)), () => this.pegLoop());
    }
  }
  beginShow() { this.engine.startShow(); this.busy = false; this.showStep(); }
  showStep() {
    const e = this.engine;
    if (this.hideTotal) return;
    this.overlay = null;
    this.countMsg = "";
    if (!e.showNext(true)) { this.beginRound(); return; }
    const pi = e.showCurrent[0];
    if (this.settings.manual_count && pi === e.human) {
      this.hideTotal = true;
      this.redraw();
      this.later(80, () => this._askCount());
      return;
    }
    e.commitShow();
    if (e.over) { this.finishGame(); return; }
    this.redraw();
  }
  async _askCount() {
    const e = this.engine;
    const [, kind, , , total] = e.showCurrent;
    const v = this.host.askCount ? await this.host.askCount(kind === "hand" ? "hand" : "crib") : null;
    this.hideTotal = false;
    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      const ok = v === total;
      if (this.host.tracker) this.host.tracker.manualCount(ok);
      this.countMsg = ok ? "Correct!" : `Not quite - you said ${v}, it's ${total}.`;
    }
    e.commitShow();
    if (e.over) { this.finishGame(); return; }
    this.redraw();
  }
  finishGame() {
    this.busy = false;
    const out = this.session.finish();
    if (out.youLose && this.host.onYouLose) setTimeout(() => this.host.onYouLose(), 400);
    this.overlay = "gameover";
    this.redraw();
    if (this.host.onChange) this.host.onChange();
  }

  primaryAction() {
    const e = this.engine;
    if (!e) return;
    if (this.overlay === "breakdown") { this.overlay = null; this.requestRedraw(); }
    else if (this.overlay === "gameover") this.host.onGameOverButton?.("new");
    else if (e.phase === "cutdeal") {
      if (this.cutStage === "done") this.beginRound(true);
      else if (this.cutStage === "tie") this.cutAgain();
    } else if (e.phase === "discard") this.doDiscard();
    else if (e.phase === "peg" && e.awaiting === "go") this.humanGo();
    else if (e.phase === "peg" && e.awaiting === "play" && this.pegSel !== null) this.humanPlay(this.pegSel);
    else if (e.phase === "show") this.showStep();
  }

  // ------------------------------------------------------------- input
  _bind() {
    const c = this.canvas;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (ev) => this.onDown(ev));
    c.addEventListener("pointermove", (ev) => this.onMove(ev));
    c.addEventListener("pointerup", (ev) => this.onUp(ev));
    c.addEventListener("pointercancel", () => { this.press = null; if (this.drag) { this.drag = null; this.requestRedraw(); } });
    c.addEventListener("contextmenu", (ev) => ev.preventDefault());
    // Redraw whenever the table's size changes (rotation, browser bars, full screen).  Phones report
    // a rotation before it has finished, so redraw again once it has settled.  A stale size would
    // stretch the picture and put every button in the wrong place.
    const resized = () => {
      this.press = null; this.drag = null;
      this.requestRedraw();
      clearTimeout(this._settle);
      this._settle = setTimeout(() => this.requestRedraw(), 350);
    };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resized).observe(c);
    window.addEventListener("resize", resized);
    window.addEventListener("orientationchange", resized);
    window.visualViewport?.addEventListener("resize", resized);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) resized(); });
    this._lastDown = { t: -1, x: 0, y: 0 };
  }
  _pt(ev) { const r = this.canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }

  onDown(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    const dpr = window.devicePixelRatio || 1;            // size changed since the last drawing? redraw first
    if (this.canvas.width !== Math.round(Math.max(50, this.canvas.clientWidth) * dpr) ||
        this.canvas.height !== Math.round(Math.max(50, this.canvas.clientHeight) * dpr)) this.redraw();
    const [cx, cy] = this._pt(ev);
    const [lx, ly] = this.p.toLogical(cx, cy);
    try { this.canvas.setPointerCapture(ev.pointerId); } catch { /* fine */ }
    const t = ev.timeStamp, last = this._lastDown;
    const isDouble = t - last.t < DOUBLE_MS && Math.hypot(cx - last.x, cy - last.y) < 12;
    this._lastDown = isDouble ? { t: -1, x: 0, y: 0 } : { t, x: cx, y: cy };
    this.press = null;
    const h = this.p.hit(lx, ly);
    if (!h) return;
    if (isDouble) { if (h.dbl) h.dbl(); return; }          // like Tk: a second quick click is a double-click
    if (h.card !== null) this.press = { card: h.card, cb: h.cb, x: cx, y: cy, dx: lx - h.x1, dy: ly - h.y1 };
    else h.cb();
  }
  onMove(ev) {
    const [cx, cy] = this._pt(ev);
    const [lx, ly] = this.p.toLogical(cx, cy);
    if (!this.drag) {
      const p = this.press;
      if (!p || ev.buttons === 0 || Math.hypot(cx - p.x, cy - p.y) < DRAG_START_PX) {
        this.canvas.style.cursor = this.p.hit(lx, ly) ? "pointer" : "";
        return;
      }
      this.drag = { card: p.card, dx: p.dx, dy: p.dy, lx, ly, zone: this._zone(ly) };
      this.press = null;
      this.requestRedraw();
      return;
    }
    Object.assign(this.drag, { lx, ly, zone: this._zone(ly) });
    this.requestRedraw();
  }
  onUp(ev) {
    const [cx, cy] = this._pt(ev);
    const [lx, ly] = this.p.toLogical(cx, cy);
    const p = this.press, d = this.drag;
    this.press = null;
    if (!d) { if (p) p.cb(); return; }             // it was a tap
    this.drag = null;
    const e = this.engine;
    if (this._zone(ly) === "table") {
      if (e.phase === "discard") this.dropInCrib(d.card);
      else if (e.phase === "peg") this.humanPlay(d.card);
      else this.requestRedraw();
    } else this.reorderHand(d.card, lx);
  }
  _zone(ly) { return ly < this.L.dropY ? "table" : "hand"; }
  _handList() {
    const e = this.engine, me = e.players[e.human];
    return e.phase === "discard" ? me.hand : e.phase === "peg" ? me.pegHand : null;
  }
  reorderHand(card, lx) {
    const cards = this._handList(), L = this.L, cw = CW * L.hand.k;
    if (cards && cards.includes(card)) {
      const n = cards.length;
      const x0 = L.cx - (cw + L.hand.step * (n - 1)) / 2;
      const slot = Math.max(0, Math.min(n - 1, Math.round((lx - x0 - cw / 2) / L.hand.step)));
      cards.splice(cards.indexOf(card), 1);
      cards.splice(slot, 0, card);
    }
    this.requestRedraw();
  }
  dropInCrib(card) {
    const e = this.engine;
    if (e.phase !== "discard" || this.busy || !e.players[e.human].hand.includes(card)) { this.requestRedraw(); return; }
    if (!this.selected.has(card)) {
      if (this.selected.size >= e.nDiscard) this.selected = new Set([...this.selected].sort((a, b) => a - b).slice(0, e.nDiscard - 1));
      this.selected.add(card);
    }
    if (this.selected.size === e.nDiscard) this.doDiscard(); else this.requestRedraw();
  }
  onKey(ev) {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.primaryAction(); }
    else if (ev.key === "Escape" && this.overlay === "breakdown") { this.overlay = null; this.requestRedraw(); }
  }

  // ------------------------------------------------------------- drawing
  requestRedraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.redraw(); });
  }
  redraw() {
    const e = this.engine;
    this.bg = this.settings.background;
    this.L = isPhone(this.canvas.clientWidth, this.canvas.clientHeight) ? phoneLayout(this.geometry()) : LAYOUTS.desktop;
    this.ts = this.L.ts;
    this.p.begin(this.bg, this.L.W, this.L.H);
    if (!e) return;
    this.drawBoard();
    this.drawSidebar();
    this.drawOpponents();
    this.drawCenter();
    this.drawHumanArea();
    if (this.overlay === "breakdown") { this.p.hotspots = []; this.drawBreakdown(); }
    else if (this.overlay === "gameover") { this.p.hotspots = []; this.drawGameover(); }
    if (this.overlay === null) this.drawDrag(); else this.drag = null;
    this.drawBubbles();
    this._pollToasts();
    this._drawToast();
    if (this.anim) this.requestRedraw();              // keep the peg moving
  }

  W(w) { return Math.max(1, Math.trunc(w * this.p.sc)); }   // line width in screen pixels

  /** Table text (bigger on phones).  Card faces and the board use this.p.text, which isn't scaled. */
  text(x, y, s, size = 14, ...rest) { return this.p.text(x, y, s, size * (this.ts || 1), ...rest); }
  rrect(...a) { return this.p.rrect(...a); }
  hot(...a) { return this.p.hot(...a); }

  button(x, y, w, h, label, cb, primary = false, enabled = true, size = 16) {
    let fill, fg, ol;
    if (enabled) { fill = primary ? "#f4c542" : "#f2efe6"; fg = "#1b1b1b"; ol = primary ? "#5a4a1a" : "#444"; }
    else { fill = "#8f9a90"; fg = "#d9ddd9"; ol = "#6d756e"; }
    this.rrect(x + 2, y + 3, x + w + 2, y + h + 3, 10, { fill: shade(this.bg, 0.6) });
    this.rrect(x, y, x + w, y + h, 10, { fill, outline: ol, width: this.W(1.5) });
    this.text(x + w / 2, y + h / 2, label, size, true, fg);
    if (enabled) this.hot(x, y, x + w, y + h, cb);
  }

  drawCardBack(x, y, w, h) {
    const k = w / CW, art = this.images.back;
    if (this.settings.card_back === "Eyton" && art) {
      this.rrect(x, y, x + w, y + h, 9 * k, { fill: "#f7f7f2", outline: "#2b2b2b", width: Math.max(1, this.p.sc * 0.6) });
      const m = 5 * k;
      this.rrect(x + m, y + m, x + w - m, y + h - m, Math.max(1, 9 * k - m), { fill: this.settings.card_back_color || "#1b2a4a", outline: BACK_GOLD, width: Math.max(1, 1.5 * k * this.p.sc) });
      const pad = m + 4 * k, side = Math.min(w - 2 * pad, h - 2 * pad);
      this.p.image(art, x + (w - side) / 2, y + (h - side) / 2, side, side);
      return true;
    }
    return false;
  }

  drawCard(x, y, card, { up = true, w = CW, h = CH, dim = false, selected = false, glow = null, simple = false } = {}) {
    const k = w / CW;
    this.rrect(x + 3, y + 4, x + w + 3, y + h + 4, 9 * k, { fill: shade(this.bg, 0.55) });
    if (!up) {
      if (this.drawCardBack(x, y, w, h)) return;
      this.rrect(x, y, x + w, y + h, 9 * k, { fill: "#f7f7f2", outline: "#2b2b2b" });
      this.rrect(x + 6 * k, y + 6 * k, x + w - 6 * k, y + h - 6 * k, 6 * k, { fill: "#1f3f8f", outline: BACK_GOLD, width: this.W(1.5) });
      if (simple) return;
      const ctx = this.p.ctx;
      ctx.save();
      this.p.rrectPath(x + 10 * k, y + 10 * k, x + w - 10 * k, y + h - 10 * k, 0);
      ctx.clip();
      const step = 14 * k, cx1 = x + 10 * k, cy1 = y + 10 * k, cx2 = x + w - 10 * k, cy2 = y + h - 10 * k;
      for (let i = 0; i <= (cx2 - cx1) + (cy2 - cy1); i += step) {
        this.p.line([[cx1 + i, cy1], [cx1, cy1 + i]], { fill: "#3557ad", width: Math.max(1, this.p.sc * 0.8) });
        this.p.line([[cx2 - i, cy1], [cx2, cy1 + i]], { fill: "#3557ad", width: Math.max(1, this.p.sc * 0.8) });
      }
      ctx.restore();
      return;
    }
    const face = dim ? "#bfc3bb" : "#fffdf6";
    const ol = selected ? "#e0a800" : glow === null ? "#2b2b2b" : glow;
    this.rrect(x, y, x + w, y + h, 9 * k, { fill: face, outline: ol, width: this.W(selected || glow ? 4 : 1.2) });
    const red = RED_SUITS.has(SUIT[card]);
    const col = !dim ? (red ? "#c8102e" : "#141414") : red ? "#9a6a70" : "#6c6c6c";
    const rk = RANK_NAMES[RANK[card]], st = SUIT_SYMBOLS[SUIT[card]];
    this.p.text(x + 7 * k, y + 3 * k, rk, (rk !== "10" ? 30 : 27) * k, true, col, "nw");
    this.p.text(x + 9 * k, y + 37 * k, st, 26 * k, false, col, "nw");
    if (RANK[card] >= 11) {
      const fx1 = x + 31 * k, fy1 = y + 9 * k, fx2 = x + w - 6 * k, fy2 = y + h - 6 * k;
      const img = this.images.face && this.images.face[RANK[card]];
      if (img) {
        const ctx = this.p.ctx;
        ctx.save();
        this.p.rrectPath(fx1, fy1, fx2, fy2, 5 * k);
        ctx.clip();
        const [sx, sy, sw, sh] = fitRect(img, fx2 - fx1, fy2 - fy1, 0.5, 0.4);
        ctx.drawImage(img, sx, sy, sw, sh, this.p.X(fx1), this.p.Y(fy1), (fx2 - fx1) * this.p.sc, (fy2 - fy1) * this.p.sc);
        if (dim) { ctx.fillStyle = "rgba(156,156,156,0.55)"; ctx.fill(); }
        ctx.restore();
        const frame = dim ? mix(FACE_FRAME[red], "#9c9c9c", 0.55) : FACE_FRAME[red];
        this.rrect(fx1, fy1, fx2, fy2, 5 * k, { outline: frame, width: Math.max(2, Math.round(2.6 * k * this.p.sc)) });
      } else this.drawCourt(fx1, fy1, fx2, fy2, RANK[card], red, dim, k);
    } else {
      this.p.text(x + w * 0.62, y + h * 0.64, st, 58 * k, false, col);
    }
  }

  /** Stylised Jack / Queen / King when the picture is missing (u 0..1 across, v 0..2 down). */
  drawCourt(x1, y1, x2, y2, rank, red, dim, k) {
    const W = x2 - x1, H = y2 - y1, p = this.p, sc = p.sc;
    const P = (uv) => { const o = []; for (let i = 0; i < uv.length; i += 2) o.push([x1 + uv[i] * W, y1 + (uv[i + 1] / 2) * H]); return o; };
    const col = (hx) => (dim ? mix(hx, "#9c9c9c", 0.55) : hx);
    const lw = Math.max(1, Math.round(sc * k));
    const poly = (pts, fill, outline = "", smooth = false) => p.poly(P(pts), { fill: col(fill), outline: outline ? col(outline) : "", width: lw, smooth });
    const oval = (u1, v1, u2, v2, fill, outline = "") => { const [[a, b], [c, d]] = P([u1, v1, u2, v2]); p.oval(a, b, c, d, { fill: col(fill), outline: outline ? col(outline) : "", width: lw }); };
    const line = (pts, fill, width = 1) => p.line(P(pts), { fill: col(fill), width: Math.max(1, width * sc * k), cap: "round" });
    const suitCol = red ? "#c8102e" : "#141414", robe = red ? "#b3122e" : "#1f3561", robeDk = red ? "#7d0c20" : "#141f3b";
    const gold = "#e2b23a", goldDk = "#9c7114", skin = "#f3d0a8", skinDk = "#b98b62";
    const hair = { 11: "#6b3e1c", 12: "#c98a2b", 13: "#dcdcdc" }[rank];
    this.rrect(x1, y1, x2, y2, 5 * k, { fill: col("#fbf0cf"), outline: col(suitCol), width: this.W(1.5) });
    if (rank === 13) { line([0.12, 1.92, 0.12, 0.86], "#c9ccd1", 3.2); line([0.12, 1.92, 0.12, 0.86], "#8d9097", 0.8); }
    else if (rank === 11) { line([0.89, 1.98, 0.89, 0.52], "#7a4a1e", 2.4); poly([0.89, 0.60, 0.99, 0.70, 0.89, 0.82], "#c9ccd1", "#6f737a"); }
    if (rank === 12) poly([0.24, 0.70, 0.76, 0.70, 0.86, 1.32, 0.66, 1.26, 0.66, 0.92, 0.34, 0.92, 0.34, 1.26, 0.14, 1.32], hair, "", true);
    poly([0.0, 2.0, 0.03, 1.46, 0.22, 1.26, 0.78, 1.26, 0.97, 1.46, 1.0, 2.0], robe, robeDk);
    poly([0.42, 1.26, 0.58, 1.26, 0.65, 2.0, 0.35, 2.0], gold, goldDk);
    line([0.24, 1.52, 0.30, 1.98], robeDk, 1.2);
    line([0.76, 1.52, 0.70, 1.98], robeDk, 1.2);
    for (const v of [1.45, 1.65, 1.85]) oval(0.47, v - 0.03, 0.53, v + 0.03, red ? "#ffffff" : suitCol, goldDk);
    poly([0.42, 1.02, 0.58, 1.02, 0.58, 1.27, 0.42, 1.27], skin);
    if (rank === 13) {
      poly([0.20, 1.23, 0.80, 1.23, 0.76, 1.38, 0.24, 1.38], "#ffffff", "#9a9a9a");
      for (const u of [0.32, 0.5, 0.68]) oval(u - 0.025, 1.29, u + 0.025, 1.33, "#141414");
    } else if (rank === 12) {
      poly([0.18, 1.22, 0.34, 1.12, 0.5, 1.17, 0.66, 1.12, 0.82, 1.22, 0.68, 1.34, 0.5, 1.29, 0.32, 1.34], "#ffffff", "#9a9a9a", true);
    } else {
      poly([0.30, 1.22, 0.5, 1.25, 0.40, 1.37], "#ffffff", "#9a9a9a");
      poly([0.70, 1.22, 0.5, 1.25, 0.60, 1.37], "#ffffff", "#9a9a9a");
    }
    if (rank !== 12) poly([0.25, 0.70, 0.75, 0.70, 0.78, 1.0, 0.22, 1.0], hair, "", true);
    oval(0.28, 0.60, 0.72, 1.10, skin, skinDk);
    if (rank === 12) { oval(0.33, 0.91, 0.41, 0.97, "#f2a7a0"); oval(0.59, 0.91, 0.67, 0.97, "#f2a7a0"); }
    oval(0.37, 0.80, 0.44, 0.85, "#2b2b2b");
    oval(0.56, 0.80, 0.63, 0.85, "#2b2b2b");
    line([0.35, 0.765, 0.45, 0.755], "#5a3a1a", 0.9);
    line([0.55, 0.755, 0.65, 0.765], "#5a3a1a", 0.9);
    line([0.50, 0.85, 0.48, 0.94, 0.52, 0.95], skinDk, 0.9);
    if (rank === 13) {
      poly([0.28, 0.92, 0.72, 0.92, 0.70, 1.12, 0.5, 1.32, 0.30, 1.12], hair, "#9a9a9a", true);
      poly([0.37, 1.00, 0.5, 0.955, 0.63, 1.00, 0.5, 1.025], "#bdbdbd", "", true);
    } else line([0.45, 1.01, 0.55, 1.01], "#b0353a", 1.2);
    if (rank === 13) {
      poly([0.27, 0.67, 0.27, 0.38, 0.39, 0.52, 0.5, 0.29, 0.61, 0.52, 0.73, 0.38, 0.73, 0.67], gold, goldDk);
      poly([0.27, 0.58, 0.73, 0.58, 0.73, 0.67, 0.27, 0.67], goldDk);
      for (const [u, jc] of [[0.38, "#c8102e"], [0.5, "#1f5fbf"], [0.62, "#c8102e"]]) oval(u - 0.035, 0.595, u + 0.035, 0.655, jc);
      for (const [u, v] of [[0.27, 0.38], [0.5, 0.29], [0.73, 0.38]]) oval(u - 0.04, v - 0.04, u + 0.04, v + 0.04, gold, goldDk);
    } else if (rank === 12) {
      poly([0.32, 0.67, 0.34, 0.47, 0.42, 0.56, 0.5, 0.42, 0.58, 0.56, 0.66, 0.47, 0.68, 0.67], gold, goldDk);
      for (const [u, v] of [[0.34, 0.47], [0.5, 0.42], [0.66, 0.47]]) oval(u - 0.035, v - 0.035, u + 0.035, v + 0.035, "#ffffff", "#9a9a9a");
      oval(0.465, 0.585, 0.535, 0.645, "#c8102e");
    } else {
      poly([0.22, 0.71, 0.26, 0.50, 0.50, 0.40, 0.76, 0.50, 0.80, 0.71], robe, robeDk, true);
      poly([0.23, 0.64, 0.77, 0.64, 0.77, 0.72, 0.23, 0.72], gold, goldDk);
      poly([0.60, 0.50, 0.78, 0.27, 0.95, 0.12, 0.87, 0.34, 0.68, 0.53], "#efe8cf", "#8a8166", true);
    }
    if (rank === 13) {
      line([0.02, 1.60, 0.22, 1.60], goldDk, 2.6);
      line([0.12, 1.60, 0.12, 1.82], "#5a3a1a", 2.4);
      oval(0.08, 1.82, 0.16, 1.90, gold, goldDk);
    } else if (rank === 12) {
      line([0.88, 1.96, 0.88, 1.30], "#2f7d32", 1.6);
      for (let ang = 0; ang < 360; ang += 72) {
        const du = 0.06 * Math.cos((ang * Math.PI) / 180), dv = 0.06 * Math.sin((ang * Math.PI) / 180);
        oval(0.88 + du - 0.045, 1.22 + dv - 0.045, 0.88 + du + 0.045, 1.22 + dv + 0.045, "#d8323f");
      }
      oval(0.85, 1.19, 0.91, 1.25, gold);
    }
  }

  // ----- achievement pop-ups -----
  _pollToasts() {
    const tr = this.host.tracker;
    if (!tr) return;
    const t = now();
    for (const [a, tier] of tr.popPending()) {
      const start = Math.max(t, this.toasts.length ? this.toasts[this.toasts.length - 1].end : t);
      this.toasts.push({ name: a.name, tier: a.tierName(tier), start, end: start + 3.2 });
      setTimeout(() => this.requestRedraw(), (start - t) * 1000 + 10);
      setTimeout(() => this.requestRedraw(), (start + 3.2 - t) * 1000 + 40);
    }
    this.toasts = this.toasts.filter((x) => x.end > t);
  }
  _drawToast() {
    const t = now();
    const s = this.toasts.find((x) => x.start <= t && t < x.end);
    if (!s) return;
    const [x1, y1, x2, y2] = this.L.toast;
    this.rrect(x1 + 4, y1 + 5, x2 + 4, y2 + 5, 16, { fill: shade(this.bg, 0.4) });
    this.rrect(x1, y1, x2, y2, 16, { fill: "#fffaf0", outline: MEDAL_DARK[s.tier], width: this.W(3) });
    const cx = x1 + 36, cy = (y1 + y2) / 2, r = 21;
    this.p.oval(cx - r, cy - r, cx + r, cy + r, { fill: MEDAL_COLORS[s.tier], outline: MEDAL_DARK[s.tier], width: this.W(2) });
    this.text(cx, cy, s.tier[0], 18, true, "#2b2b2b");
    this.text(x1 + 70, y1 + 20, "Achievement unlocked!", 12, true, "#8a6d00", "w");
    this.text(x1 + 70, y1 + 45, `${s.name}  -  ${s.tier}`, 18, true, "#222", "w");
  }

  // ----- board -----
  _boardLayer(g) {
    const sc = this.p.sc, key = `${g.style}|${sc}|${this.bg}`;
    if (this._boardCache && this._boardCache.key === key) return this._boardCache;
    const w = Math.max(1, Math.round(g.W * g.fit * sc)), h = Math.max(1, Math.round(g.H * g.fit * sc));
    const blur = Math.max(2, Math.round(14 * sc)), ox = Math.max(1, Math.round(9 * sc)), oy = Math.max(1, Math.round(12 * sc));
    const pad = blur * 3 + Math.max(ox, oy);
    const cv = document.createElement("canvas");
    cv.width = w + 2 * pad; cv.height = h + 2 * pad;
    const ctx = cv.getContext("2d");
    const [r, gg, b] = [1, 3, 5].map((i) => parseInt(this.bg.slice(i, i + 2), 16));
    for (const [dx, dy, rad, strength, dark] of [[ox, oy, blur, 0.62, 0.35], [Math.max(1, ox >> 2), Math.max(1, oy >> 2), Math.max(1, Math.trunc(blur / 5)), 0.55, 0.25]]) {
      ctx.save();
      ctx.shadowColor = `rgba(${Math.trunc(r * dark)},${Math.trunc(gg * dark)},${Math.trunc(b * dark)},${strength})`;
      ctx.shadowBlur = rad * 2;
      ctx.shadowOffsetX = dx + 10000; ctx.shadowOffsetY = dy;      // shadow only: draw the board off-canvas
      ctx.drawImage(g.image, pad - 10000, pad, w, h);
      ctx.restore();
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(g.image, pad, pad, w, h);
    this._boardCache = { key, cv, pad };
    return this._boardCache;
  }

  /** The board is drawn in its own 500 x 860 space, placed and scaled by the layout. */
  drawBoard() {
    const B = this.L.board, p = this.p;
    const saved = [p.ox, p.oy, p.sc];
    p.ox = p.X(B.x); p.oy = p.Y(B.y); p.sc *= B.k;
    try { this._drawBoard(); } finally { [p.ox, p.oy, p.sc] = saved; }
  }
  _drawBoard() {
    const g = this.geometry();
    if (!g) return;
    const bx = 0, by = 0, p = this.p;
    const L = (x, y) => [bx + x, by + y];
    const wood = "#c08a4f", woodDark = "#a5733d", woodEdge = "#5e3b1a";
    if (g.isImage) {
      g.place(g.fit);
      const layer = this._boardLayer(g);
      p.ctx.drawImage(layer.cv, p.X(bx + g.ox) - layer.pad, p.Y(by + g.oy) - layer.pad);
      this.drawPegs();
      return;
    }
    if (g.style === "29 Board") {
      const flat = g.spine.map(([x, y]) => L(x, y));
      p.line(flat, { width: 74 * p.sc, fill: shade(this.bg, 0.55), cap: "round", join: "round" });
      p.line(flat, { width: 70 * p.sc, fill: woodEdge, cap: "round", join: "round" });
      p.line(flat, { width: 65 * p.sc, fill: wood, cap: "round", join: "round" });
      p.line(flat, { width: 2 * p.sc, fill: woodDark });
    } else {
      const [box, rad] = g.style === "Cribbagemaster" ? [[22, 24, 478, 812], 8] : [[22, 16, 478, 846], 60];
      this.rrect(bx + box[0] + 4, by + box[1] + 6, bx + box[2] + 4, by + box[3] + 6, rad, { fill: shade(this.bg, 0.55) });
      this.rrect(bx + box[0], by + box[1], bx + box[2], by + box[3], rad, { fill: wood, outline: woodEdge, width: this.W(3) });
      let i = 0;
      for (let gx = box[0] + 18; gx < box[2] - 10; gx += 23, i++) {
        const wob = 6 * Math.sin(i * 1.7);
        p.line([L(gx, box[1] + 14 + Math.abs(wob)), L(gx + wob, box[3] - 14)], { fill: woodDark, width: Math.max(1, p.sc * 0.8) });
      }
      if (g.style === "Cribbagemaster") this.p.text(bx + 250, by + 62, "CRIBBAGE", 26, true, woodEdge, "center", { family: SERIF });
      else this.p.text(bx + 250, by + 428, "CRIB\nBAGE", 44, true, woodDark, "center", { family: SERIF });
    }
    g.guides.forEach((line, k) => {
      p.line(line.map(([x, y]) => L(x, y)), { fill: k < this.engine.n ? shade(this.engine.players[k].color, 0.45) : woodDark, width: this.W(1.2) });
    });
    const hr = 3.3;
    for (let k = 0; k < 3; k++) for (const [x, y] of [...g.holes[k], ...g.start[k]]) p.oval(bx + x - hr, by + y - hr, bx + x + hr, by + y + hr, { fill: "#2a1708" });
    const [fx, fy] = g.finish;
    p.oval(bx + fx - 9, by + fy - 9, bx + fx + 9, by + fy + 9, { outline: "#2a1708", width: this.W(2) });
    p.oval(bx + fx - 4.5, by + fy - 4.5, bx + fx + 4.5, by + fy + 4.5, { fill: "#2a1708" });
    for (const [[x, y], s] of g.labels) this.p.text(bx + x, by + y, s, 10, true, "#3d2410");
    for (const [p1, p2, lp, s] of g.marks) {
      p.line([L(...p1), L(...p2)], { fill: "#7a0d0d", width: this.W(2) });
      this.p.text(bx + lp[0], by + lp[1], s, 10, true, "#7a0d0d");
    }
    this.drawPegs();
  }

  // ----- pegs (with animated movement) -----
  _valD(g, v) { return v <= -1 ? g.start_d[1] : v === 0 ? g.start_d[0] : v >= WIN_SCORE ? g.finish_d : g.hole_d[v - 1]; }
  _pegXY(g, k, v) {
    let [x, y] = g.pegPos(k, v);
    if (v >= WIN_SCORE && !g.perLaneFinish) x += (k - 1) * 5;     // shared finish hole: nudge pegs apart
    return [x, y];
  }
  _syncPegs() {
    const e = this.engine;
    if (this.anim || this.pegDisp.length !== e.players.length) return;
    for (let k = 0; k < e.players.length; k++) {
      const p = e.players[k], [b, f] = this.pegDisp[k];
      if (p.back === b && p.score === f) continue;
      if (p.score > f && p.back === f) {
        const holes = p.score - Math.max(b, 0);
        this.anim = { k, frm: b, to: p.score, fixed: f, t0: now(), dur: Math.min(1.5, 0.30 + 0.04 * holes) };
        return;
      }
      this.pegDisp[k] = [p.back, p.score];         // new game / unusual jump: snap
    }
  }
  _pegAt(x, y, color, front, lift = 0) {
    const p = this.p, sc = p.sc;
    const cx = p.X(x), cy = p.Y(y), pr = 6 * sc * (1 + 0.35 * lift), sh = (2 + 7 * lift) * sc;
    const ctx = p.ctx;
    const circ = (x0, y0, r, fill, stroke = null, lw = 1) => {
      ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    };
    circ(cx + sh * 0.7, cy + sh, pr, "#2a1708");
    circ(cx, cy, pr, color, "#111", Math.max(1, sc * (front ? 1.8 : 1)));
    ctx.beginPath();
    ctx.ellipse(cx - pr * 0.25, cy - pr * 0.35, pr * 0.2, pr * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(color, 1.6); ctx.fill();
  }
  drawPegs() {
    const e = this.engine, g = this.geometry();
    if (this.anim && now() - this.anim.t0 >= this.anim.dur) {
      this.pegDisp[this.anim.k] = [this.anim.fixed, this.anim.to];
      this.anim = null;
    }
    this._syncPegs();
    const a = this.anim;
    e.players.forEach((p, k) => {
      const pegs = a && a.k === k ? [[a.fixed, false]] : (() => { const [b, f] = this.pegDisp[k]; return [[b, false], [f, true]]; })();
      for (const [v, front] of pegs) { const [x, y] = this._pegXY(g, k, v); this._pegAt(x, y, p.color, front); }
    });
    if (!a) return;
    const k = a.k, t = Math.min(1, (now() - a.t0) / a.dur), ease = t * t * (3 - 2 * t);
    if (g.isImage) {
      const v = a.frm + (a.to - a.frm) * ease, i = Math.floor(v), fr = v - i;
      const [x0, y0] = this._pegXY(g, k, i), [x1, y1] = this._pegXY(g, k, Math.min(i + 1, WIN_SCORE));
      this._pegAt(x0 + (x1 - x0) * fr, y0 + (y1 - y0) * fr, e.players[k].color, true, Math.sin(Math.PI * t));
      return;
    }
    const d0 = this._valD(g, a.frm), d1 = this._valD(g, a.to), d = d0 + (d1 - d0) * ease, off = TRACK_OFFSETS[k];
    let x, y;
    const last = g.hole_d[g.hole_d.length - 1];
    if (a.to >= WIN_SCORE && d > last) {
      const blend = (d - last) / (g.finish_d - last);
      [x, y] = g.path.offset(d, off * (1 - blend));
      x += (k - 1) * 5 * blend;
    } else [x, y] = g.path.offset(d, off);
    this._pegAt(x, y, e.players[k].color, true, Math.sin(Math.PI * t));
  }

  // ----- sidebar: portraits + scores + log -----
  drawPortrait(name, x1, y1, x2, y2, color) {
    const img = this.portrait(name), p = this.p;
    if (img) {
      const ctx = p.ctx;
      ctx.save();
      p.rrectPath(x1, y1, x2, y2, 8);
      ctx.clip();
      const [sx, sy, sw, sh] = fitRect(img, x2 - x1, y2 - y1, 0.5, 0.35);
      ctx.drawImage(img, sx, sy, sw, sh, p.X(x1), p.Y(y1), (x2 - x1) * p.sc, (y2 - y1) * p.sc);
      ctx.restore();
    } else {                                       // silhouette until a photo is added
      this.rrect(x1, y1, x2, y2, 8, { fill: "#d9d4c7" });
      const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2;
      p.oval(cx - w * 0.2, y1 + h * 0.18, cx + w * 0.2, y1 + h * 0.18 + w * 0.4, { fill: "#9c968a" });
      p.poly([[cx - w * 0.38, y2 - 5], [cx - w * 0.30, y1 + h * 0.66], [cx - w * 0.12, y1 + h * 0.60], [cx + w * 0.12, y1 + h * 0.60],
        [cx + w * 0.30, y1 + h * 0.66], [cx + w * 0.38, y2 - 5]], { fill: "#9c968a" });
    }
    this.rrect(x1, y1, x2, y2, 8, { outline: color, width: Math.max(2, Math.trunc(3 * p.sc)) });
  }
  personality(i) { return this.session ? this.session.voices.personality(i) : {}; }

  /** Phone sidebar: name across the top, small portrait, big score; no log. */
  _drawSidebarPhone() {
    const e = this.engine, S = this.L.side, x1 = S.x1, x2 = S.x2;
    this.rrect(x1, S.top, x2, S.top + S.head, 10, { fill: shade(this.bg, 0.7), outline: shade(this.bg, 1.3) });
    this.text((x1 + x2) / 2, S.top + S.head / 2, "Score (121)", 14, true, "#f4e9c8");
    let y = S.top + S.head + 6;
    const ch = S.ch[e.n];
    const dealerKnown = !(e.phase === "cutdeal" && e.cutResult !== "done");
    e.players.forEach((p, i) => {
      const active = e.phase === "peg" && e.turn === i && !e.over;
      this.rrect(x1, y, x2, y + ch - 6, 12, { fill: shade(this.bg, active ? 0.5 : 0.7), outline: active ? "#f4c542" : shade(this.bg, 1.3), width: this.W(active ? 3 : 1) });
      this.text(x1 + 10, y + 16, p.name, 15, true, "white", "w");
      this.text(x1 + 10, y + 38, p.human ? "Player" : p.level || "", 10, false, "#cfe3d2", "w");
      const py = y + 52;
      this.drawPortrait(p.name, x1 + 8, py, x1 + 8 + S.pw, py + S.ph, p.color);
      if (dealerKnown && i === e.dealer) {
        this.rrect(x2 - 80, py, x2 - 8, py + 24, 6, { fill: "#f4c542" });
        this.text(x2 - 44, py + 12, "DEALER", 10, true, "#222");
      }
      if (active && !p.human && this.busy) this.text(x2 - 10, py + 40, this.personality(i).thinking || "thinking...", 10, false, "#f4e9c8", "e");
      this.text(x2 - 10, Math.min(y + ch - 30, py + S.ph - 14), String(p.score), 32, true, "white", "e");
      y += ch;
    });
  }

  drawSidebar() {
    if (this.L.side.phone) { this._drawSidebarPhone(); return; }
    const e = this.engine, S = this.L.side, x1 = S.x1, x2 = S.x2, top = S.top;
    this.rrect(x1, top, x2, top + S.head, 10, { fill: shade(this.bg, 0.7), outline: shade(this.bg, 1.3) });
    this.text((x1 + x2) / 2, top + S.head / 2, "Score  (to 121)", 15, true, "#f4e9c8");
    let y = top + S.head + 10;
    const ch = S.ch[e.n];
    const dealerKnown = !(e.phase === "cutdeal" && e.cutResult !== "done");
    e.players.forEach((p, i) => {
      const active = e.phase === "peg" && e.turn === i && !e.over;
      this.rrect(x1, y, x2, y + ch - 8, 12, { fill: shade(this.bg, active ? 0.5 : 0.7), outline: active ? "#f4c542" : shade(this.bg, 1.3), width: this.W(active ? 3 : 1) });
      const pw = S.pw || (ch - 24) * 0.78, ph = S.ph || ch - 24;
      this.drawPortrait(p.name, x1 + 8, y + 8, x1 + 8 + pw, y + 8 + ph, p.color);
      const tx = x1 + pw + 18;
      this.text(tx, y + 20, p.name, 16, true, "white", "w");
      this.text(tx, y + 40, p.human ? "Player" : p.level || "", 11, false, "#cfe3d2", "w");
      if (dealerKnown && i === e.dealer) {
        this.rrect(tx, y + 52, tx + 56, y + 70, 6, { fill: "#f4c542" });
        this.text(tx + 28, y + 61, "DEALER", 10, true, "#222");
      }
      if (active && !p.human && this.busy) this.text(tx, y + 82, this.personality(i).thinking || "thinking...", 11, false, "#f4e9c8", "w", { width: x2 - tx - 6 });
      this.text(x2 - 12, y + ch - 30, String(p.score), 32, true, "white", "e");
      y += ch;
    });
    if (!S.log) return;
    const ly = y + 4;
    this.rrect(x1, ly, x2, S.bottom, 12, { fill: shade(this.bg, 0.7), outline: shade(this.bg, 1.3) });
    this.text(x1 + 12, ly + 16, "Game log  (newest first)", 13, true, "#f4e9c8", "w");
    let yy = ly + 34;
    const width = x2 - x1 - 24;
    for (let i = e.log.length - 1; i >= 0; i--) {
      const lines = this.p.wrap(e.log[i], 12, false, width);
      const hh = lines.length * 12 * 1.28;
      if (yy + hh > S.bottom - 8) break;
      this.text(x1 + 12, yy, e.log[i], 12, false, "#e9efe9", "nw", { width });
      yy += hh + 4;
    }
  }

  drawBubbles() {
    if (!this.session) return;
    if (this.L.side.phone) { this._drawBubblesPhone(); return; }
    const e = this.engine, S = this.L.side, ch = S.ch[e.n];
    for (const [pi, { line }] of this.session.voices.active()) {
      if (pi >= e.n) continue;
      const x1 = S.x1 + 2, x2 = S.x2 - 2, w = x2 - x1;
      const th = this.p.wrap(line, 15, true, w - 24).length * 15 * 1.28;
      const cardBottom = S.top + S.head + 10 + pi * ch + ch - 8;
      const tailX = S.x1 + 8 + (S.pw || (ch - 24) * 0.78) / 2;
      let y1 = cardBottom + 12, y2 = y1 + th + 24;
      if (y2 > S.bottom) { y2 = cardBottom - (S.ph || ch - 24) + 4; y1 = y2 - th - 24; }    // no room below: above instead
      const up = y1 > cardBottom;
      this.rrect(x1 + 3, y1 + 5, x2 + 3, y2 + 5, 16, { fill: shade(this.bg, 0.35) });
      const tail = up ? [[tailX - 12, y1 + 2], [tailX, y1 - 16], [tailX + 12, y1 + 2]] : [[tailX - 12, y2 - 2], [tailX, y2 + 16], [tailX + 12, y2 - 2]];
      this.p.poly(tail, { fill: "#fffdf2", outline: "#5e3b1a", width: Math.max(1, Math.trunc(2 * this.p.sc)) });
      this.rrect(x1, y1, x2, y2, 16, { fill: "#fffdf2", outline: "#5e3b1a", width: Math.max(1, Math.trunc(2 * this.p.sc)) });
      const ty = up ? y1 - 1 : y2 - 3;
      this.rrect(tailX - 10, ty, tailX + 10, ty + 4, 0, { fill: "#fffdf2" });
      this.text((x1 + x2) / 2, (y1 + y2) / 2, line, 15, true, "#3b2412", "center", { width: w - 24, justify: "center" });
    }
  }

  /** Phone: the bubble sits to the left of the speaker's score card, pointing at it. */
  _drawBubblesPhone() {
    const e = this.engine, S = this.L.side, ch = S.ch[e.n];
    for (const [pi, { line }] of this.session.voices.active()) {
      if (pi >= e.n) continue;
      const x2 = S.x1 - 14, x1 = Math.max(this.L.midL, x2 - 330), w = x2 - x1;
      const lines = this.p.wrap(line, 15 * this.ts, true, w - 28);
      const th = lines.length * 15 * this.ts * 1.28;
      const cy = S.top + S.head + 6 + pi * ch + 52 + S.ph / 2;
      let y1 = cy - th / 2 - 12, y2 = cy + th / 2 + 12;
      if (y1 < 4) { y2 += 4 - y1; y1 = 4; }
      const lw = Math.max(1, Math.trunc(2 * this.p.sc));
      this.rrect(x1 + 3, y1 + 5, x2 + 3, y2 + 5, 16, { fill: shade(this.bg, 0.35) });
      this.p.poly([[x2 - 2, cy - 11], [x2 + 14, cy], [x2 - 2, cy + 11]], { fill: "#fffdf2", outline: "#5e3b1a", width: lw });
      this.rrect(x1, y1, x2, y2, 16, { fill: "#fffdf2", outline: "#5e3b1a", width: lw });
      this.rrect(x2 - 4, cy - 9, x2, cy + 9, 0, { fill: "#fffdf2" });
      this.text((x1 + x2) / 2, (y1 + y2) / 2, line, 15, true, "#3b2412", "center", { width: w - 28, justify: "center" });
    }
  }

  // ----- opponents -----
  // ----- opponents -----
  oppAnchors() { return this.L.opp.anchors[this.engine.n]; }
  drawOpponents() {
    const e = this.engine, O = this.L.opp, w = CW * O.k, hh = CH * O.k;
    const ais = [...Array(e.n).keys()].filter((i) => i !== e.human);
    ais.forEach((i, j) => {
      const ax = this.oppAnchors()[j], p = e.players[i];
      const cards = this._visibleCount(p), step = O.step[e.n];
      const x0 = ax - (w + step * Math.max(0, cards - 1)) / 2;
      this.text(ax, O.nameY, p.name + (i === e.dealer ? "  (dealer)" : ""), 17, true, "white");
      for (let k = 0; k < cards; k++) this.drawCard(x0 + k * step, O.y, null, { up: false, w, h: hh });
      if (e.phase === "peg" && e.saidGo.has(i)) this.goBubble(ax, O.goY);
      if (O.thinkY !== null && e.phase === "peg" && e.turn === i && !e.over && this.busy) this.text(ax, O.thinkY, this.personality(i).thinking || "thinking...", 13, false, "#f4e9c8");
    });
  }
  goBubble(cx, cy) {
    this.rrect(cx - 62 + 3, cy - 30 + 4, cx + 62 + 3, cy + 30 + 4, 18, { fill: shade(this.bg, 0.45) });
    this.rrect(cx - 62, cy - 30, cx + 62, cy + 30, 18, { fill: "#fffdf2", outline: "#c8102e", width: Math.max(1, Math.trunc(3.5 * this.p.sc)) });
    this.text(cx, cy, "GO!", 32, true, "#c8102e");
  }
  callout(cx, cy, msg) {
    const w = this.p.measure(msg, 22 * this.ts, true) + 40, L = this.L, hh = 26 * this.ts;
    cx = Math.min(Math.max(cx, L.midL + w / 2), L.midR - w / 2);
    this.rrect(cx - w / 2 + 3, cy - hh + 4, cx + w / 2 + 3, cy + hh + 4, 16, { fill: shade(this.bg, 0.45) });
    this.rrect(cx - w / 2, cy - hh, cx + w / 2, cy + hh, 16, { fill: "#fff8dc", outline: "#e0a800", width: this.W(3) });
    this.text(cx, cy, msg, 22, true, "#8a1c1c");
  }
  cribSpot() {
    const e = this.engine, L = this.L;
    if (e.dealer === e.human) return [...L.crib.own, true];
    const ais = [...Array(e.n).keys()].filter((i) => i !== e.human);
    const ax = this.oppAnchors()[ais.indexOf(e.dealer)];
    const step = L.opp.step[e.n], per = e.n === 2 ? 6 : 5;
    return [ax - (CW * L.opp.k + step * (per - 1)) / 2 - L.crib.gap, L.opp.y, false];
  }
  _visibleCount(p) {
    const e = this.engine;
    if (e.phase === "cutdeal") return 0;
    if (e.phase === "discard") return p.hand.length;
    if (e.phase === "cut") return p.kept.length;
    if (e.phase === "show" || (e.phase === "over" && e.showCurrent)) {
      const pi = e.players.indexOf(p);
      const counted = e.showSteps.slice(0, e.showI + 1).some(([i, k]) => i === pi && k === "hand");
      return counted ? 0 : p.kept.length;
    }
    return p.pegHand.length;
  }

  // ----- centre of the table -----
  drawCenter() {
    const e = this.engine, L = this.L;
    if (e.phase === "cutdeal") { this.drawCutForDeal(); return; }
    const showing = e.phase === "show" || (e.phase === "over" && e.showCurrent !== null);
    if (!showing) {
      const dk = L.deck.k, dw = CW * dk, dh = CH * dk;
      for (let k = 0; k < 4; k++) this.drawCard(L.deck.x - k * 2, L.deck.y - k * 2, null, { up: false, w: dw, h: dh });
      if (L.deck.labelY !== null) this.text(L.deck.x + dw / 2, L.deck.labelY, "Deck", 12, false, "#e7f0e7");
      if (e.starter !== null) {
        this.text(L.starter.x + dw / 2, L.starter.labelY, "Starter", 14, true, "#f4e9c8");
        this.drawCard(L.starter.x, L.starter.y, e.starter, { glow: "#f4c542", w: dw, h: dh });
      }
    }
    const cribShown = showing && e.showCurrent && e.showCurrent[1] === "crib";
    if (e.crib.length && !cribShown) {
      const [cx, cy, own] = this.cribSpot();
      const k = own ? L.crib.k : Math.min(L.crib.k, L.opp.k * 0.8);
      const w = CW * k, hh = CH * k;
      for (let j = 0; j < Math.min(4, e.crib.length); j++) this.drawCard(cx + j * 6 * k / 0.8, cy, null, { up: false, w, h: hh });
      const owner = e.players[e.dealer];
      this.text(cx + w / 2 + 9 * k, cy + hh + 14, owner.human ? "Your crib" : `${owner.name}'s crib`, 12, true, "#f4e9c8");
    }
    if (showing) { this.drawShow(); return; }
    if (["peg", "peg_done", "over"].includes(e.phase)) this.drawPegging();
    else if (e.phase === "discard" || e.phase === "cut") {
      const whose = e.dealer === e.human ? "your" : `${e.players[e.dealer].name}'s`;
      const msg = e.phase === "discard" ? `Choose ${e.nDiscard} card${e.nDiscard > 1 ? "s" : ""} for ${whose} crib` : "Cutting the deck...";
      this.text(L.discardMsg.x, L.discardMsg.y, msg, 20, true, "#f4e9c8", "center", { width: L.discardMsg.w, justify: "center" });
    }
  }

  drawCutForDeal() {
    const e = this.engine, stage = this.cutStage, L = this.L, C = L.cut;
    this.text(L.cx, C.titleY, "Cut for Deal  -  low card deals first", 22, true, "#f4e9c8");
    const span = C.span, x0 = L.cx - ((e.n - 1) * span) / 2, cw = CW * C.k, chh = CH * C.k;
    const lowPi = stage === "done" ? e.dealer : null;
    e.players.forEach((p, i) => {
      const x = x0 + i * span - cw / 2;
      if (e.cutPicks.has(i)) this.drawCard(x, C.cardY, e.cutDeck[e.cutPicks.get(i)], { glow: i === lowPi ? "#f4c542" : null, w: cw, h: chh });
      else {
        this.rrect(x, C.cardY, x + cw, C.cardY + chh, 9, { outline: shade(this.bg, 1.6), dash: [4, 3] });
        this.text(x + cw / 2, C.cardY + chh / 2, "?", 34, true, shade(this.bg, 1.7));
      }
      const nw = this.p.measure(p.name, 16 * this.ts, true) + 18;
      this.p.oval(x + cw / 2 - nw / 2 - 6, C.nameY - 6, x + cw / 2 - nw / 2 + 6, C.nameY + 6, { fill: p.color, outline: "#111" });
      this.text(x + cw / 2 - nw / 2 + 12, C.nameY, p.name, 16, true, "white", "w");
    });
    const left = C.spreadL, right = C.spreadR, base = C.base, n = e.cutDeck.length;
    const step = (right - left - cw) / (n - 1);
    const taken = new Set(e.cutPicks.values());
    for (let idx = 0; idx < n; idx++) {
      if (taken.has(idx)) continue;
      const t = (idx - (n - 1) / 2) / ((n - 1) / 2);
      const x = left + idx * step, y = base - 16 * (1 - t * t);
      this.drawCard(x, y, null, { up: false, simple: idx < n - 1, w: cw, h: chh });
      if (stage === "pick") this.hot(x, y, x + cw, y + chh, () => this.humanCut(idx));
    }
    const msgY = C.msgY, btnY = C.btnY, cx = L.cx;
    if (stage === "pick") this.text(cx, msgY, L.name === "phone" ? "Tap any card in the deck to cut" : "Click any card in the deck to cut", 18, true, "#f4e9c8");
    else if (stage === "ai") this.text(cx, msgY, "Computer cutting...", 18, false, "#f4e9c8");
    else if (stage === "tie") {
      this.text(cx, msgY, "Tie for low card!  Everyone cuts again.", 18, true, "#f4c542");
      this.button(cx - 85, btnY, 170, 46, "Cut Again", () => this.cutAgain(), true);
    } else {
      const d = e.players[e.dealer];
      this.text(cx, msgY, `${d.name} ${d.human ? "have" : "has"} the low card - ${d.human ? "you deal" : d.name + " deals"} first`, 18, true, "white");
      this.button(cx - 75, btnY, 150, 46, "Deal", () => this.beginRound(true), true);
    }
  }

  drawPegging() {
    const e = this.engine, P = this.L.peg;
    const seq = e.seq.length ? e.seq : e.prevSeq;
    const dim = !e.seq.length && e.prevSeq.length > 0;
    const x0 = P.x0, y0 = P.y0, step = seq.length > 9 ? P.step * 0.7 : P.step, cw = CW * P.k, chh = CH * P.k;
    const owners = new Map();
    e.players.forEach((p, i) => p.kept.forEach((c) => owners.set(c, i)));
    seq.forEach((c, k) => this.drawCard(x0 + k * step, y0, c, { dim, glow: e.players[owners.get(c) || 0].color, w: cw, h: chh }));
    if (!seq.length) this.rrect(x0, y0, x0 + cw, y0 + chh, 9 * P.k, { outline: shade(this.bg, 1.5), dash: [4, 3] });
    const [bx1, by1, bx2, by2] = P.box;
    this.rrect(bx1, by1, bx2, by2, 14, { fill: shade(this.bg, 0.6), outline: shade(this.bg, 1.4) });
    this.text((bx1 + bx2) / 2, P.countY, `Count: ${e.count}`, 24, true, "white");
    if (dim && P.restartY !== null) this.text((bx1 + bx2) / 2, P.restartY, "Count starts again at 0", 12, false, "#e7f0e7");
    if (e.lastPlay) this.text(P.lastX, P.lastY, e.lastPlay, 20, true, "white", "center", { width: P.lastW, justify: "center" });
    if (e.lastScore) {
      const n = Math.max(1, seq.length);
      this.callout(x0 + (cw + step * (n - 1)) / 2, P.calloutY ?? y0 + chh / 2, e.lastScore);
    }
  }

  drawShow() {
    const e = this.engine, L = this.L, Sh = L.show;
    const [pi, kind, cards, , total] = e.showCurrent;
    const p = e.players[pi];
    this.text(L.cx, Sh.titleY, `${p.human ? "Your" : p.name + "'s"} ${kind === "hand" ? "hand" : "crib"}`, 22, true, "white");
    let x = Sh.x0;
    const sw = CW * Sh.k, sh = CH * Sh.k;
    for (const c of cards) { this.drawCard(x, Sh.y, c, { w: sw, h: sh }); x += Sh.step; }
    this.text(x + 14 * Sh.k + sw / 2, Sh.y - 10, "Starter", 11, false, "#e7f0e7");
    this.drawCard(x + 14 * Sh.k, Sh.y, e.starter, { glow: "#f4c542", w: sw, h: sh });
    let tot = total === 0 ? "Nineteen! (0 points)" : `${total} point${total !== 1 ? "s" : ""}`;
    if (this.hideTotal) tot = "Count it yourself...";
    this.text(L.cx, Sh.totalY, tot, 26, true, "#f4c542");
    if (this.countMsg) this.text(L.cx, Sh.msgY, this.countMsg, 18, true, this.countMsg.startsWith("Correct") ? "#9be39b" : "#ffb3a7");
    this.text(L.cx, Sh.ofY, `Counting ${e.showI + 1} of ${e.showSteps.length}`, 12, false, "#e7f0e7");
    if (e.phase === "show" && !this.hideTotal) {
      this.button(Sh.btnX[0], Sh.btnY, 160, 44, "Show Count", () => { this.overlay = "breakdown"; this.requestRedraw(); });
      const last = e.showI + 1 >= e.showSteps.length;
      this.button(Sh.btnX[1], Sh.btnY, 160, 44, last ? "Next Hand" : "Continue", () => this.showStep(), true);
    }
  }

  // ----- the human's hand -----
  // ----- the human's hand -----
  drawHumanArea() {
    const e = this.engine, me = e.players[e.human], L = this.L, Hd = L.hand;
    let cards;
    if (e.phase === "discard") cards = me.hand;
    else if (e.phase === "peg" || e.phase === "peg_done") cards = me.pegHand;
    else if (e.phase === "cut" || e.phase === "show") cards = me.kept;
    else if (e.phase === "over") cards = e.showCurrent ? me.kept : me.pegHand;
    else cards = [];
    const w = CW * Hd.k, hh = CH * Hd.k;
    const n = cards.length, step = Hd.step;
    const x0 = n ? L.cx - (w + step * (n - 1)) / 2 : L.cx;
    const legal = e.phase === "peg" && e.awaiting === "play" ? new Set(e.legal(e.human)) : null;
    const dragging = this.drag ? this.drag.card : null;
    cards.forEach((c, k) => {
      const x = x0 + k * step;
      const sel = this.selected.has(c) || c === this.pegSel;
      const y = Hd.y - (sel ? Hd.lift : 0);
      const dim = legal !== null && !legal.has(c);
      if (c === dragging) { this.rrect(x, y, x + w, y + hh, 9 * Hd.k, { outline: shade(this.bg, 1.5), dash: [4, 3] }); return; }
      this.drawCard(x, y, c, { selected: sel, dim, w, h: hh });
      if (e.phase === "discard" && !this.busy) this.hot(x, y, x + w, y + hh, () => this.toggleSelect(c), null, c);
      else if (e.phase === "peg" && e.awaiting === "play") this.hot(x, y, x + w, y + hh, () => this.selectPegCard(c), () => this.humanPlay(c), c);
    });
    const phone = L.name === "phone";
    let prompt = "";
    if (e.phase === "discard") {
      const whose = e.dealer === e.human ? "your" : `${e.players[e.dealer].name}'s`;
      const need = e.nDiscard - this.selected.size;
      prompt = need ? `Select ${need} more card${need !== 1 ? "s" : ""} for ${whose} crib` + (Hd.short ? "" : "  (tap, or drag up)") : "Ready - send to the crib";
      const label = e.dealer === e.human ? "Send to Your Crib" : e.n === 2 ? "Send to Opponent's Crib" : `Send to ${e.players[e.dealer].name}'s Crib`;
      this.button(L.cx - 140, Hd.btnY, 280, 46, label, () => this.doDiscard(), true, need === 0 && !this.busy);
    } else if (e.phase === "peg") {
      if (e.awaiting === "play") {
        prompt = phone ? "Your turn - double-tap a card, or drag it up to play" : "Your turn - double-click a card, or drag it up to play";
        if (this.pegSel !== null) this.button(L.cx - 85, Hd.btnY, 170, 46, "Play Card", () => this.humanPlay(this.pegSel), true);
      } else if (e.awaiting === "go") {
        prompt = "You can't play without going over 31";
        this.button(L.cx - 60, Hd.btnY, 120, 46, "Go", () => this.humanGo(), true);
      }
    }
    if (this.flash && e.phase === "peg") prompt = this.flash;
    if (e.phase === "peg" && e.saidGo.has(e.human)) this.goBubble(L.cx, Hd.y + hh / 2);
    if (prompt) this.text(L.cx, Hd.promptY, prompt, 17, true, "#f4e9c8");
    if (Hd.nameY !== null) {
      this.text(L.midL, Hd.nameY, me.name + (e.dealer === e.human ? "  (dealer)" : ""), 16, true, "white", "w");
      this.text(L.midR - 7, Hd.nameY, `${e.n} players  |  F2 = new game`, 11, false, shade(this.bg, 1.8), "e");
    }
  }

  drawDrag() {
    const d = this.drag;
    if (!d) return;
    const e = this.engine, cards = this._handList(), L = this.L, k = L.hand.k;
    if (!cards || !cards.includes(d.card)) { this.drag = null; return; }
    if (d.zone === "table") {
      const [x1, y1, x2, y2] = L.dragRect;
      this.rrect(x1, y1, x2, y2, 18, { outline: "#f4c542", width: this.W(3), dash: [8, 5] });
      this.text((x1 + x2) / 2, L.dragTextY, e.phase === "discard" ? "Release to send to the crib" : "Release to play", 16, true, "#f4c542");
    }
    this.drawCard(d.lx - d.dx, d.ly - d.dy, d.card, { glow: "#f4c542", w: CW * k, h: CH * k });
  }

  // ----- overlays -----
  // ----- overlays -----
  panel(x1, y1, x2, y2) {
    this.rrect(x1 + 6, y1 + 8, x2 + 6, y2 + 8, 16, { fill: shade(this.bg, 0.4) });
    this.rrect(x1, y1, x2, y2, 16, { fill: "#fbf7ea", outline: "#5e3b1a", width: this.W(3) });
  }
  drawBreakdown() {
    const e = this.engine;
    const [pi, kind, cards, items, total] = e.showCurrent;
    const p = e.players[pi];
    const B = this.L.breakdown, x1 = B.x1, y1 = B.y1, x2 = B.x2;
    const y2 = Math.max(B.ymin, Math.min(B.ymax, y1 + 190 + 26 * this.ts * Math.max(1, items.length) + 90));
    this.panel(x1, y1, x2, y2);
    this.text((x1 + x2) / 2, y1 + 28, `${p.human ? "Your" : p.name + "'s"} ${kind === "hand" ? "hand" : "crib"} - ${total} points`, 20, true, "#222");
    let x = (x1 + x2) / 2 - (5 * 64 + 14) / 2;
    for (const c of cards) { this.drawCard(x, y1 + 52, c, { w: 58, h: 82 }); x += 64; }
    this.drawCard(x + 14, y1 + 52, e.starter, { w: 58, h: 82, glow: "#e0a800" });
    let y = y1 + 156;
    this.text(x1 + 30, y, "Combination", 13, true, "#555", "w");
    this.text(x1 + 200, y, "Cards", 13, true, "#555", "w");
    this.text(x2 - 110, y, "Pts", 13, true, "#555", "e");
    this.text(x2 - 30, y, "Total", 13, true, "#555", "e");
    this.p.line([[x1 + 24, y + 14], [x2 - 24, y + 14]], { fill: "#bbb", width: Math.max(1, this.p.sc) });
    const lh = Math.min(26 * this.ts, (y2 - 80 - (y + 26)) / Math.max(1, items.length));
    y += 30;
    let run = 0, fifteenN = 0;
    if (!items.length) this.text((x1 + x2) / 2, y + 30, 'No points - "nineteen"', 18, true, "#8a1c1c");
    for (let [label, cs, pts] of items) {
      run += pts;
      if (label === "Fifteen") { fifteenN += 2; label = `Fifteen ${fifteenN}`; }
      this.text(x1 + 30, y, label, 15, false, "#222", "w");
      let cx = x1 + 200;
      for (const c of cs) {
        const nm = cardName(c);
        this.text(cx, y, nm, 15, true, RED_SUITS.has(SUIT[c]) ? "#c8102e" : "#141414", "w");
        cx += this.p.measure(nm, 15 * this.ts, true) + 8;
      }
      this.text(x2 - 110, y, `+${pts}`, 15, false, "#222", "e");
      this.text(x2 - 30, y, String(run), 15, true, "#222", "e");
      y += lh;
    }
    this.button((x1 + x2) / 2 - 70, y2 - 62, 140, 44, "Close", () => { this.overlay = null; this.requestRedraw(); }, true);
    this.p.hotspots.unshift({ x1: 0, y1: 0, x2: this.L.W, y2: this.L.H, cb: () => {}, dbl: null, card: null });   // swallow clicks elsewhere
  }

  /** Phone game-over: result and scores on the left, record and medals on the right. */
  _drawGameoverPhone() {
    const e = this.engine, res = e.result();
    const [x1, y1, x2, y2] = this.L.gameover, mid = (x1 + x2) / 2;
    this.panel(x1, y1, x2, y2);
    const w = e.players[e.winner];
    const lx = x1 + 34, lc = (x1 + mid) / 2;
    this.text(lc, y1 + 52, res.won ? "You win!" : `${w.name} wins`, 34, true, res.won ? "#1e6b34" : "#8a1c1c");
    let sub = "";
    if (res.won && res.skunkGiven) sub = res.skunkGiven === "double" ? "Double skunk!" : "Skunk!";
    else if (!res.won && res.skunked) sub = res.skunked === "double" ? "You were double skunked" : "You were skunked";
    let y = y1 + 104;
    if (sub) { this.text(lc, y, sub, 18, true, "#a0522d"); y += 40; }
    for (const p of [...e.players].sort((a, b) => b.score - a.score)) {
      this.p.oval(lx, y - 11, lx + 22, y + 11, { fill: p.color, outline: "#111" });
      this.text(lx + 34, y, p.name, 18, true, "#222", "w");
      this.text(mid - 24, y, String(p.score), 20, true, "#222", "e");
      y += 44;
    }
    this.p.line([[mid, y1 + 24], [mid, y2 - 96]], { fill: "#d8cdb2", width: this.W(1.5) });
    const b = this.host.stats.aggregate(e.n, e.difficulty);
    const rx = mid + 28, rc = (mid + x2) / 2;
    this.text(rc, y1 + 40, `Lifetime record vs ${e.difficulty}`, 14, true, "#5e3b1a");
    this.text(rc, y1 + 72, `${b.wins} win${b.wins === 1 ? "" : "s"} - ${b.losses} loss${b.losses === 1 ? "" : "es"}`, 18, true, "#222");
    const tr = this.host.tracker;
    if (tr) {
      const nw = tr.newThisGame;
      let ay = y1 + 120;
      this.text(rc, ay, nw.length ? `New medals: ${nw.length}` : "No new medals this game", 14, true, "#5e3b1a");
      for (const [a, t] of nw.slice(0, 4)) {
        ay += 40;
        const tn = a.tierName(t);
        this.p.oval(rx, ay - 11, rx + 22, ay + 11, { fill: MEDAL_COLORS[tn], outline: MEDAL_DARK[tn] });
        this.text(rx + 32, ay, `${a.name} (${tn})`, 14, false, "#222", "w", { width: x2 - rx - 60 });
      }
      if (nw.length > 4) this.text(rx + 32, ay + 34, `...and ${nw.length - 4} more`, 12, false, "#666", "w");
    }
    const go = (name) => () => this.host.onGameOverButton?.(name);
    const labels = [["New Game", go("new"), true], ["Medals", go("achievements"), false], ["Stats", go("stats"), false], ["Quit", go("quit"), false]];
    const bw = 170, gap = 14, bx = mid - (4 * bw + 3 * gap) / 2;
    labels.forEach(([lbl, cb, prim], i) => this.button(bx + i * (bw + gap), y2 - 76, bw, 56, lbl, cb, prim, true, 16));
  }

  drawGameover() {
    if (this.L.name === "phone") { this._drawGameoverPhone(); return; }
    const e = this.engine, res = e.result();
    const [x1, y1, x2, y2] = this.L.gameover;
    this.panel(x1, y1, x2, y2);
    const w = e.players[e.winner];
    this.text((x1 + x2) / 2, y1 + 50, res.won ? "You win!" : `${w.name} wins`, 34, true, res.won ? "#1e6b34" : "#8a1c1c");
    let sub = "";
    if (res.won && res.skunkGiven) sub = res.skunkGiven === "double" ? "Double skunk!" : "Skunk!";
    else if (!res.won && res.skunked) sub = res.skunked === "double" ? "You were double skunked" : "You were skunked";
    if (sub) this.text((x1 + x2) / 2, y1 + 96, sub, 20, true, "#a0522d");
    let y = y1 + 140;
    for (const p of [...e.players].sort((a, b) => b.score - a.score)) {
      this.p.oval(x1 + 110, y - 9, x1 + 128, y + 9, { fill: p.color, outline: "#111" });
      this.text(x1 + 140, y, p.name, 18, true, "#222", "w");
      this.text(x2 - 110, y, String(p.score), 20, true, "#222", "e");
      y += 36;
    }
    const b = this.host.stats.aggregate(e.n, e.difficulty);
    const mixed = new Set(e.levels).size > 1;
    let note = `vs ${mixed ? e.levels.join(" & ") : e.difficulty} (${e.n} players) - lifetime record ${b.wins}-${b.losses}`;
    if (mixed) note += `  [filed under ${e.difficulty}]`;
    this.text((x1 + x2) / 2, y + 22, note, 13, false, "#444", "center", { width: 480, justify: "center" });
    const tr = this.host.tracker;
    if (tr) {
      const nw = tr.newThisGame;
      let ay = y + 56;
      this.text((x1 + x2) / 2, ay, nw.length ? `Achievements earned this game: ${nw.length}` : "No new achievements this game", 14, true, "#5e3b1a");
      for (const [a, t] of nw.slice(0, 5)) {
        ay += 28;
        const tn = a.tierName(t);
        this.p.oval(x1 + 120, ay - 9, x1 + 138, ay + 9, { fill: MEDAL_COLORS[tn], outline: MEDAL_DARK[tn] });
        this.text(x1 + 148, ay, `${a.name}  (${tn})`, 14, false, "#222", "w");
      }
      if (nw.length > 5) this.text(x1 + 148, ay + 26, `...and ${nw.length - 5} more`, 12, false, "#666", "w");
    }
    const go = (name) => () => this.host.onGameOverButton?.(name);
    const labels = [["New Game", go("new"), true]];
    if (tr) labels.push(["Achievements", go("achievements"), false]);
    labels.push(["Statistics", go("stats"), false], ["Quit", go("quit"), false]);
    const bw = 124, gap = 8;
    const bx = (x1 + x2) / 2 - (labels.length * bw + (labels.length - 1) * gap) / 2;
    labels.forEach(([lbl, cb, prim], i) => this.button(bx + i * (bw + gap), y2 - 72, bw, 48, lbl, cb, prim, true, 14));
  }
}
