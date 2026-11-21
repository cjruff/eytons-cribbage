"""Session 2 parity: runs whole profiles (many games each) through the Python
stats, achievements and personality code, and writes everything to JSON."""
import json, os, sys, tempfile, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
import cribbage as cb
import achievements as ach
from detrng import DetRng

App = cb.CribbageApp


def play(e, bot, n, stop_after=None):
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
                e.human_play(bot.choose_play(me.peg_hand, list(e.seq), e.count, e.unseen_for(e.human),
                                             len(e.players[e.nxt(e.human)].peg_hand), n))
            elif st == "human_go":
                e.human_go()
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
        if stop_after and e.hands_played >= stop_after:
            return "abandoned"
        e.next_round()
    return "done"


def run_series(cfg, prior):
    tmp = tempfile.mkdtemp()
    s = cb.load_settings.__globals__["DEFAULT_SETTINGS"].copy()
    s.update(cfg["settings"])
    stats = cb.StatsStore(os.path.join(tmp, "stats.json"))
    if prior:
        stats.data = json.loads(json.dumps(prior))
    tracker = ach.AchievementTracker(os.path.join(tmp, "ach.json"), seed=ach.seed_from_stats(stats))
    games = []
    for g in range(cfg["games"]):
        seed = cfg["seed"] + g
        names = cb.computer_names(s)
        e = cb.CribbageEngine(s["players"], cb.computer_levels(s, names), s.get("name") or "You",
                              deck_rng=DetRng(seed), colors=[cb.PEG_PALETTE[c] for c in s["colors"]], names=names)
        for i, p in enumerate(e.players):
            if p.ai:
                p.ai.rng = DetRng(seed * 7 + i)
        tracker.attach(e)
        said = []

        class Fake: pass
        app = Fake()
        app.engine, app._event_counts, app._said_goodbye, app.bubbles = e, {}, False, {}
        app.personality = lambda pi, app=app: App.personality(app, pi)
        app.base_name = App.base_name
        app._counted = lambda t, pi, app=app: App._counted(app, t, pi)
        app.say_bubble = lambda pi, trig, app=app, said=said: (
            said.append([pi, trig, app.personality(pi)[trig]]) if app.personality(pi).get(trig) else None)
        e.observers.append(lambda ev, app=app, **d: App.on_game_event(app, ev, **d))
        for i in range(1, e.n):
            app.say_bubble(i, "start")
        bot = cb.ComputerAI(cfg["human"]); bot.rng = DetRng(seed * 7 + 99)
        ab = cfg["abandon_every"]
        stop = 3 if ab and g % ab == ab - 1 else None
        how = play(e, bot, s["players"], stop)
        opps = [b for b in (App.base_name(p.name) for p in e.players if not p.human)
                if b in {x.lower() for x in cb.PRESET_OPPONENTS}]
        if how == "abandoned":
            stats.record(e.n, e.difficulty, e.tally, "abandoned", opponents=opps)
        else:
            res = e.result()
            stats.record(e.n, e.difficulty, e.tally, "win" if res["won"] else "loss", res, opponents=opps)
        games.append({"how": how, "said": said, "new": [[a.id, t] for a, t in tracker.new_this_game],
                      "winner": e.winner, "scores": [p.score for p in e.players]})
    views = []
    for p in (None, 2, 3):
        for d in (None,) + cb.DIFFICULTIES:
            views.append(stats.aggregate(p, d))
        for o in cb.PRESET_OPPONENTS:
            views.append(stats.aggregate(p, None, o))
    rows = [[str(fn(v)) for _, fn in cb.STAT_ROWS] for v in views]
    got, total, medals = tracker.summary()
    return {"games": games, "stats": stats.data, "ach": tracker.data, "rows": rows,
            "views": views, "summary": [got, total, medals],
            "progress": [tracker.progress_text(a) for a in ach.ACHIEVEMENTS]}


if __name__ == "__main__":
    cfgs = json.load(open("session_configs.json"))
    t0 = time.time()
    out, prior = [], None
    for c in cfgs:
        r = run_series(c, prior if c["prior_stats"] else None)
        prior = r["stats"]
        out.append(r)
    json.dump(out, open("py_session.json", "w"))
    print(f"python: {len(out)} profiles, {sum(len(r['games']) for r in out)} games in {time.time() - t0:.0f}s")
