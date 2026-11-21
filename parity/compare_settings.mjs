import fs from "node:fs";
import { normalizeSettings, computerNames, computerLevels } from "../js/settings.js";
const cases = JSON.parse(fs.readFileSync("py_settings.json", "utf8"));
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
let ok = 0;
for (const c of cases) {
  const s = normalizeSettings(c.raw);
  const n = computerNames(s);
  if (canon([s, n, computerLevels(s, n)]) === canon([c.s, c.names, c.levels])) ok++;
  else if (ok > -1) { console.log("DIFF", JSON.stringify(c.raw), "\n py", canon([c.s, c.names]), "\n js", canon([s, n])); ok -= 100000; }
}
console.log(`${"settings repair + computer names/levels".padEnd(40)} ${Math.max(ok, 0)} / ${cases.length} identical`);
