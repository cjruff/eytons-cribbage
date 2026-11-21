import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
import cribbage as cb
out = {}
for st in cb.BOARD_STYLES:
    g = cb.BoardGeometry(st)
    out[st] = {"hole_d": g.hole_d, "holes": g.holes, "start": g.start, "finish": g.finish, "labels": g.labels,
               "marks": g.marks, "guides": g.guides, "spine": g.spine, "start_d": g.start_d, "finish_d": g.finish_d,
               "pegs": [[g.peg_pos(k, v) for v in range(-1, 122)] for k in range(3)]}
for st, fn in cb.IMAGE_BOARDS.items():
    g = cb.ImageBoard(st, cb.BOARD_DIR / fn)
    out["img:" + st] = {"pegs": [[g.peg_pos(k, v) for v in range(-1, 122)] for k in range(3)], "fit": g.fit}
json.dump(out, open("py_geometry.json", "w"))
