// Board geometry (ported from cribbage.py): drawn boards follow a centre-line path with
// three tracks beside it; picture boards use a hole map.  All in a 500 x 860 board space.
// Code: (c) Corey J Ruff
import { WIN_SCORE } from "../engine.js";

export const TRACK_OFFSETS = [-11.0, 0.0, 11.0];
export const GROUP_GAP = 0.8;          // extra gap between groups of five (fraction of hole spacing)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rad = (d) => d * (Math.PI / 180);          // same rounding as Python math.radians

export class Polyline {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + dist(pts[i - 1], pts[i]));
  }
  get length() { return this.cum[this.cum.length - 1]; }
  at(d) {
    const p = this.pts, cum = this.cum, L = cum.length;
    if (d <= 0) {
      const [[x0, y0], [x1, y1]] = [p[0], p[1]];
      const seg = cum[1] || 1;
      return [x0 + ((x1 - x0) * d) / seg, y0 + ((y1 - y0) * d) / seg];
    }
    if (d >= cum[L - 1]) {
      const [[x0, y0], [x1, y1]] = [p[L - 2], p[L - 1]];
      const seg = cum[L - 1] - cum[L - 2] || 1;
      const e = d - cum[L - 1];
      return [x1 + ((x1 - x0) * e) / seg, y1 + ((y1 - y0) * e) / seg];
    }
    let lo = 0, hi = L;                                    // bisect_right(cum, d) - 1
    while (lo < hi) { const m = (lo + hi) >> 1; if (d < cum[m]) hi = m; else lo = m + 1; }
    const i = lo - 1;
    const seg = cum[i + 1] - cum[i] || 1;
    const t = (d - cum[i]) / seg;
    return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
  }
  normal(d) {
    const c = Math.min(Math.max(d, 0), this.length);
    const a = this.at(c - 3), b = this.at(c + 3);
    const tx = b[0] - a[0], ty = b[1] - a[1];
    const m = Math.hypot(tx, ty) || 1;
    return [-ty / m, tx / m];
  }
  offset(d, off) {
    const [x, y] = this.at(d), [nx, ny] = this.normal(d);
    return [x + nx * off, y + ny * off];
  }
}

export function arc(cx, cy, r, a0, a1, step = 3.0) {
  const n = Math.max(2, Math.trunc(Math.abs(a1 - a0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function roundCorners(pts, radius) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    let ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-6 || lv < 1e-6) continue;
    ux /= lu; uy /= lu; vx /= lv; vy /= lv;
    const phi = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (Math.PI - phi < rad(20)) { out.push(b); continue; }
    const t = Math.min(radius / Math.tan(phi / 2), 0.45 * lu, 0.45 * lv);
    const r = t * Math.tan(phi / 2);
    const p1 = [b[0] + ux * t, b[1] + uy * t], p2 = [b[0] + vx * t, b[1] + vy * t];
    const wx = ux + vx, wy = uy + vy, wm = Math.hypot(wx, wy);
    const dd = r / Math.sin(phi / 2);
    const cx = b[0] + (wx / wm) * dd, cy = b[1] + (wy / wm) * dd;
    const a1 = Math.atan2(p1[1] - cy, p1[0] - cx), a2 = Math.atan2(p2[1] - cy, p2[0] - cx);
    const pm = (x, m) => ((x % m) + m) % m;               // Python-style modulo
    const da = pm(a2 - a1 + Math.PI, 2 * Math.PI) - Math.PI;
    const steps = Math.max(3, Math.trunc(Math.abs(da) / rad(6)));
    for (let k = 0; k <= steps; k++) {
      const ang = a1 + (da * k) / steps;
      out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function pieces(style) {
  if (style === "29 Board") {
    const two = [...arc(120, 240, 82, 165, 400), [38, 790], [230, 790]];
    const bridge = [[230, 790], [462, 790], [462, 720]];
    const nine = [[462, 720], ...arc(380, 250, 82, 360, 90)];
    return [[two, 65], [bridge, 0], [nine, 55]];
  }
  if (style === "Cribbagemaster") {
    const xs = [85, 195, 305, 415], top = 165, bot = 715, r = 55;
    return [
      [[[xs[0], bot], [xs[0], top]], 30], [arc(140, top, r, 180, 360), 0],
      [[[xs[1], top], [xs[1], bot]], 30], [arc(250, bot, r, 180, 0), 0],
      [[[xs[2], bot], [xs[2], top]], 30], [arc(360, top, r, 180, 360), 0],
      [[[xs[3], top], [xs[3], bot]], 30],
    ];
  }
  // Traditional Loop: a long racetrack loop, start & finish at the bottom
  const cb = [250, 650], ct = [250, 205], r = 155;
  const loop = [...arc(cb[0], cb[1], r, 106, 180), ...arc(ct[0], ct[1], r, 180, 360), ...arc(cb[0], cb[1], r, 0, 74)];
  return [[loop, 120]];
}

export class BoardGeometry {
  constructor(style) {
    this.style = style;
    const pcs = pieces(style);
    let pts = [];
    this.hole_d = [];
    let base = 0;
    for (const [ppts, n] of pcs) {
      let seg = roundCorners(ppts, 32);
      const length = new Polyline(seg).length;
      if (n) {
        const s = length / (n + (n / 5 - 1) * GROUP_GAP);
        for (let i = 0; i < n; i++) this.hole_d.push(base + s * 0.5 + i * s + Math.floor(i / 5) * GROUP_GAP * s);
      }
      base += length;
      if (pts.length && dist(pts[pts.length - 1], seg[0]) < 1e-6) seg = seg.slice(1);
      pts = pts.concat(seg);
    }
    this.path = new Polyline(pts);
    const hd = this.hole_d, N = hd.length;
    const s0 = hd[1] - hd[0];
    this.start_d = [-0.9 * s0, -1.9 * s0];                   // front start hole, back start hole
    const s1 = hd[N - 1] - hd[N - 2];
    this.finish_d = hd[N - 1] + 1.9 * s1;
    this.ext = [this.start_d[1] - 0.9 * s0, this.finish_d + 0.8 * s1];
    const P = this.path;
    this.holes = TRACK_OFFSETS.map((off) => hd.map((d) => P.offset(d, off)));
    this.start = TRACK_OFFSETS.map((off) => this.start_d.map((d) => P.offset(d, off)));
    this.finish = P.at(this.finish_d);
    const is29 = style === "29 Board";
    const span = TRACK_OFFSETS[2] + (is29 ? 11 : 13);
    const lab = is29 ? 24 : span + 8;
    this.labels = [];
    for (let h = 5; h <= 120; h += 5) if (h % 10 === 0 || h === 5) this.labels.push([P.offset(hd[h - 1], -lab), String(h)]);
    this.marks = [[90, "S"], [60, "SS"]].map(([h, txt]) => {
      const d = (hd[h - 1] + hd[h]) / 2;
      return [P.offset(d, TRACK_OFFSETS[0] - 6), P.offset(d, TRACK_OFFSETS[2] + 6), P.offset(d, is29 ? lab : span + 6), txt];
    });
    const [d0, d1] = [this.start_d[1], this.finish_d];
    let steps = Math.trunc((d1 - d0) / 4) + 1;
    this.guides = TRACK_OFFSETS.map((off) => Array.from({ length: steps + 1 }, (_, i) => P.offset(d0 + ((d1 - d0) * i) / steps, off)));
    steps = Math.trunc((this.ext[1] - this.ext[0]) / 4) + 1;
    this.spine = Array.from({ length: steps + 1 }, (_, i) => P.at(this.ext[0] + ((this.ext[1] - this.ext[0]) * i) / steps));
  }
  pegPos(track, value) {
    if (value >= WIN_SCORE) return this.finish;
    if (value <= -1) return this.start[track][1];
    if (value === 0) return this.start[track][0];
    return this.holes[track][value - 1];
  }
}

/** A board drawn from a picture plus a hole map (JSON).  Same interface for pegs. */
export class ImageBoard {
  static AREA_W = 500;
  static AREA_H = 860;
  constructor(style, map, image) {
    this.style = style;
    this.isImage = true;
    this.image = image;
    [this.W, this.H] = map.size;
    this.rawTracks = map.tracks;
    if (this.rawTracks.length !== 3 || !this.rawTracks.every((t) => t.length === 122)) throw new Error("bad hole map");
    this.rawFinish = map.finish;
    this.fit = Math.min(ImageBoard.AREA_W / this.W, ImageBoard.AREA_H / this.H);
    this.place(this.fit);
  }
  place(f) {
    this.f = f;
    this.ox = (ImageBoard.AREA_W - this.W * f) / 2;
    this.oy = (ImageBoard.AREA_H - this.H * f) / 2;
    const conv = (p) => [this.ox + p[0] * f, this.oy + p[1] * f];
    this.start = this.rawTracks.map((t) => [conv(t[1]), conv(t[0])]);       // [front, back]
    this.holes = this.rawTracks.map((t) => t.slice(2).map(conv));
    this.perLaneFinish = Array.isArray(this.rawFinish[0]);
    if (this.perLaneFinish) { this.finishes = this.rawFinish.map(conv); this.finish = this.finishes[1]; }
    else { this.finishes = null; this.finish = conv(this.rawFinish); }
  }
  pegPos(track, value) {
    if (value >= WIN_SCORE && this.perLaneFinish) return this.finishes[track];
    return BoardGeometry.prototype.pegPos.call(this, track, value);
  }
}

export const IMAGE_BOARDS = { "29 Board": "29_board.json", "Cribbagemaster": "cribbagemaster.json", "Traditional": "traditional.json" };

/** Load a board (picture boards fall back to the drawn style if their files are missing). */
export async function loadGeometry(style, base = "boards/") {
  const fn = IMAGE_BOARDS[style];
  if (fn && typeof fetch !== "undefined") {
    try {
      const map = await (await fetch(base + fn)).json();
      const img = new Image();
      img.src = base + map.image;
      await img.decode();
      return new ImageBoard(style, map, img);
    } catch (err) {
      console.warn(`Picture board unavailable (${err}); using the drawn ${style}.`);
    }
  }
  return new BoardGeometry(style);
}
