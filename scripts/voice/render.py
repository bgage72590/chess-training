"""Records Pip's voice: renders every Kids line to public/voice/<key>.mp3 and writes
public/voice/manifest.json. Two voices can record it:

  kokoro  Kokoro, an open-weight neural voice (Apache-2.0) that runs on this machine.
          pip install kokoro-onnx lameenc; model files from github.com/thewh1teagle/kokoro-onnx/releases
          (model-files-v1.0: kokoro-v1.0.onnx, voices-v1.0.bin) in the --model directory.
  google  Google Cloud Text-to-Speech (Chirp 3 HD voices). pip install lameenc; the API key is read
          from the GOOGLE_TTS_API_KEY environment variable (never written anywhere).

  npx tsx scripts/voice/collect.ts > /tmp/lines.json
  python3 scripts/voice/render.py /tmp/lines.json --model DIR                    # Kokoro
  python3 scripts/voice/render.py /tmp/lines.json --engine google [--voice NAME]   # Google

To record in several places at once, give each a share of the lines and --part NAME: it records
only those, writes manifest.NAME.json and removes nothing. The next full run folds the parts in.
Only lines without a clip of this VERSION are recorded; clips for lines that are gone are removed.
--out DIR writes somewhere else (e.g. to try voices on a few sample lines).
"""
import argparse, base64, io, json, os, sys, time, wave
from multiprocessing import Pool
from multiprocessing.pool import ThreadPool

ENGINES = {
    # A touch slower than normal, for young listeners. The voice speaks at this pace itself;
    # slowing clips down in the browser instead (time-stretching) makes speech sound robotic.
    'kokoro': {'voice': 'af_heart', 'model': 'kokoro-v1.0.onnx', 'speed': 0.94},  # full precision: int8 is buzzier
    'google': {'voice': 'en-US-Chirp3-HD-Leda', 'speed': 0.95},
}
BITRATE = 64
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'voice')

ENGINE = 'kokoro'
VOICE = ENGINES['kokoro']['voice']
SPEED = ENGINES['kokoro']['speed']
MODEL_DIR = None
_k = None


def version():
    """Changing any of these re-records every clip (and the app drops cached clips of another version)."""
    if ENGINE == 'kokoro':
        return f"{VOICE}@{ENGINES['kokoro']['model']}@{SPEED}@{BITRATE}k"
    return f'{ENGINE}:{VOICE}@{SPEED}@{BITRATE}k'


def init_kokoro(model_dir):
    global _k
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    sess = ort.InferenceSession(os.path.join(model_dir, ENGINES['kokoro']['model']), opts, providers=['CPUExecutionProvider'])
    _k = Kokoro.from_session(sess, os.path.join(model_dir, 'voices-v1.0.bin'))


def speak_kokoro(text):
    return _k.create(text, voice=VOICE, speed=SPEED, lang='en-us')


def speak_google(text, use_rate=True):
    import urllib.error, urllib.request
    import numpy as np
    config = {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}
    if use_rate:
        config['speakingRate'] = SPEED
    body = {'input': {'text': text}, 'voice': {'languageCode': VOICE[:5], 'name': VOICE}, 'audioConfig': config}
    req = urllib.request.Request(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': os.environ['GOOGLE_TTS_API_KEY']},
    )
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode('utf8', 'replace')
            if e.code == 400 and use_rate and 'rate' in msg.lower():
                return speak_google(text, use_rate=False)  # a voice without pace control
            if e.code in (429, 500, 502, 503, 504) and attempt < 6:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f'Google TTS {e.code}: {msg}') from None
    with wave.open(io.BytesIO(base64.b64decode(data['audioContent']))) as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return pcm, sr


def render(line):
    import numpy as np, lameenc
    samples, sr = speak_kokoro(line['text']) if ENGINE == 'kokoro' else speak_google(line['text'])
    # 80 ms of silence at each end, so clips never click or clip words.
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
    global ENGINE, VOICE, SPEED, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument('lines')
    ap.add_argument('--engine', choices=sorted(ENGINES), default='kokoro')
    ap.add_argument('--voice', help='voice name (default: the engine\'s)')
    ap.add_argument('--model', help='Kokoro model directory')
    ap.add_argument('--jobs', type=int, default=None, help='parallel workers (default: CPUs for Kokoro, 6 for Google)')
    ap.add_argument('--part', help='record only these lines into manifest.PART.json')
    ap.add_argument('--out', help='output directory (default: public/voice)')
    a = ap.parse_args()
    ENGINE = a.engine
    VOICE = a.voice or ENGINES[ENGINE]['voice']
    SPEED = ENGINES[ENGINE]['speed']
    if a.out:
        OUT = a.out
    if ENGINE == 'kokoro' and not a.model:
        ap.error('--model is required for Kokoro')
    if ENGINE == 'google' and not os.environ.get('GOOGLE_TTS_API_KEY'):
        ap.error('set GOOGLE_TTS_API_KEY')
    VERSION = version()
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
    jobs = a.jobs or ((os.cpu_count() or 2) if ENGINE == 'kokoro' else 6)
    print(f'{len(lines)} lines, {len(todo)} to record with {ENGINE} {VOICE} ({jobs} workers)', flush=True)
    done = 0
    pool = Pool(jobs, initializer=init_kokoro, initargs=(a.model,)) if ENGINE == 'kokoro' else ThreadPool(jobs)
    with pool:
        for key, ms in pool.imap_unordered(render, todo, chunksize=2 if ENGINE == 'kokoro' else 1):
            clips[key] = ms
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(todo)}', flush=True)
    record = {'v': 1, 'voice': VOICE, 'version': VERSION}
    if a.part:
        with open(os.path.join(OUT, f'manifest.{a.part}.json'), 'w') as f:
            json.dump({**record, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
        print(f'part {a.part}: {len(clips)} clips', flush=True)
        return
    # Drop clips for lines that are gone, and files from other recordings.
    keep = {l['key'] for l in lines}
    clips = {k: v for k, v in clips.items() if k in keep}
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f[:-4] not in clips:
            os.remove(os.path.join(OUT, f))
    with open(mpath, 'w') as f:
        json.dump({**record, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
    print(f'manifest: {len(clips)} clips', flush=True)


if __name__ == '__main__':
    sys.exit(main())
