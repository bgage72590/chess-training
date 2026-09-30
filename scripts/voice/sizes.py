"""Writes each voice's total clip size into public/voice/<id>/manifest.json as "bytes", so the app can
say how big a voice is before it is downloaded ("Download 44 MB"). render.py writes it for new
recordings; this adds it to manifests recorded before, without touching anything else in them (the
"version" stays as it is, so clips already cached on people's devices stay valid).

  python3 scripts/voice/sizes.py            # every voice in public/voice
  python3 scripts/voice/sizes.py sunny rocket
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'voice')


def clip_bytes(directory, clips):
    return sum(os.path.getsize(os.path.join(directory, k + '.mp3')) for k in clips)


def add_bytes(text, size):
    """The manifest text with "bytes" set: replaced in place if present, else put before "clips"."""
    if re.search(r'"bytes":\d+,', text):
        return re.sub(r'"bytes":\d+,', f'"bytes":{size},', text, count=1)
    return text.replace('"clips":{', f'"bytes":{size},"clips":{{', 1)


def main():
    ids = sys.argv[1:] or sorted(d for d in os.listdir(ROOT) if os.path.isfile(os.path.join(ROOT, d, 'manifest.json')))
    for voice in ids:
        directory = os.path.join(ROOT, voice)
        path = os.path.join(directory, 'manifest.json')
        with open(path, encoding='utf8') as f:
            text = f.read()
        old = json.loads(text)
        size = clip_bytes(directory, old['clips'])
        new = add_bytes(text, size)
        check = json.loads(new)
        assert {k: v for k, v in check.items() if k != 'bytes'} == {k: v for k, v in old.items() if k != 'bytes'}, f'{voice}: manifest changed beyond bytes'
        assert check['bytes'] == size
        if new != text:
            with open(path, 'w', encoding='utf8') as f:
                f.write(new)
        print(f'{voice}: {len(old["clips"])} clips, {size} bytes ({size / 1e6:.1f} MB), version {old.get("version")}')


if __name__ == '__main__':
    sys.exit(main())
