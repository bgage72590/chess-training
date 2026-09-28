"""Finds recordings with a long pause in the middle or a cut-off end, by comparing each clip's length with
what its text predicts, and (with --fix) records those lines again, keeping the take that fits best.
Google's voices vary from take to take, and now and then one drifts or stalls.

  python3 scripts/voice/outliers.py /tmp/lines.json public/voice/sunny --id sunny [--fix]
"""
import argparse, json, os, re, shutil, sys, tempfile

sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import render as R

LONG = 1.6    # longer than this many times what the text predicts: a stall
SHORT = 0.6   # shorter than this: words cut off
MIN_EXTRA_MS = 900  # and by at least this much, so short lines never count


def size(text):
    """What the voice has to say, in characters: a number is spoken as words ("42" is "forty-two")."""
    return len(re.sub(r'\d+', lambda m: 'x' * (4 if len(m.group()) == 1 else 9), text))


def predict(lines, clips):
    """Length (ms) the text predicts: a straight line through the middle of the clips (robust to the odd bad one)."""
    xs = np.array([size(l['text']) for l in lines if l['key'] in clips], dtype=float)
    ys = np.array([clips[l['key']] for l in lines if l['key'] in clips], dtype=float)
    keep = xs >= 8
    for _ in range(4):  # refit without the worst 5% each round
        c1, c0 = np.polyfit(xs[keep], ys[keep], 1)
        res = np.abs(ys - (c0 + c1 * xs))
        keep = (xs >= 8) & (res <= np.quantile(res[xs >= 8], 0.95))
    return lambda n: c0 + c1 * n


def find(lines, clips):
    pred = predict(lines, clips)
    out = []
    for l in lines:
        ms = clips.get(l['key'])
        if ms is None:
            continue
        p = pred(size(l['text']))
        if (ms > p * LONG and ms - p > MIN_EXTRA_MS) or (ms < p * SHORT and p - ms > MIN_EXTRA_MS):
            out.append((l, ms, p))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lines')
    ap.add_argument('dir')
    ap.add_argument('--id', required=True)
    ap.add_argument('--fix', action='store_true')
    ap.add_argument('--tries', type=int, default=5)
    a = ap.parse_args()
    lines = json.load(open(a.lines))
    mpath = os.path.join(a.dir, 'manifest.json')
    m = json.load(open(mpath))
    bad = find(lines, m['clips'])
    print(f"{a.id}: {len(bad)} of {len(m['clips'])} clips look wrong", flush=True)
    for l, ms, p in sorted(bad, key=lambda t: -abs(t[1] - t[2])):
        print(f"  {ms:6d} ms (predicted {p:5.0f})  {l['text'][:80]}")
    if not a.fix or not bad:
        return
    entry = next(v for v in json.load(open(R.MASTER))['voices'] if v['id'] == a.id)
    R.ENGINE, R.VOICE = entry['engine'], entry['voice']
    R.SPEED = R.ENGINES[R.ENGINE]['speed']
    tmp = tempfile.mkdtemp()
    R.OUT = tmp
    pred = predict(lines, m['clips'])
    fixed = 0
    for l, ms, p in bad:
        best, best_ms = None, ms
        for _ in range(a.tries):
            _, new = R.render(l)
            if abs(new - p) < abs(best_ms - p):
                best_ms = new
                shutil.copy(os.path.join(tmp, l['key'] + '.mp3'), os.path.join(tmp, 'best.mp3'))
                best = True
            if best_ms <= p * LONG and best_ms >= p * SHORT:
                break
        if best:
            shutil.copy(os.path.join(tmp, 'best.mp3'), os.path.join(a.dir, l['key'] + '.mp3'))
            m['clips'][l['key']] = best_ms
            fixed += 1
            print(f"  fixed {ms} -> {best_ms} ms  {l['text'][:60]}", flush=True)
    json.dump(m, open(mpath, 'w'), separators=(',', ':'))
    shutil.rmtree(tmp)
    print(f'{a.id}: {fixed} of {len(bad)} recorded again; {len(find(lines, m["clips"]))} still look wrong')


if __name__ == '__main__':
    main()
