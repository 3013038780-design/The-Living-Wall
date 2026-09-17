import test from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createBatch,
  inventory,
  sha256,
  targetProvenance,
  sourceIdentity,
} from '../scripts/recording-batch.mjs';

async function root(t) {
  const path = await mkdtemp(join(tmpdir(), 'lighting-batches-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
const manifest = async (batch) =>
  JSON.parse(await readFile(join(batch.directory, 'manifest.json'), 'utf8'));

void test('second recording cannot change first batch artifacts or manifest', async (t) => {
  const dir = await root(t);
  const first = await createBatch(dir);
  await first.write('capture.png', Buffer.from('first capture'));
  await first.finish('passed', { required: ['capture.png'] });
  const before = await readFile(join(first.directory, 'manifest.json'));
  const second = await createBatch(dir);
  await second.write('capture.png', Buffer.from('second capture'));
  await second.finish('passed', { required: ['capture.png'] });
  assert.notEqual(first.id, second.id);
  assert.deepEqual(
    await readFile(join(first.directory, 'manifest.json')),
    before,
  );
  assert.equal(
    await readFile(join(first.directory, 'capture.png'), 'utf8'),
    'first capture',
  );
  assert.equal((await manifest(first)).visualReview, 'pending');
  await assert.rejects(first.write('extra.json', '{}'), /finalized/);
});

void test('parallel recordings at an identical timestamp remain isolated', async (t) => {
  const dir = await root(t);
  const now = new Date('2026-09-17T00:00:00.000Z');
  const batches = await Promise.all(
    Array.from({ length: 12 }, () => createBatch(dir, {}, { now })),
  );
  assert.equal(new Set(batches.map((batch) => batch.id)).size, 12);
  await Promise.all(
    batches.map((batch) =>
      batch.write('capture.json', JSON.stringify({ id: batch.id })),
    ),
  );
  for (const batch of batches)
    assert.equal(
      JSON.parse(await readFile(join(batch.directory, 'capture.json'), 'utf8'))
        .id,
      batch.id,
    );
});

void test('directory collision and duplicate artifacts preserve existing bytes', async (t) => {
  const dir = await root(t);
  const options = { now: new Date('2026-09-17T00:00:00Z'), uuid: 'collision' };
  const batch = await createBatch(dir, {}, options);
  const before = await readFile(join(batch.directory, 'manifest.json'));
  await assert.rejects(createBatch(dir, {}, options), { code: 'EEXIST' });
  assert.deepEqual(
    await readFile(join(batch.directory, 'manifest.json')),
    before,
  );
  await batch.write('capture.json', 'original');
  await assert.rejects(batch.write('capture.json', 'replacement'), {
    code: 'EEXIST',
  });
  assert.equal(
    await readFile(join(batch.directory, 'capture.json'), 'utf8'),
    'original',
  );
  await assert.rejects(batch.finish('passed', { required: ['capture.json'] }), {
    code: 'EEXIST',
  });
  await batch.finish('failed', { error: 'Duplicate output' });
  assert.equal((await manifest(batch)).status, 'failed');
});

void test('failed file write never permits a passed manifest', async (t) => {
  const batch = await createBatch(await root(t));
  // A conflicting file is a portable filesystem write failure (also under root).
  await writeFile(join(batch.directory, 'video.webm'), 'sentinel');
  await assert.rejects(batch.write('video.webm', 'new video'));
  await assert.rejects(batch.finish('passed', { required: ['video.webm'] }));
  assert.equal((await manifest(batch)).status, 'running');
  await batch.finish('failed', { error: 'Recording write failed' });
  assert.equal((await manifest(batch)).status, 'failed');
});

void test('interrupted running batch remains incomplete and is not resumed', async (t) => {
  const dir = await root(t);
  const interrupted = await createBatch(dir);
  await interrupted.write('partial.json', '{}');
  const before = await readFile(join(interrupted.directory, 'manifest.json'));
  const next = await createBatch(dir);
  assert.notEqual(next.id, interrupted.id);
  assert.deepEqual(
    await readFile(join(interrupted.directory, 'manifest.json')),
    before,
  );
  assert.equal((await manifest(interrupted)).status, 'running');
});

void test('hashes and required artifacts are checked before completion', async (t) => {
  const batch = await createBatch(await root(t));
  await batch.write('capture.json', '{"ok":true}');
  await assert.rejects(
    batch.finish('passed', { required: ['missing.webm'] }),
    /Missing/,
  );
  await batch.finish('passed', { required: ['capture.json'] });
  const result = await manifest(batch);
  assert.deepEqual(result.files, [
    { path: 'capture.json', bytes: 11, sha256: sha256('{"ok":true}') },
  ]);
  assert.deepEqual(await inventory(batch.directory), result.files);
});

void test('unexpected directories and path traversal cannot become artifacts', async (t) => {
  const batch = await createBatch(await root(t));
  await assert.rejects(batch.write('../escape.json', '{}'), /Invalid/);
  await mkdir(join(batch.directory, 'nested'));
  await assert.rejects(inventory(batch.directory), /Unexpected/);
});

void test('custom URLs never inherit recorder source provenance', () => {
  const source = { commit: 'abc', dirty: true, sourceSha256: 'def' };
  assert.deepEqual(targetProvenance(undefined, source), {
    verification: 'owned-local-server',
    source,
  });
  for (const url of ['http://localhost:3017', 'https://example.com']) {
    const target = targetProvenance(url, source);
    assert.equal(target.verification, 'unverified');
    assert.equal(target.source, null);
  }
});

void test('custom output root is excluded but real source changes remain detectable', async (t) => {
  const dir = await root(t);
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', `safe.directory=${dir.replaceAll('\\', '/')}`, ...args],
      { cwd: dir, stdio: 'pipe' },
    );
  git('init');
  await writeFile(join(dir, 'app.js'), 'original');
  git('add', 'app.js');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'fixture',
  );
  const outputRoot = join(dir, 'custom-recordings');
  const before = await sourceIdentity(dir, outputRoot);
  assert.equal(before.dirty, false);
  const batch = await createBatch(outputRoot);
  await batch.write('capture.json', '{}');
  assert.deepEqual(await sourceIdentity(dir, outputRoot), before);
  await writeFile(join(dir, 'app.js'), 'changed');
  const after = await sourceIdentity(dir, outputRoot);
  assert.equal(after.dirty, true);
  assert.notEqual(after.sourceSha256, before.sourceSha256);
  await assert.rejects(sourceIdentity(dir, dir), /repository root/);
});
