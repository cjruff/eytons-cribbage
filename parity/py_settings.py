import json, os, sys, random, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
import cribbage as cb
from pathlib import Path
r = random.Random(5)
pick = lambda *xs: r.choice(xs)
cases = []
tmp = Path(tempfile.mkdtemp()) / "settings.json"
cb.SETTINGS_FILE = tmp
for i in range(3000):
    raw = {}
    for k, opts in {
        "players": (2, 3, 4, "2", None), "difficulty": ("Easy", "Expert", "Insane", None),
        "board": ("Rectangular", "29 Board", "Cribbagemaster", "Traditional Loop", "Moon"),
        "speed": ("Fast", "Normal", "Slow", "Warp"),
        "levels": (["Easy", "Hard"], ["Expert"], ["Hard", "Bogus"], "Hard", ["Medium", "Medium"]),
        "card_back": ("Eyton", "Classic blue", "Plaid"), "card_back_color": ("#123456", "red", "#12345", 5),
        "cpu_names": (["", ""], ["Grandma", "grandma"], ["Corey 2", ""], ["x" * 30, " Larry "], [1, 2], ["You", "Blue"]),
        "colors": (["Red", "Blue", "Gold"], ["Red", "Red", "Gold"], ["Green", "Purple", "Black"], ["Pink", "Blue", "Gold"], ["Blue", "Red"]),
        "name": ("You", "Corey", "Blue", "", "grandma"),
    }.items():
        if r.random() < 0.8:
            raw[k] = r.choice(opts)
    tmp.write_text(json.dumps(raw))
    s = cb.load_settings()
    names = cb.computer_names(s)
    cases.append({"raw": raw, "s": s, "names": names, "levels": cb.computer_levels(s, names)})
json.dump(cases, open("py_settings.json", "w"))
