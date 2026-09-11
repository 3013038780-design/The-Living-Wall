import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const model = new URL('public/models/hand_landmarker.task', root);
const source =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const expected =
  'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const hash = (b) => createHash('sha256').update(b).digest('hex');
await mkdir(new URL('public/models/', root), { recursive: true });
let current;
try {
  current = await readFile(model);
} catch {}
if (!current || hash(current) !== expected) {
  const response = await fetch(source);
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (hash(data) !== expected) throw new Error('Model checksum mismatch');
  await writeFile(model, data);
}
await mkdir(new URL('public/mediapipe/', root), { recursive: true });
for (const name of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  await copyFile(
    new URL(`node_modules/@mediapipe/tasks-vision/wasm/${name}`, root),
    new URL(`public/mediapipe/${name}`, root),
  );
}
console.log('Local hand-tracking assets ready:', fileURLToPath(model));
