import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  lstat,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

// Hash the actual working source, including untracked (but not ignored) files.
// No absolute machine paths or file contents are exposed in the manifest.
export async function sourceIdentity(cwd) {
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, ...args],
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  const commit = git('rev-parse', 'HEAD').trim();
  const status = git('status', '--porcelain', '--untracked-files=all');
  const paths = [
    ...new Set(
      git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path + '\0');
    try {
      hash.update(await readFile(resolve(cwd, path)));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('<deleted>');
    }
    hash.update('\0');
  }
  return { commit, dirty: status.length > 0, sourceSha256: hash.digest('hex') };
}

export function targetProvenance(url, source) {
  return url
    ? {
        verification: 'unverified',
        reason: 'QA_URL: 被测版本未核实',
        source: null,
      }
    : { verification: 'owned-local-server', source };
}

export async function inventory(directory) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    if (name === 'manifest.json' || name.startsWith('.manifest-')) continue;
    const path = join(directory, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Unexpected artifact type: ${name}`);
    const bytes = await readFile(path);
    files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return files;
}

export async function createBatch(
  root,
  metadata = {},
  { now = new Date(), uuid = randomUUID() } = {},
) {
  const id = `${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}_${uuid}`;
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid batch ID');
  await mkdir(root, { recursive: true });
  const directory = resolve(root, id);
  await mkdir(directory); // EEXIST is a hard failure; never resume or overwrite.
  let manifest = {
    ...metadata,
    schemaVersion: 1,
    id,
    startedAt: now.toISOString(),
    finishedAt: null,
    status: 'running',
    visualReview: 'pending',
    files: [],
  };
  let finalized = false;
  let writeError;
  const assertOpen = () => {
    if (finalized) throw new Error('Batch is already finalized');
  };
  const persist = async (next, initial = false) => {
    const json = JSON.stringify(next, null, 2) + '\n';
    if (initial)
      await writeFile(join(directory, 'manifest.json'), json, { flag: 'wx' });
    else {
      const temp = join(directory, `.manifest-${randomUUID()}.tmp`);
      await writeFile(temp, json, { flag: 'wx' });
      await rename(temp, join(directory, 'manifest.json'));
    }
    manifest = next;
  };
  await persist(manifest, true);
  return {
    directory,
    id,
    async update(metadata) {
      assertOpen();
      // Metadata updates cannot alter lifecycle or inventory.
      const {
        status: _status,
        files: _files,
        id: _id,
        startedAt: _start,
        finishedAt: _end,
        visualReview: _review,
        schemaVersion: _schema,
        ...details
      } = metadata;
      await persist({ ...manifest, ...details });
    },
    async write(name, bytes) {
      assertOpen();
      try {
        if (
          !/^[\w-]+\.(png|webm|json|log)$/.test(name) ||
          name === 'manifest.json'
        )
          throw new Error(`Invalid artifact name: ${name}`);
        await writeFile(join(directory, name), bytes, { flag: 'wx' });
      } catch (error) {
        writeError = error;
        throw error;
      }
    },
    async finish(status, { required = [], error } = {}) {
      assertOpen();
      if (!['passed', 'failed'].includes(status))
        throw new Error('Invalid final status');
      if (status === 'passed' && writeError) throw writeError;
      const files = await inventory(directory);
      if (status === 'passed') {
        if (!required.length)
          throw new Error('Successful batches require an artifact list');
        for (const name of required) {
          if (!files.some((file) => file.path === name && file.bytes > 0))
            throw new Error(`Missing or empty required artifact: ${name}`);
        }
      }
      await persist({
        ...manifest,
        status,
        finishedAt: new Date().toISOString(),
        files,
        ...(error ? { error: String(error.message || error) } : {}),
      });
      finalized = true;
    },
  };
}
