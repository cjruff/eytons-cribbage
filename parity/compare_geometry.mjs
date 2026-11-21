import fs from "node:fs";
import { BoardGeometry, ImageBoard, IMAGE_BOARDS } from "../js/ui/geometry.js";
const py = JSON.parse(fs.readFileSync("py_geometry.json", "utf8"));
let worst = 0, n = 0;
const cmp = (a, b) => {
  if (typeof a === "number") { worst = Math.max(worst, Math.abs(a - b)); n++; return; }
  if (typeof a === "string") { if (a !== b) worst = Infinity; return; }
  if (a.length !== b.length) { worst = Infinity; return; }
  a.forEach((x, i) => cmp(x, b[i]));
};
for (const st of ["Traditional Loop", "29 Board", "Cribbagemaster"]) {
  const g = new BoardGeometry(st), p = py[st];
  for (const k of ["hole_d", "holes", "start", "finish", "labels", "marks", "guides", "spine", "start_d", "finish_d"]) cmp(p[k], g[k]);
  cmp(p.pegs, [0, 1, 2].map((k) => Array.from({ length: 123 }, (_, i) => g.pegPos(k, i - 1))));
}
for (const [st, fn] of Object.entries(IMAGE_BOARDS)) {
  const g = new ImageBoard(st, JSON.parse(fs.readFileSync("../../boards/" + fn, "utf8")), null);
  cmp(py["img:" + st].pegs, [0, 1, 2].map((k) => Array.from({ length: 123 }, (_, i) => g.pegPos(k, i - 1))));
}
console.log(`board geometry: ${n} coordinates compared, largest difference ${worst.toExponential(1)}`);
