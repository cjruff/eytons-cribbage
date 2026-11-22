# Eyton's Cribbage — web version (Sessions 1–5)
Code: © Corey J Ruff

## What's here
- `js/` — the game engine, ported from cribbage.py: cards, scoring, pegging, crib, go/show,
  2 and 3 players, skunks, cut for deal, and all four computer levels (Expert look-ahead included).
- `js/settings.js, stats.js, achievements.js, personalities.js` — Session 2 ports of the
  Python settings, lifetime stats, 71 achievements and family opponents' thought bubbles.
- `js/profiles.js` — player profiles ("Who's playing?"), saving in the browser, backup files,
  and importing stats.json / achievements.json / settings.json from the Python version.
- `js/session.js` — one game for one profile (wires engine + stats + achievements + bubbles).
- `index.html` — **the game** (Session 5 moved it here from play.html, which now just redirects).
- `manifest.webmanifest`, `icons/`, `favicon.png` — lets phones/computers install it like an app.
- `sw.js` — offline copy of the game.  **After changing any game file, run `python tools/build_sw.py`**
  so players' devices pick up the new version.  (Offline mode is off on localhost unless you open
  `http://localhost:8000/?offline`, so your edits show up straight away while testing.)
- `demo.html` — the bare computer-vs-computer demo from Session 1.
- `js/app.js` — the game page: who's playing, menus, settings, start/abandon games (Session 4).
- `js/ui/windows.js, dialogs.js` — menu bar and windows: New Game, Settings, Statistics,
  Achievements, Players & Backups, Who's playing, How to Play, About (Session 4).
- `css/app.css` — look of the menus and windows.
- `js/ui/` — the table screen ported from cribbage.py: `geometry.js` (boards), `paint.js`
  (drawing helpers), `table.js` (drawing, timing, mouse/touch/keyboard).
- `assets/` — pictures as small WebP files: jacks/queens/kings, card_back, about, youlose, and
  `portraits/` (alex, corey, grandma, grandpa, jack, larry, lori, sue).  To change a picture you can
  simply drop in a .png or .jpg with the same name (e.g. `portraits/eyton.png` for a player named
  Eyton) and delete the .webp of that name; then run `python tools/build_sw.py`.
- `boards/` — the picture boards and their hole maps.
- `index.html` — a bare demo page where the computer plays every seat.
- `players.html` — Session 2 test page (everything on it is now inside the game's menus).
- `assets/youlose.png` — copy your picture here so Corey's win shows it (optional for now).
- `tests/` — JavaScript tests ported from test_cribbage.py (`npm test`, needs Node 18+).
- `parity/` — the scripts that prove the JS engine matches Python exactly.

## Try the demo
Browsers won't load modules from a double-clicked file, so serve the folder:
    cd web
    python -m http.server 8000
then open http://localhost:8000

## Re-run the parity check (needs cribbage.py one folder up)
    cd web/parity
    python py_driver.py        (writes py_games.json)
    node js_driver.mjs         (writes js_games.json)
    node compare_games.mjs
    python py_scoring.py && node compare_scoring.mjs
    node ladder.mjs            (skill ladder + Expert speed)
    python session_configs.py && python py_session.py && node js_session.mjs && node compare_session.mjs
    python py_settings.py && node compare_settings.mjs

## Session 1 results
| Check | Result |
|---|---|
| Full games, same deals (2p: every level combo; 3p: 16 level pairs) | 272 / 272 identical, all 52,181 log lines |
| Computer decisions (every option it weighed) | 94,758 compared, largest difference 0 |
| Hand and crib scores | 200,000 / 200,000 |
| Itemised count breakdowns | 36,000 / 36,000 |
| Pegging scores and reasons | 100,000 / 100,000 |
| Expert solver positions | 6,000 / 6,000 |
| JS tests | 18 / 18 pass |
| Skill ladder, 400 real-shuffle games each | Medium beats Easy 83%, Hard beats Medium 62%, Expert beats Hard 61% |
| Expert thinking time | avg 38 ms per pegging move, worst 246 ms |

## Session 2 results
48 profiles, 624 games (2 and 3 players, family opponents, abandoned games, imported history)
run through both the Python and web stats / achievements / personality code:

| Check | Result |
|---|---|
| Thought bubbles (who said what, when) | 624 / 624 games identical (744 bubbles) |
| Medals unlocked after each game | 624 / 624 identical (1,234 unlocks) |
| Saved stats file / achievements file | 48 / 48 identical layout and values |
| Stats views (all, by players, by level, vs each family member) | 1,872 / 1,872 identical |
| Stats table text (incl. averages and rounding) | 1,872 / 1,872 identical |
| Medal summary and progress text | 48 / 48 identical |
| Settings repair + computer names/levels (3,000 random, incl. broken files) | 3,000 / 3,000 identical |
| JS tests | 27 / 27 pass |

## Session 3 results
| Check | Result |
|---|---|
| Board hole positions vs Python (3 drawn + 2 picture boards) | 20,045 coordinates, largest difference 0.000000000001 |
| Full games played through real mouse clicks in Chrome | 9 games, every board, 2 and 3 players, 0 errors |
| Input paths used | tap to select, drag to crib, double-click and drag to play, Go, Continue, Show Count, game-over buttons |
| Count-your-own-hand box, thought bubbles, medal pop-ups, pegging callouts | working |

## Session 4 results
| Check | Result |
|---|---|
| Menus: Game, Board, Background (+ custom colour), Card Back (+ Eyton colours, custom), View (full screen, F11), Help | working, choices saved per player |
| Windows: New Game, Settings, Statistics, Achievements, Players & Backups, Who's playing, How to Play, About | working |
| New Game rules from Python | Corey locked to Expert, duplicate peg colours refused, 2/3 players, board |
| Full games from the startup flow (who's playing -> New Game -> play -> game-over buttons) | 3 games, every board, 0 errors |
| Abandon rules | F2 / switching player mid-game asks once; game recorded as abandoned |
| Python import from inside the game | stats, achievements and settings imported |

## Session 5 results
| Check | Result |
|---|---|
| Pictures | 15.0 MB -> 1.2 MB (WebP; Jack and Grandpa portraits zoomed to head & shoulders) |
| Phone layout (landscape) | no log, smaller board, 22% bigger hand cards; switches automatically on short screens |
| Full games with touch at phone sizes (844x390, 915x412) | 4 games, every board, 2 and 3 players, 0 errors |
| Desktop after the change | unchanged; full game, 0 errors |
| Offline | 44 files kept on the device; reload with no network: board, cards and photos all load |
| Install | manifest + icons + offline worker (Chrome/Edge/Android install prompt; iPhone: Share > Add to Home Screen) |
| Portrait phone | "Turn your phone sideways to play" |

## Achievement update (Nov 22)
87 achievements / 255 medals, with a fifth medal (Diamond) for 5-level achievements. New: Marathon Man,
Passing the Baton, Do Pass Go!, Low Rider, Off to a Good Start, I'll Wait Here, You Wait There, Small Ball,
Ballsy Move, Demoralized, Demoralizer, Run Forrest Run!, You Smell Bad, You Smell Really Really Bad,
You Almost Didn't Suck, One Is the Loneliest Number, Go Ahead Without Me.  Changed: Down to the Wire ->
"Ha, Ha... Suck it!", The Agony of Defeat -> "The Unthinkable", Bad Luck Brian (zero hand AND crib), Crib
Monster note removed.  Removed: Pair-a-dice.  The engine now also reports "go", "pegdone" and "cutdeal"
events (report only; no change to play).  These are web-only, so the Python comparison scripts no longer
apply to achievements.  tests/achievements.test.js covers the new ones.
