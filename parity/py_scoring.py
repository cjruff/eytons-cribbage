import json, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))   # folder that holds web\ and cribbage.py
sys.path.insert(0, HERE)
import cribbage as cb
from detrng import DetRng
r = DetRng(12345)
hands = []
for i in range(200000):
    cards = r.sample(list(range(52)), 5)
    crib = r.random() < 0.35
    starter = None if (i % 10 == 9) else cards[4]
    hands.append([cards[:4], starter, crib])
scores = [cb.score_hand(h, s, c) for h, s, c in hands]
breakdowns = [[list(it[:1]) + [list(it[1]), it[2]] for it in cb.hand_breakdown(h, s, c)]
              for h, s, c in hands[:40000] if s is not None]
pegs = []
for i in range(100000):
    deck = list(range(52)); r.shuffle(deck)
    seq, count = [], 0
    stop = 1 + r.randrange(8)
    for c in deck:
        if count + cb.VAL[c] > 31 or len(seq) >= stop:
            break
        seq.append(c); count += cb.VAL[c]
    p, reasons = cb.peg_score(seq)
    pegs.append([seq, p, reasons, cb._peg_pts_ranks(tuple(cb.RANK[c] for c in seq), count)])
solves = []
for i in range(6000):
    deck = list(range(52)); r.shuffle(deck)
    mine = sorted(cb.RANK[c] for c in deck[:r.randrange(5)])
    theirs = sorted(cb.RANK[c] for c in deck[4:4 + r.randrange(5)])
    seq, count = [], 0
    for c in deck[8:8 + r.randrange(4)]:
        if count + cb.VAL[c] <= 31:
            seq.append(cb.RANK[c]); count += cb.VAL[c]
    turn = r.randrange(2)
    last = -1 if not seq else r.randrange(2)
    solves.append([mine, theirs, seq, count, turn, last,
                   cb._peg_solve(tuple(mine), tuple(theirs), tuple(seq), count, turn, last)])
json.dump({"hands": hands, "scores": scores, "breakdowns": breakdowns, "pegs": pegs, "solves": solves},
          open("py_scoring.json", "w"))
print("python scoring cases written")
