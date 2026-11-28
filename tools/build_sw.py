"""Writes sw.js: the list of files kept for offline play, plus a new version number.
Run this after changing or adding any game file (before publishing):

    python tools/build_sw.py

Code: (c) Corey J Ruff
"""
import hashlib, os, pathlib, json

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {"parity", "tests", "tools", "node_modules", ".git", ".github"}
SKIP_FILES = {"sw.js", "package.json", "README.md", "demo.html", "players.html", "play.html"}
KEEP_EXT = {".html", ".js", ".css", ".json", ".webp", ".png", ".jpg", ".jpeg", ".webmanifest", ".ico"}   # how-to-play.pdf is opened from the site, not kept offline

files, digest = [], hashlib.sha256()
for p in sorted(ROOT.rglob("*")):
    rel = p.relative_to(ROOT).as_posix()
    if not p.is_file() or set(rel.split("/")[:-1]) & SKIP_DIRS or p.name in SKIP_FILES or p.suffix not in KEEP_EXT:
        continue
    files.append(rel)
    digest.update(rel.encode()); digest.update(p.read_bytes())
version = digest.hexdigest()[:10]

sw = (ROOT / "tools" / "sw_template.js").read_text(encoding="utf-8")
sw = sw.replace("__VERSION__", version).replace("__FILES__", json.dumps(["./"] + files, indent=2))
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print(f"sw.js: {len(files)} files, version {version}")
