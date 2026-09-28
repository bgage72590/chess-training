"""Records Pip's voice: renders every Kids line to public/voice/<key>.mp3 and writes
public/voice/manifest.json. Two voices can record it:

  kokoro  Kokoro, an open-weight neural voice (Apache-2.0) that runs on this machine.
          pip install kokoro-onnx lameenc; model files from github.com/thewh1teagle/kokoro-onnx/releases
          (model-files-v1.0: kokoro-v1.0.onnx, voices-v1.0.bin) in the --model directory.
  google  Google Cloud Text-to-Speech (Chirp 3 HD voices). pip install lameenc. The API key comes
          from the GOOGLE_TTS_API_KEY environment variable, or is added to each request by the
          environment's credentials (header X-Goog-Api-Key for texttospeech.googleapis.com).
          It is never written anywhere.

Pip's voices are listed in scripts/voice/voices.json (id, friendly name, engine and voice); each is
recorded into public/voice/<id>/, and public/voice/voices.json (what the app offers) then lists the
voices that are fully recorded:

  npx tsx scripts/voice/collect.ts > /tmp/lines.json
  python3 scripts/voice/render.py /tmp/lines.json --id sunny            # one voice from voices.json
  python3 scripts/voice/render.py /tmp/lines.json --model DIR --out D   # Kokoro, anywhere

To record in several places at once, give each a share of the lines and --part NAME: it records
only those, writes manifest.NAME.json and removes nothing. The next full run folds the parts in.
Only lines without a clip of this VERSION are recorded; clips for lines that are gone are removed.
--out DIR writes somewhere else (e.g. to try voices on a few sample lines).

Each clip keeps PAD of quiet before and after the words (voices can start with a second of silence,
which puts the read-along highlight ahead of the voice); retrim.py trims clips recorded before that.
"""
import argparse, base64, io, json, os, random, sys, threading, time, wave
from multiprocessing import Pool
from multiprocessing.pool import ThreadPool

ENGINES = {
    # A touch slower than normal, for young listeners. The voice speaks at this pace itself;
    # slowing clips down in the browser instead (time-stretching) makes speech sound robotic.
    'kokoro': {'voice': 'af_heart', 'model': 'kokoro-v1.0.onnx', 'speed': 0.94},  # full precision: int8 is buzzier
    # (Chirp 3 HD ignores a pace close to 1: 0.95 sounds like 1.0, 0.85 is 5-19% slower, 0.75 19-33%.
    # 0.85 was chosen by ear from scripts/voice/audition.py.)
    'google': {'voice': 'en-US-Chirp3-HD-Leda', 'speed': 0.85},
}
BITRATE = 64
PAD = 0.08  # seconds of quiet kept before and after the words
TRIM = f'@trim{round(PAD * 1000)}'  # in the version of trimmed recordings
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'voice')
MASTER = os.path.join(os.path.dirname(__file__), 'voices.json')
PUBLIC_ROOT = OUT

ENGINE = 'kokoro'
VOICE = ENGINES['kokoro']['voice']
SPEED = ENGINES['kokoro']['speed']
MODEL_DIR = None
_k = None


def version():
    """Changing any of these re-records every clip (and the app drops cached clips of another version)."""
    if ENGINE == 'kokoro':
        return f"{VOICE}@{ENGINES['kokoro']['model']}@{SPEED}@{BITRATE}k{TRIM}"
    return f'{ENGINE}:{VOICE}@{SPEED}@{BITRATE}k{TRIM}'


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


_pace = {'lock': threading.Lock(), 'next': 0.0, 'gap': 0.0}


def pace():
    """Spaces requests evenly across threads (--rpm), so several recordings at once stay under Google's quota."""
    if not _pace['gap']:
        return
    with _pace['lock']:
        now = time.monotonic()
        wait = max(0.0, _pace['next'] - now)
        _pace['next'] = max(now, _pace['next']) + _pace['gap']
    if wait:
        time.sleep(wait)


def speak_google(text, use_rate=True):
    import urllib.error, urllib.request
    import numpy as np
    config = {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000}
    if use_rate:
        config['speakingRate'] = SPEED
    body = {'input': {'text': text}, 'voice': {'languageCode': VOICE[:5], 'name': VOICE}, 'audioConfig': config}
    headers = {'Content-Type': 'application/json'}
    if os.environ.get('GOOGLE_TTS_API_KEY'):
        headers['X-Goog-Api-Key'] = os.environ['GOOGLE_TTS_API_KEY']
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', data=json.dumps(body).encode(), headers=headers)
    for attempt in range(12):
        pace()
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode('utf8', 'replace')
            if e.code == 400 and use_rate and 'rate' in msg.lower():
                return speak_google(text, use_rate=False)  # a voice without pace control
            if e.code in (429, 500, 502, 503, 504) and attempt < 11:
                time.sleep(min(2 ** attempt, 30) + random.random() * 3)  # a quota is per minute: wait it out
                continue
            hint = ' (no key reached Google: set GOOGLE_TTS_API_KEY or add an X-Goog-Api-Key credential for texttospeech.googleapis.com)' if e.code in (401, 403) or 'API key' in msg else ''
            raise RuntimeError(f'Google TTS {e.code}: {msg}{hint}') from None
    with wave.open(io.BytesIO(base64.b64decode(data['audioContent']))) as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return pcm, sr


def trim(audio, sr):
    """Cuts the silence before and after the words, keeping PAD at each end (adding silence where the
    recording has less). Words are the 10 ms stretches within 40 dB of the loudest, measured twice:
    without the inaudible rumble below ~100 Hz some voices start with, and tilted toward high
    pitches, so a soft 'f', 's' or 'h' counts. The cut ends fade over 10 ms, so they never click."""
    import numpy as np
    x = np.asarray(audio, dtype=np.float32)
    w, pad = sr // 100, int(sr * PAD)
    n = len(x) // w
    if not n:
        return x
    f = np.fft.rfftfreq(len(x), 1 / sr)
    no_rumble = np.fft.irfft(np.fft.rfft(x) * np.clip((f - 60) / 60, 0, 1), len(x))
    tilted = np.diff(x, prepend=x[:1])

    def loud(y):
        p = np.convolve(np.mean(y[: n * w].reshape(n, w) ** 2, axis=1), np.ones(3) / 3, 'same')  # over 30 ms: a click is no word
        return p > p.max() * 1e-4

    words = np.flatnonzero(loud(no_rumble) | loud(tilted))
    if not len(words):
        return x
    start, end = words[0] * w, (words[-1] + 1) * w
    a, b = max(0, start - pad), min(len(x), end + pad)
    out = x[a:b].copy()
    fade_in, fade_out = min(w, start - a), min(w, b - end)
    out[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    out[len(out) - fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)
    silence = lambda k: np.zeros(k, dtype=np.float32)
    return np.concatenate([silence(pad - (start - a)), out, silence(pad - (b - end))])


def encode(audio, sr, bitrate=BITRATE):
    import numpy as np, lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes()) + enc.flush()


def render(line):
    import numpy as np
    samples, sr = speak_kokoro(line['text']) if ENGINE == 'kokoro' else speak_google(line['text'])
    audio = trim(samples, sr)
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio * min(1.0, 0.89 / peak)
    with open(os.path.join(OUT, line['key'] + '.mp3'), 'wb') as f:
        f.write(encode(audio, sr))
    return line['key'], round(len(audio) / sr * 1000)


def main():
    global ENGINE, VOICE, SPEED, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument('lines')
    ap.add_argument('--engine', choices=sorted(ENGINES), default='kokoro')
    ap.add_argument('--voice', help='voice name (default: the engine\'s)')
    ap.add_argument('--model', help='Kokoro model directory')
    ap.add_argument('--jobs', type=int, default=None, help='parallel workers (default: CPUs for Kokoro, 6 for Google)')
    ap.add_argument('--speed', type=float, help="speaking pace (default: the engine's); a new pace records every clip again")
    ap.add_argument('--rpm', type=float, default=0, help='most requests per minute (Google allows about 200 in all: give each of several recordings a share)')
    ap.add_argument('--part', help='record only these lines into manifest.PART.json')
    ap.add_argument('--out', help='output directory')
    ap.add_argument('--id', help="a voice from public/voice/voices.json (records into public/voice/<id>)")
    a = ap.parse_args()
    if a.id:
        entry = next((v for v in json.load(open(MASTER))['voices'] if v['id'] == a.id), None)
        if not entry:
            ap.error(f'no voice {a.id} in voices.json')
        a.engine, a.voice, a.out = entry['engine'], a.voice or entry['voice'], a.out or os.path.join(OUT, a.id)
    if not a.out:
        ap.error('give --id or --out')
    ENGINE = a.engine
    _pace['gap'] = 60.0 / a.rpm if a.rpm else 0.0
    VOICE = a.voice or ENGINES[ENGINE]['voice']
    SPEED = a.speed or ENGINES[ENGINE]['speed']
    if a.out:
        OUT = a.out
    if ENGINE == 'kokoro' and not a.model:
        ap.error('--model is required for Kokoro')
    VERSION = version()
    os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(a.lines))
    mpath = os.path.join(OUT, 'manifest.json')
    old = json.load(open(mpath)) if os.path.exists(mpath) else {'clips': {}}
    stale = old.get('version') != VERSION  # recorded another way: record everything again
    clips = {} if stale else {k: v for k, v in old.get('clips', {}).items() if os.path.exists(os.path.join(OUT, k + '.mp3'))}
    # Parts recorded elsewhere (--part): fold them in.
    for f in sorted(os.listdir(OUT)):
        if f.startswith('manifest.') and f.endswith('.json') and f != 'manifest.json' and not a.part:
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
    record = {'v': 1, 'voice': VOICE, 'version': VERSION}

    def checkpoint():
        """Saves the clips so far: a recording that stops (a quota, a network error) carries on from here."""
        tmp = mpath + '.tmp'
        with open(tmp, 'w') as f:
            json.dump({**record, 'clips': dict(sorted(clips.items()))}, f, separators=(',', ':'))
        os.replace(tmp, mpath)

    pool = Pool(jobs, initializer=init_kokoro, initargs=(a.model,)) if ENGINE == 'kokoro' else ThreadPool(jobs)
    with pool:
        for key, ms in pool.imap_unordered(render, todo, chunksize=2 if ENGINE == 'kokoro' else 1):
            clips[key] = ms
            done += 1
            if done % 25 == 0:
                print(f'  {done}/{len(todo)}', flush=True)
                if not a.part:
                    checkpoint()
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
    if a.id:
        publish(len(lines))


def publish(total):
    """Offers the app every voice from the master list whose recording is complete."""
    master = json.load(open(MASTER))
    done = []
    for v in master['voices']:
        mp = os.path.join(PUBLIC_ROOT, v['id'], 'manifest.json')
        if os.path.exists(mp) and len(json.load(open(mp)).get('clips', {})) >= total:
            done.append(v)
    if not done:
        return
    ids = [v['id'] for v in done]
    out = {'default': master['default'] if master['default'] in ids else ids[0], 'voices': done}
    with open(os.path.join(PUBLIC_ROOT, 'voices.json'), 'w') as f:
        json.dump(out, f, indent=2)
        f.write('\n')
    print('offered voices:', ', '.join(ids), flush=True)


if __name__ == '__main__':
    sys.exit(main())
