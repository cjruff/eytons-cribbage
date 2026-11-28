// Menu bar and pop-up windows (the HTML side of the game).
// Code: (c) Corey J Ruff

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Tiny element builder: h("div.cls#id", { attrs, on: {click} }, children...) */
export function h(tag, props = {}, ...kids) {
  const [, name, rest] = tag.match(/^([a-z0-9]+)(.*)$/i);
  const el = document.createElement(name);
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) (m[1] === "." ? el.classList.add(m[2]) : (el.id = m[2]));
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}

// ------------------------------------------------------------- windows
const stack = [];

/** Is any window open? (the table ignores keys while one is) */
export const windowOpen = () => stack.length > 0;

/**
 * Open a modal window.  opts: { title, width, body: Element|[Element], buttons: [[label, fn, primary]],
 * onClose, wide }.  Returns { el, close }.  A button fn returning false keeps the window open.
 */
export function openWindow({ title, width = 460, body, buttons = [["OK", null, true]], onClose = null, cls = "", backCls = "" }) {
  const back = h("div.win-back" + (backCls ? "." + backCls : ""));
  const content = h("div.win-body");
  content.append(...[].concat(body));
  const win = h("div.win" + (cls ? "." + cls : ""), { role: "dialog", "aria-label": title, style: { width: typeof width === "number" ? width + "px" : width } },
    h("div.win-title", {}, h("span", {}, title), h("button.win-x", { title: "Close", on: { click: () => close() } }, "×")),
    content,
    buttons.length ? h("div.win-buttons", {}, ...buttons.map(([label, fn, primary, left]) =>
      h("button" + (primary ? ".primary" : "") + (left ? ".left" : ""), { on: { click: () => { if (fn && fn() === false) return; if (!left || fn === null) close(); } } }, label))) : null);
  back.append(win);
  document.body.append(back);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    back.remove();
    document.querySelectorAll(".combo-list").forEach((el) => el.remove());
    const i = stack.indexOf(api);
    if (i >= 0) stack.splice(i, 1);
    if (onClose) onClose();
  }
  const api = { el: win, body: content, close };
  stack.push(api);
  back.addEventListener("pointerdown", (ev) => { if (ev.target === back) win.classList.add("nudge"), setTimeout(() => win.classList.remove("nudge"), 200); });
  setTimeout(() => (win.querySelector("[autofocus]") || win.querySelector(".win-buttons .primary") || win).focus({ preventScroll: true }), 20);
  win.tabIndex = -1;
  return api;
}

/** Yes / No question.  Resolves true or false. */
export function confirmBox(title, message, yes = "Yes", no = "No") {
  return new Promise((res) => {
    let answer = false;
    openWindow({
      title, width: 420, body: h("p.msg", { html: esc(message).replace(/\n/g, "<br>") }),
      buttons: [[no, null, false], [yes, () => { answer = true; }, true]],
      onClose: () => res(answer),
    });
  });
}
export function messageBox(title, message) {
  return new Promise((res) => openWindow({ title, width: 420, body: h("p.msg", { html: esc(message).replace(/\n/g, "<br>") }), onClose: res }));
}

window.addEventListener("keydown", (ev) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  const pop = document.querySelector(".combo-list");          // an open name list closes first
  if (ev.key === "Escape" && pop) { ev.preventDefault(); pop.remove(); return; }
  if (ev.key === "Escape") { ev.preventDefault(); top.close(); }
  else if (ev.key === "Enter" && !["TEXTAREA", "BUTTON", "SELECT"].includes(ev.target.tagName)) {
    const b = top.el.querySelector(".win-buttons .primary");
    if (b) { ev.preventDefault(); b.click(); }
  }
}, true);

// ------------------------------------------------------------- menu bar
/**
 * menus: [{ label, items: () => [ {label, act, key, checked, radio, sep, disabled} ] }]
 * Items are rebuilt each time a menu opens, so checks are always current.
 */
export function buildMenuBar(bar, menus) {
  bar.innerHTML = "";
  let open = null;
  const closeAll = () => { if (open) { open.btn.classList.remove("on"); open.drop.remove(); open = null; } };
  const show = (m, btn) => {
    closeAll();
    const drop = h("div.menu-drop");
    for (const it of m.items()) {
      if (it.sep) { drop.append(h("div.menu-sep")); continue; }
      const mark = it.checked === undefined ? "" : it.checked ? (it.radio ? "●" : "✓") : "";
      const row = h("button.menu-item" + (it.disabled ? ".disabled" : ""), {
        on: { click: () => { if (it.disabled) return; closeAll(); it.act(); } },
      }, h("span.mk", {}, mark), it.swatch ? h("span.sw", { style: { background: it.swatch } }) : null, h("span.lb", {}, it.label), h("span.ky", {}, it.key || ""));
      drop.append(row);
    }
    const r = btn.getBoundingClientRect();
    drop.style.left = r.left + "px";
    drop.style.top = r.bottom + "px";
    document.body.append(drop);
    btn.classList.add("on");
    open = { btn, drop };
  };
  for (const m of menus) {
    const btn = h("button.menu-top", {}, m.label);
    btn.addEventListener("pointerdown", (ev) => { ev.preventDefault(); if (open && open.btn === btn) closeAll(); else show(m, btn); });
    btn.addEventListener("pointerenter", () => { if (open && open.btn !== btn) show(m, btn); });
    bar.append(btn);
  }
  document.addEventListener("pointerdown", (ev) => {
    if (open && !open.drop.contains(ev.target) && !bar.contains(ev.target)) closeAll();
  });
  window.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && open) { ev.stopPropagation(); closeAll(); } }, true);
  window.addEventListener("blur", closeAll);
  return { closeAll };
}

/** Colour picker that resolves the chosen hex colour (or null if cancelled). */
export function pickColour(initial) {
  return new Promise((res) => {
    const inp = h("input", { type: "color", value: initial || "#1e6b34" });
    let done = false;
    inp.addEventListener("change", () => { done = true; res(inp.value); inp.remove(); });
    inp.addEventListener("cancel", () => { if (!done) res(null); inp.remove(); });
    inp.style.position = "fixed"; inp.style.left = "50%"; inp.style.top = "40%"; inp.style.opacity = "0";
    document.body.append(inp);
    inp.click();
  });
}
