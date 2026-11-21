import fs from "node:fs";
const py = JSON.parse(fs.readFileSync("py_games.json", "utf8"));
const js = JSON.parse(fs.readFileSync("js_games.json", "utf8"));
let ok = 0, logLines = 0, evalCount = 0, maxDiff = 0;
const fails = [];
for (let g = 0; g < py.length; g++) {
  const a = py[g], b = js[g];
  const problems = [];
  for (const k of ["scores", "backs", "winner", "hands", "events", "tally"]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) problems.push(`${k}: py=${JSON.stringify(a[k])} js=${JSON.stringify(b[k])}`);
  }
  if (JSON.stringify(a.result) !== JSON.stringify(b.result)) problems.push(`result differs`);
  if (a.log.length !== b.log.length) problems.push(`log length ${a.log.length} vs ${b.log.length}`);
  for (let i = 0; i < Math.min(a.log.length, b.log.length); i++) {
    if (a.log[i] !== b.log[i]) { problems.push(`log line ${i}: py="${a.log[i]}" js="${b.log[i]}"`); break; }
  }
  if (a.evals.length !== b.evals.length) problems.push(`evaluation count ${a.evals.length} vs ${b.evals.length}`);
  for (let i = 0; i < Math.min(a.evals.length, b.evals.length); i++) {
    const x = a.evals[i], y = b.evals[i];
    if (x.length !== y.length) { problems.push(`eval ${i} option count`); break; }
    for (let j = 0; j < x.length; j++) maxDiff = Math.max(maxDiff, Math.abs(x[j] - y[j]));
    evalCount += x.length;
  }
  logLines += a.log.length;
  if (problems.length) fails.push({ cfg: a.cfg, problems });
  else ok++;
}
console.log(`games identical: ${ok} / ${py.length}`);
console.log(`log lines compared: ${logLines}   (every line of every game)`);
console.log(`computer evaluations compared: ${evalCount}   largest difference: ${maxDiff}`);
for (const f of fails.slice(0, 5)) console.log("MISMATCH", JSON.stringify(f.cfg), f.problems.slice(0, 3));
