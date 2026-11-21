"""Runs the Python engine with seeded randomness and writes everything to JSON
so the JavaScript engine can be checked against it line for line."""
import json, sys, time
import os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))   # folder that holds web\ and cribbage.py
sys.path.insert(0, HERE)
import cribbage as cb
from detrng import DetRng

EVALS = []
def _best(self, options, fn):
    best, best_v, vals = [], None, []
    for o in options:
        v = fn(o)
        vals.append(v)
        if best_v is None or v > best_v + 1e-9:
            best, best_v = [o], v
        elif abs(v - best_v) <= 1e-9:
            best.append(o)
    EVALS.append(vals)
    return self.rng.choice(best)
cb.ComputerAI._best = _best


def game(n, levels, human_level, seed):
    EVALS.clear()
    e = cb.CribbageEngine(n, levels, deck_rng=DetRng(seed))
    for i, p in enumerate(e.players):
        if p.ai:
            p.ai.rng = DetRng(seed * 7 + i)
    bot = cb.ComputerAI(human_level)
    bot.rng = DetRng(seed * 7 + 99)
    events = []
    e.observers.append(lambda ev, **d: events.append(ev))
    full = []
    orig_say = e.say
    e.say = lambda msg: (full.append(msg), orig_say(msg))
    e.cut_for_deal()
    e.start_round()
    me = e.players[e.human]
    for _ in range(300):
        e.ai_discards()
        e.human_discard(bot.choose_discards(me.hand, e.n_discard, e.dealer == e.human, n))
        if e.cut_starter():
            break
        e.start_pegging()
        while True:
            st = e.peg_advance()
            if st == "human_play":
                c = bot.choose_play(me.peg_hand, list(e.seq), e.count, e.unseen_for(e.human),
                                    len(e.players[e.nxt(e.human)].peg_hand))
                assert e.human_play(c)
            elif st == "human_go":
                assert e.human_go()
            elif st in ("done", "over"):
                break
        if e.over:
            break
        e.start_show()
        while e.show_next():
            if e.over:
                break
        if e.over:
            break
        e.next_round()
    t = e.tally
    return {
        "log": full, "scores": [p.score for p in e.players], "backs": [p.back for p in e.players],
        "winner": e.winner, "hands": e.hands_played, "result": e.result(), "events": len(events),
        "tally": [t.hands, t.hand_points, t.highest_hand, t.highest_hand_cards, t.cribs, t.crib_points,
                  t.highest_crib, t.peg_points, t.highest_peg, t.twenty_nines, t.zero_hands],
        "evals": [list(v) for v in EVALS],
    }


if __name__ == "__main__":
    cfgs = json.load(open(sys.argv[1]))
    t0 = time.time()
    out = [dict(cfg=c, **game(c["n"], c["levels"], c["human"], c["seed"])) for c in cfgs]
    json.dump(out, open(sys.argv[2], "w"))
    print(f"python: {len(out)} games in {time.time() - t0:.0f}s")
