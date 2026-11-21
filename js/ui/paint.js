// Canvas drawing helpers that mirror the Tkinter canvas calls used by the Python version.
// Everything is drawn in a fixed 1400 x 880 "logical" table that is scaled to fit the window.
// Code: (c) Corey J Ruff

export const LW = 1400, LH = 880;            // logical table size
export const FONT = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", serif';

const hex2 = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
const rgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };

/** factor < 1 darkens, > 1 lightens (same as Python shade()). */
export function shade(hex, factor) {
  let [r, g, b] = rgb(hex);
  if (factor < 1) [r, g, b] = [r, g, b].map((v) => Math.trunc(v * factor));
  else { const f = factor - 1; [r, g, b] = [r, g, b].map((v) => Math.trunc(v + (255 - v) * f)); }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}
/** Blend colour a toward b by t (0..1). */
export function mix(a, b, t) {
  const ca = rgb(a), cb = rgb(b);
  return "#" + ca.map((x, i) => hex2(Math.trunc(x + (cb[i] - x) * t))).join("");
}

export class Painter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hotspots = [];
    this.sc = 1; this.ox = 0; this.oy = 0;
  }

  /** Size the canvas to its box (sharp on high-DPI screens) and clear it. */
  begin(bg, lw = LW, lh = LH) {
    const c = this.canvas, dpr = window.devicePixelRatio || 1;
    const w = Math.max(50, c.clientWidth), h = Math.max(50, c.clientHeight);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    this.dpr = dpr;
    this.sc = Math.min(pw / lw, ph / lh);
    this.ox = (pw - lw * this.sc) / 2;
    this.oy = (ph - lh * this.sc) / 2;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pw, ph);
    this.hotspots = [];
  }
  X(x) { return this.ox + x * this.sc; }
  Y(y) { return this.oy + y * this.sc; }
  /** Screen (CSS px) point to logical table point. */
  toLogical(cssX, cssY) { return [(cssX * this.dpr - this.ox) / this.sc, (cssY * this.dpr - this.oy) / this.sc]; }

  font(size, bold = false, family = FONT) {
    return `${bold ? "bold " : ""}${Math.max(6, Math.round(size * this.sc))}px ${family}`;
  }
  _stroke(o) {
    const ctx = this.ctx;
    if (!o.outline) return;
    ctx.strokeStyle = o.outline;
    ctx.lineWidth = o.width || Math.max(1, this.sc);
    ctx.setLineDash(o.dash ? o.dash.map((d) => d * Math.max(1, this.sc)) : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  _fill(o) { if (o.fill) { this.ctx.fillStyle = o.fill; this.ctx.fill(); } }

  rrectPath(x1, y1, x2, y2, r) {
    const ctx = this.ctx;
    const X1 = this.X(x1), Y1 = this.Y(y1), w = (x2 - x1) * this.sc, h = (y2 - y1) * this.sc;
    ctx.beginPath();
    ctx.roundRect(X1, Y1, w, h, Math.max(0, Math.min(r * this.sc, Math.abs(w) / 2, Math.abs(h) / 2)));
  }
  /** Rounded rectangle.  o: { fill, outline, width (screen px), dash } */
  rrect(x1, y1, x2, y2, r, o = {}) { this.rrectPath(x1, y1, x2, y2, r); this._fill(o); this._stroke(o); }

  oval(x1, y1, x2, y2, o = {}) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(this.X((x1 + x2) / 2), this.Y((y1 + y2) / 2), Math.abs(x2 - x1) * this.sc / 2, Math.abs(y2 - y1) * this.sc / 2, 0, 0, Math.PI * 2);
    this._fill(o); this._stroke(o);
  }
  /** Polygon from logical points [[x,y],...].  smooth: Tk-style curved outline. */
  poly(pts, o = {}) {
    const ctx = this.ctx;
    const P = pts.map(([x, y]) => [this.X(x), this.Y(y)]);
    ctx.beginPath();
    if (o.smooth && P.length > 2) {
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const n = P.length;
      const m0 = mid(P[n - 1], P[0]);
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const m = mid(P[i], P[(i + 1) % n]);
        ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]);
      }
    } else {
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    }
    ctx.closePath();
    this._fill(o); this._stroke(o);
  }
  /** Line through logical points.  o: { fill (colour), width (screen px), cap, join, dash } */
  line(pts, o = {}) {
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(this.X(x), this.Y(y)) : ctx.moveTo(this.X(x), this.Y(y))));
    ctx.strokeStyle = o.fill || "#000";
    ctx.lineWidth = o.width || Math.max(1, this.sc);
    ctx.lineCap = o.cap || "butt";
    ctx.lineJoin = o.join || "miter";
    ctx.setLineDash(o.dash ? o.dash.map((d) => d * Math.max(1, this.sc)) : []);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  }
  image(img, x, y, w, h) { this.ctx.drawImage(img, this.X(x), this.Y(y), w * this.sc, h * this.sc); }

  /** Width of text in logical units. */
  measure(s, size, bold = false, family = FONT) {
    this.ctx.font = this.font(size, bold, family);
    return this.ctx.measureText(s).width / this.sc;
  }
  /** Break text into lines no wider than `width` (logical); keeps explicit newlines. */
  wrap(s, size, bold, width, family = FONT) {
    const out = [];
    for (const para of String(s).split("\n")) {
      if (!width) { out.push(para); continue; }
      let line = "";
      for (const word of para.split(" ")) {
        const t = line ? line + " " + word : word;
        if (line && this.measure(t, size, bold, family) > width) { out.push(line); line = word; }
        else line = t;
      }
      out.push(line);
    }
    return out;
  }
  /**
   * Text like Tk create_text.  anchor: center | nw | w | e | ne | n.  o: { width (logical wrap),
   * justify, family }.  Returns the logical height used.
   */
  text(x, y, s, size = 14, bold = false, fill = "white", anchor = "center", o = {}) {
    const ctx = this.ctx;
    const family = o.family || FONT;
    const lines = this.wrap(s, size, bold, o.width, family);
    const lh = size * 1.28;
    const total = lh * lines.length;
    ctx.font = this.font(size, bold, family);
    ctx.fillStyle = fill;
    ctx.textBaseline = "middle";
    const a = anchor === "center" ? "" : anchor;            // compass anchors: n, ne, e, se, s, sw, w, nw
    const horiz = a.endsWith("w") ? "left" : a.endsWith("e") ? "right" : "center";
    const top = a.startsWith("n") ? y : a.startsWith("s") ? y - total : y - total / 2;
    let widest = 0;
    if (o.justify === "center" && horiz !== "center") for (const l of lines) widest = Math.max(widest, this.measure(l, size, bold, family));
    lines.forEach((l, i) => {
      let lx = x, align = horiz;
      if (o.justify === "center" && horiz === "left") { lx = x + widest / 2; align = "center"; }
      ctx.textAlign = align;
      ctx.fillText(l, this.X(lx), this.Y(top + lh * (i + 0.5)));
    });
    return total;
  }

  /** Clickable area (logical coords).  card: a card id makes it draggable. */
  hot(x1, y1, x2, y2, cb, dbl = null, card = null) { this.hotspots.push({ x1, y1, x2, y2, cb, dbl, card }); }
  hit(lx, ly) {
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i];
      if (h.x1 <= lx && lx <= h.x2 && h.y1 <= ly && ly <= h.y2) return h;
    }
    return null;
  }

  /** Draw with a soft shadow behind (canvas shadow), e.g. picture boards. */
  withShadow(color, blur, dx, dy, fn) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy;
    fn();
    ctx.restore();
  }
}
