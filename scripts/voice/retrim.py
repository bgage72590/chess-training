"""Trims the silence around Pip's recorded clips in place, without recording them again: each
public/voice/<id>/<key>.mp3 is decoded, trimmed the way render.py trims new clips (PAD of quiet at
each end) and encoded again at its bitrate. The manifest gets the new durations and the trimmed
version (the one render.py records with now), so the app and its service worker load the new clips.

  pip install miniaudio lameenc numpy
  python3 scripts/voice/retrim.py                 # every voice in public/voice
  python3 scripts/voice/retrim.py --id sunny      # one voice
  python3 scripts/voice/retrim.py --root DIR      # voices in DIR/<id>/ instead

A voice that is already trimmed is left alone: every encoding loses a little quality.
"""
import argparse, json, os, re, sys
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import BITRATE, OUT, TRIM, encode, trim  # noqa: E402


def retrim(job):
    import miniaudio, numpy as np
    path, bitrate = job
    d = miniaudio.mp3_read_file_f32(path)
    x = np.frombuffer(d.samples, dtype=np.float32).reshape(-1, d.nchannels).mean(axis=1)
    audio = trim(x, d.sample_rate)
    return path, encode(audio, d.sample_rate, bitrate), round(len(audio) / d.sample_rate * 1000), round(len(x) / d.sample_rate * 1000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=OUT, help='directory of the voices (default: public/voice)')
    ap.add_argument('--id', action='append', help='a voice to trim (repeatable; default: all)')
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    a = ap.parse_args()
    ids = a.id or sorted(v for v in os.listdir(a.root) if os.path.exists(os.path.join(a.root, v, 'manifest.json')))
    with Pool(a.jobs) as pool:
        for vid in ids:
            folder = os.path.join(a.root, vid)
            mpath = os.path.join(folder, 'manifest.json')
            m = json.load(open(mpath))
            version = m.get('version', '')
            if version.endswith(TRIM):
                print(f'{vid}: already trimmed ({version})', flush=True)
                continue
            rate = re.search(r'@(\d+)k', version)
            bitrate = int(rate.group(1)) if rate else BITRATE
            jobs = [(os.path.join(folder, k + '.mp3'), bitrate) for k in sorted(m['clips'])]
            done, before, after = {}, 0, 0
            for path, mp3, ms, old_ms in pool.imap_unordered(retrim, jobs, chunksize=8):
                done[path] = (mp3, ms)
                before, after = before + old_ms, after + ms
            # Files change only once every clip of the voice is ready.
            clips = {}
            for path, (mp3, ms) in done.items():
                with open(path + '.tmp', 'wb') as f:
                    f.write(mp3)
                os.replace(path + '.tmp', path)
                clips[os.path.basename(path)[:-4]] = ms
            m['clips'] = dict(sorted(clips.items()))
            m['version'] = version + TRIM
            if 'bytes' in m:  # the size the app shows before a download follows the new files
                m['bytes'] = sum(os.path.getsize(os.path.join(folder, k + '.mp3')) for k in clips)
            with open(mpath, 'w') as f:
                json.dump(m, f, separators=(',', ':'))
            print(f'{vid}: {len(clips)} clips, {before / 1000:.0f} s -> {after / 1000:.0f} s, version {m["version"]}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
