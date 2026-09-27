"""Records the same few Pip lines in several voices, one MP3 per voice, to choose Pip's voice.

  python3 scripts/voice/try_voices.py OUT_DIR --engine google Leda Aoede Zephyr
  python3 scripts/voice/try_voices.py OUT_DIR --engine kokoro --model DIR af_heart af_bella
"""
import argparse, json, os, subprocess, sys, tempfile

SAMPLES = [
    "Hi! I'm Pip. Let's play chess together!",
    "Welcome to Rook Road! Rooks zoom in straight lines.",
    "Oops, Tuck left a knight alone! Can you find it?",
    "Great job! You found every star. Want to try a Super Star?",
]

ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('voices', nargs='+')
ap.add_argument('--engine', default='google')
ap.add_argument('--model')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
with tempfile.TemporaryDirectory() as tmp:
    lines = os.path.join(tmp, 'lines.json')
    json.dump([{'key': f's{i}', 'text': t} for i, t in enumerate(SAMPLES)], open(lines, 'w'))
    for v in a.voices:
        name = v if a.engine != 'google' or '-' in v else f'en-US-Chirp3-HD-{v}'
        d = os.path.join(tmp, v)
        cmd = [sys.executable, os.path.join(here, 'render.py'), lines, '--engine', a.engine, '--voice', name, '--out', d, '--jobs', '2']
        if a.model:
            cmd += ['--model', a.model]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
        with open(os.path.join(a.out, f'pip-{v}.mp3'), 'wb') as f:
            for i in range(len(SAMPLES)):
                f.write(open(os.path.join(d, f's{i}.mp3'), 'rb').read())
        print('wrote', os.path.join(a.out, f'pip-{v}.mp3'), flush=True)
