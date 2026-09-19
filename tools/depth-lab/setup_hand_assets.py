"""Download pinned inference assets; camera frames stay on localhost."""
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent / 'hand-assets'
version = '0.10.22-rc.20250304'
assets = {'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'}
for name in ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm']:
    assets[name] = f'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@{version}/{name}'
if __name__ == '__main__':
    for name, url in assets.items():
        dest=root/name
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url, timeout=60) as response:
            data=response.read()
        temp=dest.with_suffix(dest.suffix+'.tmp')
        temp.write_bytes(data)
        temp.replace(dest)
        print(name, len(data))
