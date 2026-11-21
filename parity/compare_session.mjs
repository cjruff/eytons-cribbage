import fs from "node:fs";
const py = JSON.parse(fs.readFileSync("py_session.json", "utf8"));
const js = JSON.parse(fs.readFileSync("js_session.json", "utf8"));
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const tally = {};
const check = (name, a, b, where) => {
  tally[name] ||= [0, 0];
  tally[name][1]++;
  if (canon(a) === canon(b)) tally[name][0]++;
  else if (tally[name][1] - tally[name][0] <= 3) console.log(`DIFF ${name} @ ${where}\n  py ${canon(a).slice(0, 300)}\n  js ${canon(b).slice(0, 300)}`);
};
let bubbles = 0, unlocks = 0;
py.forEach((p, i) => {
  const j = js[i];
  p.games.forEach((g, k) => {
    const h = j.games[k];
    check("game results", [g.how, g.winner, g.scores], [h.how, h.winner, h.scores], `${i}.${k}`);
    check("thought bubbles", g.said, h.said, `${i}.${k}`);
    check("achievements unlocked per game", g.new, h.new, `${i}.${k}`);
    bubbles += g.said.length; unlocks += g.new.length;
  });
  check("saved stats file", p.stats, j.stats, i);
  check("saved achievements file", p.ach, j.ach, i);
  p.views.forEach((v, k) => check("stats views (level/players/opponent)", v, j.views[k], `${i}.${k}`));
  p.rows.forEach((r, k) => check("stats table text", r, j.rows[k], `${i}.${k}`));
  check("medal summary", p.summary, j.summary, i);
  check("achievement progress text", p.progress, j.progress, i);
});
for (const [k, [ok, n]] of Object.entries(tally)) console.log(`${k.padEnd(40)} ${ok} / ${n} identical`);
console.log(`(${bubbles} thought bubbles and ${unlocks} medal unlocks compared)`);
