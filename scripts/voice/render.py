"""Records Pip's voice: renders every Kids line to public/voice/<key>.mp3 with Kokoro (an
open-weight neural voice, Apache-2.0) and writes public/voice/manifest.json.

  npx tsx scripts/voice/collect.ts > /tmp/lines.json
  python3 scripts/voice/render.py /tmp/lines.json --model DIR   # DIR has kokoro-v1.0.int8.onnx, voices-v1.0.bin

Needs: pip install kokoro-onnx lameenc. Model files: github.com/thewh1teagle/kokoro-onnx/releases
(model-files-v1.0). Only lines without a clip are rendered; clips for lines that are gone are removed.
"""
import argparse, json, os, sys
from multiprocessing import Pool

VOICE = 'af_heart'  # Kokoro's warmest American English voice
SPEED = 1.0
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'voice')
_k = None


def init(model_dir):
    global _k
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    sess = ort.InferenceSession(os.path.join(model_dir, 'kokoro-v1.0.int8.onnx'), opts, providers=['CPUExecutionProvider'])
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
    enc.set_bit_rate(48)
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
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(a.lines))
    mpath = os.path.join(OUT, 'manifest.json')
    old = json.load(open(mpath)) if os.path.exists(mpath) else {'clips': {}}
    clips = {k: v for k, v in old.get('clips', {}).items() if os.path.exists(os.path.join(OUT, k + '.mp3'))}
    if old.get('voice') not in (None, VOICE):
        clips = {}
    todo = [l for l in lines if l['key'] not in clips]
    print(f'{len(lines)} lines, {len(todo)} to record with {a.jobs} workers', flush=True)
    done = 0
    with Pool(a.jobs, initializer=init, initargs=(a.model,)) as pool:
        for key, ms in pool.imap_unordered(render, todo, chunksize=2):
            clips[key] = ms
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(todo)}', flush=True)
    keep = {l['key'] for l in lines}
    for k in list(clips):
        if k not in keep:
            clips.pop(k)
            try:
                os.remove(os.path.join(OUT, k + '.mp3'))
            except OSError:
                pass
    with open(mpath, 'w') as f:
        json.dump({'v': 1, 'voice': VOICE, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
    print(f'manifest: {len(clips)} clips', flush=True)


if __name__ == '__main__':
    sys.exit(main())
