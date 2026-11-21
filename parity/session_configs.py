"""Writes session_configs.json: series of games (one profile each) for the Session 2 parity check."""
import json, random
r = random.Random(2026)
names = ["Grandma", "Grandpa", "Larry", "Sue", "Corey", "Alex", "Jack", "Lori", "", "Bob", "Grandma"]
lv = ["Easy", "Medium", "Hard", "Expert"]
series = []
for i in range(48):
    n = 2 if i % 3 else 3
    s = {"players": n, "levels": [r.choice(lv), r.choice(lv)], "colors": r.sample(["Red", "Blue", "Gold", "Green", "Purple"], 3),
         "cpu_names": [r.choice(names), r.choice(names)], "name": r.choice(["You", "Corey R", "Eyton"])}
    series.append({"settings": s, "games": r.choice([8, 12, 20]), "seed": 1000 * (i + 1),
                   "human": r.choice(lv), "abandon_every": r.choice([0, 5, 7]),
                   "prior_stats": i % 4 == 0})
json.dump(series, open("session_configs.json", "w"), indent=0)
print(len(series), "series,", sum(x["games"] for x in series), "games")
