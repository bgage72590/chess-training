"""Records Pip lines at several speaking paces (and with pause tags) to choose how Pip should sound.
Writes audition.json: scenes of lines, and for each voice and version an MP3 per line (base64),
which scripts/voice/audition.html turns into a page to listen to.

  python3 scripts/voice/audition.py OUT.json --voices sunny rocket --paces 0.95 0.85 0.75

Google's Chirp 3 HD voices ignore a pace close to 1 (0.95 sounds like 1.0): 0.85 is about 19% slower,
0.75 about 33%. Pause tags ("[pause short]") go in the `markup` input and add about half a second.
"""
import argparse, base64, io, json, os, sys, urllib.request, wave
from multiprocessing.pool import ThreadPool

sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import render as R

SCENES = [
    {'title': 'Meeting Pip', 'lines': ["Hi! I'm Pip. Let's play chess together!", "I'm Pip! This is the rook. It zooms in straight lines, like a train!"]},
    {'title': 'Teaching a rule', 'lines': ["The queen attacks the king. That's check! He can still get away.", 'Rooks go in straight lines, until something is in the way.']},
    {'title': 'Cheering', 'lines': ['Good game!', 'Your pawn is a queen!', 'You caught them all!', 'Follow the arrow!']},
    {'title': 'A miss and a hint', 'lines': ['Oops, Shelly left a rook alone! Can you find it?', "Hmm, there's a stronger move. Look for a check that hits two pieces!"]},
]


def with_pauses(text):
    """Pause tags after each sentence but the last."""
    out, parts = [], __import__('re').split(r'(?<=[.!?])\s+', text)
    for i, p in enumerate(parts):
        out.append(p + (' [pause short]' if i < len(parts) - 1 else ''))
    return ' '.join(out)


def synth(voice, text, rate, markup):
    body = {
        'input': {'markup' if markup else 'text': text},
        'voice': {'languageCode': voice[:5], 'name': voice},
        'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000, 'speakingRate': rate},
    }
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            break
        except Exception:
            if attempt == 5:
                raise
            import time
            time.sleep(2 ** attempt)
    with wave.open(io.BytesIO(base64.b64decode(data['audioContent']))) as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    audio = R.trim(pcm, sr)
    audio = audio * min(1.0, 0.89 / (float(np.max(np.abs(audio))) or 1.0))
    return base64.b64encode(R.encode(audio, sr)).decode(), round(len(audio) / sr * 1000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--voices', nargs='+', default=['sunny', 'rocket'])
    ap.add_argument('--paces', nargs='+', type=float, default=[0.95, 0.85, 0.75])
    ap.add_argument('--pause-pace', type=float, default=0.85, help='pace of the pause-tag version (0 to leave it out)')
    a = ap.parse_args()
    master = {v['id']: v for v in json.load(open(R.MASTER))['voices']}
    versions = [{'id': f'p{p}', 'pace': p, 'markup': False} for p in a.paces]
    if a.pause_pace:
        versions.append({'id': f'p{a.pause_pace}-pauses', 'pace': a.pause_pace, 'markup': True})
    jobs = []
    for vid in a.voices:
        for ver in versions:
            for si, sc in enumerate(SCENES):
                for li, text in enumerate(sc['lines']):
                    jobs.append((vid, ver, si, li, text))

    def run(j):
        vid, ver, si, li, text = j
        b64, ms = synth(master[vid]['voice'], with_pauses(text) if ver['markup'] else text, ver['pace'], ver['markup'])
        return vid, ver['id'], si, li, b64, ms

    clips = {}
    with ThreadPool(6) as pool:
        for n, (vid, verid, si, li, b64, ms) in enumerate(pool.imap_unordered(run, jobs), 1):
            clips[f'{vid}/{verid}/{si}/{li}'] = {'mp3': b64, 'ms': ms}
            if n % 10 == 0:
                print(f'  {n}/{len(jobs)}', flush=True)
    out = {'scenes': SCENES, 'voices': [{'id': v, 'name': master[v]['name']} for v in a.voices], 'versions': versions, 'clips': clips}
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(f'wrote {a.out}: {len(clips)} clips, {os.path.getsize(a.out) // 1024} KB')


if __name__ == '__main__':
    main()
