"""Records Pip's voice: renders every Kids line to public/voice/<key>.mp3 with Kokoro (an
open-weight neural voice, Apache-2.0) and writes public/voice/manifest.json.

  npx tsx scripts/voice/collect.ts > /tmp/lines.json
  python3 scripts/voice/render.py /tmp/lines.json --model DIR   # DIR has kokoro-v1.0.onnx, voices-v1.0.bin

To record in several places at once, give each a share of the lines and --part NAME: it records
only those, writes manifest.NAME.json and removes nothing. The next full run folds the parts in.

Needs: pip install kokoro-onnx lameenc. Model files: github.com/thewh1teagle/kokoro-onnx/releases
(model-files-v1.0). Only lines without a clip of this VERSION are recorded; clips for lines that are gone
are removed.
"""
import argparse, json, os, sys
from multiprocessing import Pool

VOICE = 'af_heart'  # Kokoro's warmest American English voice
# A touch slower than normal, for young listeners. The model speaks at this pace itself; slowing
# clips down in the browser instead (time-stretching) is what makes speech sound robotic.
SPEED = 0.94
MODEL = 'kokoro-v1.0.onnx'  # full precision: the int8 model sounds buzzier
BITRATE = 64
# Changing any of these re-records every clip (and the app drops cached clips of another version).
VERSION = f'{VOICE}@{MODEL}@{SPEED}@{BITRATE}k'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'voice')
_k = None


def init(model_dir):
    global _k
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    sess = ort.InferenceSession(os.path.join(model_dir, MODEL), opts, providers=['CPUExecutionProvider'])
    _k = Kokoro.from_session(sess, os.path.join(model_dir, 'voices-v1.0.bin'))


def render(line):
    import numpy as np, lameenc
    samples, sr = _k.create(line['text'], voice=VOICE, speed=SPEED, lang='en-us')
    # A short fade and 80 ms of silence at each end, so clips never click or clip words.
    pad = np.zeros(int(sr * 0.08), dtype=np.float32)
    audio = np.concatenate([pad, samples.astype(np.float32), pad])
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio * min(1.0, 0.89 / peak)
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode((audio * 32767).astype(np.int16).tobytes()) + enc.flush()
    with open(os.path.join(OUT, line['key'] + '.mp3'), 'wb') as f:
        f.write(mp3)
    return line['key'], round(len(audio) / sr * 1000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lines')
    ap.add_argument('--model', required=True)
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--part', help='record only these lines into manifest.PART.json')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(a.lines))
    mpath = os.path.join(OUT, 'manifest.json')
    old = json.load(open(mpath)) if os.path.exists(mpath) else {'clips': {}}
    stale = old.get('version') != VERSION  # recorded another way: record everything again
    clips = {} if stale else {k: v for k, v in old.get('clips', {}).items() if os.path.exists(os.path.join(OUT, k + '.mp3'))}
    # Parts recorded elsewhere (--part): fold them in.
    for f in sorted(os.listdir(OUT)):
        if f.startswith('manifest.') and f.endswith('.json') and not a.part:
            part = json.load(open(os.path.join(OUT, f)))
            if part.get('version') == VERSION:
                clips.update(part.get('clips', {}))
            os.remove(os.path.join(OUT, f))
    todo = [l for l in lines if l['key'] not in clips]
    if a.part:
        clips = {}
    print(f'{len(lines)} lines, {len(todo)} to record with {a.jobs} workers', flush=True)
    done = 0
    with Pool(a.jobs, initializer=init, initargs=(a.model,)) as pool:
        for key, ms in pool.imap_unordered(render, todo, chunksize=2):
            clips[key] = ms
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(todo)}', flush=True)
    if a.part:
        with open(os.path.join(OUT, f'manifest.{a.part}.json'), 'w') as f:
            json.dump({'v': 1, 'voice': VOICE, 'version': VERSION, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
        print(f'part {a.part}: {len(clips)} clips', flush=True)
        return
    # Drop clips for lines that are gone, and files from other recordings.
    keep = {l['key'] for l in lines}
    clips = {k: v for k, v in clips.items() if k in keep}
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f[:-4] not in clips:
            os.remove(os.path.join(OUT, f))
    with open(mpath, 'w') as f:
        json.dump({'v': 1, 'voice': VOICE, 'version': VERSION, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
    print(f'manifest: {len(clips)} clips', flush=True)


if __name__ == '__main__':
    sys.exit(main())
