// Imported from 8c5aa7459d14cf80a5984196cb8abe192976696d (#23).
// Default: own local server. QA_URL: existing server with unverified provenance.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer as createPortProbe } from 'node:net';
import assert from 'node:assert/strict';
import {
  createBatch,
  sha256,
  sourceIdentity,
  targetProvenance,
} from './recording-batch.mjs';
const require = createRequire(import.meta.url);
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(cwd);
const batch = await createBatch(
  resolve(process.env.QA_OUTPUT_DIR || 'outputs/lighting-recordings'),
  {
    viewport: { width: 1280, height: 720 },
    dpr: 1,
    browserVersion: null,
    target: { verification: 'unverified', source: null },
  },
);
console.log(`Recording batch: ${batch.directory}`);
let browser;
let server;
let source;
const records = [];
const errors = [];
const required = [];
let failure;
const record = async (name, bytes) => {
  await batch.write(name, bytes);
  required.push(name);
};
try {
  source = await sourceIdentity(cwd);
  const scriptHashes = {};
  for (const name of ['lighting-browser-qa.mjs', 'recording-batch.mjs']) {
    scriptHashes[name] = sha256(await readFile(resolve(cwd, 'scripts', name)));
  }
  await batch.update({
    recorder: { source, scripts: scriptHashes },
    target: targetProvenance(process.env.QA_URL, source),
  });
  let url = process.env.QA_URL;
  if (!url) {
    // Vite treats port 0 as its default port; ask the OS for a free port first.
    const probe = createPortProbe();
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', resolve);
    });
    const port = probe.address().port;
    await new Promise((resolve, reject) =>
      probe.close((error) => (error ? reject(error) : resolve())),
    );
    const { createServer } = await import('vite');
    server = await createServer({
      root: cwd,
      server: { host: '127.0.0.1', port, strictPort: true, open: false },
    });
    await server.listen();
    const address = server.httpServer.address();
    url = `http://127.0.0.1:${address.port}/`;
  }
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({
    headless: true,
    ...(process.env.QA_BROWSER_CHANNEL
      ? { channel: process.env.QA_BROWSER_CHANNEL }
      : {}),
  });
  await batch.update({ url, browserVersion: browser.version() });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    window.qaTools = {};
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool) {
          window.qaTools[tool.name] = tool;
        },
      },
    });
    window.qaFrames = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => {
        const start = performance.now();
        callback(time);
        if (window.qaFrames.length < 6000)
          window.qaFrames.push(performance.now() - start);
      });
  });
  const page = await context.newPage();
  await page.bringToFront();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForFunction(() => window.qaTools.get_creature_state);
  await page.waitForTimeout(1500);
  const state = () =>
    page.evaluate(() => window.qaTools.get_creature_state.execute({}));
  const shot = async (name, stroke = false) => {
    const capture = await page.evaluate((stroke) => {
      const s = window.qaTools.get_creature_state.execute({});
      if (stroke && !(s.disturb > 0.6 && s.stretch > 0.03)) return null;
      const canvas = document.querySelector('canvas');
      const detail = document.createElement('canvas');
      detail.width = 1000;
      detail.height = 760;
      const x = Math.max(0, Math.min(780, s.x * 1280 - 250));
      const y = Math.max(0, Math.min(340, s.y * 720 - 190));
      detail
        .getContext('2d')
        .drawImage(canvas, x, y, 500, 380, 0, 0, 1000, 760);
      return { s, full: canvas.toDataURL(), detail: detail.toDataURL() };
    }, stroke);
    if (!capture) return false;
    records.push({ stage: name, ...capture.s });
    await record(
      `${name}.png`,
      Buffer.from(capture.full.split(',')[1], 'base64'),
    );
    await record(
      `${name}-detail.png`,
      Buffer.from(capture.detail.split(',')[1], 'base64'),
    );
    return true;
  };
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    window.qaChunks = [];
    window.qaRecorder = new MediaRecorder(canvas.captureStream(20), {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 1600000,
    });
    window.qaRecorder.ondataavailable = (e) => window.qaChunks.push(e.data);
    window.qaRecorder.start();
  });
  await page.waitForFunction(
    (target) =>
      window.qaTools.get_creature_state.execute({}).phaseAge >= target,
    (await state()).phaseAge + 12,
    { timeout: 90000 },
  );
  await shot('final-idle');
  // Actual pointer events through the application's normal input path, never injected FX state.
  let s = await state();
  await page.mouse.move(s.x * 1280 + 55, s.y * 720 + 35);
  await page.waitForTimeout(2000);
  for (const mode of ['horizontal', 'vertical', 'arc']) {
    const began = performance.now();
    let sampled = 0;
    let captured = false;
    // Bound the wait, but allow a slow machine to actually reach the same gate.
    while (!captured && performance.now() - began < 90000) {
      if (performance.now() - sampled > 400) {
        s = await state();
        sampled = performance.now();
      }
      const t = (performance.now() - began) / 1000;
      const dx =
        mode === 'horizontal'
          ? 45 * Math.sin(t * 1.2)
          : mode === 'vertical'
            ? 55
            : 58 * Math.cos(t);
      const dy =
        mode === 'horizontal'
          ? 45
          : mode === 'vertical'
            ? 42 * Math.sin(t * 1.2)
            : 48 * Math.sin(t);
      await page.mouse.move(s.x * 1280 + dx, s.y * 720 + dy);
      await page.waitForTimeout(35);
      if (t > 6 && s.disturb > 0.6 && s.stretch > 0.03) {
        captured = await shot(`final-${mode}`, true);
      }
    }
    if (!captured) await shot(`final-${mode}`);
  }
  await page.mouse.move(-1, -1);
  await page.waitForTimeout(5000);
  await page.waitForFunction(
    () => window.qaTools.get_creature_state.execute({}).disturb === 0,
    null,
    { timeout: 90000 },
  );
  await shot('final-release');
  s = await state();
  await page.mouse.move(s.x * 1280 - 240, s.y * 720);
  await page.mouse.move(s.x * 1280 + 40, s.y * 720);
  await page.waitForTimeout(300);
  await shot('final-fast');
  await page.mouse.move(-1, -1);
  await page.waitForTimeout(6000);
  await page.waitForFunction(
    () => window.qaTools.get_creature_state.execute({}).alarm < 0.01,
    null,
    { timeout: 90000 },
  );
  await shot('final-recovery');
  const video = await page.evaluate(async () => {
    await new Promise((resolve) => {
      window.qaRecorder.onstop = resolve;
      window.qaRecorder.stop();
    });
    const bytes = new Uint8Array(await new Blob(window.qaChunks).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  });
  const timings = await page.evaluate(() => {
    const values = window.qaFrames.slice(10).sort((a, b) => a - b);
    return {
      samples: values.length,
      callbackMedianMs: values[Math.floor(values.length * 0.5)],
      callbackP95Ms: values[Math.floor(values.length * 0.95)],
    };
  });
  // Persist diagnostics before assertions; a failed batch keeps its own evidence.
  await record(
    'final-breath-strokes-recovery.webm',
    Buffer.from(video, 'base64'),
  );
  await record(
    'browser-results.json',
    JSON.stringify(
      { viewport: '1280x720', dpr: 1, errors, timings, records },
      null,
      2,
    ),
  );
  assert.equal(errors.length, 0, 'browser errors');
  for (const mode of ['horizontal', 'vertical', 'arc']) {
    const record = records.find((r) => r.stage === `final-${mode}`);
    assert.ok(
      record.disturb > 0.5 && record.stretch > 0.03,
      `${mode} did not trigger a valid stroke`,
    );
  }
  assert.ok(
    records.find((r) => r.stage === 'final-fast').alarm > 0.1,
    'fast swipe did not trigger startle',
  );
  assert.equal(records.find((r) => r.stage === 'final-release').disturb, 0);
  assert.ok(records.find((r) => r.stage === 'final-recovery').alarm < 0.01);
  if (server)
    assert.deepEqual(
      await sourceIdentity(cwd),
      source,
      'Local source changed during recording',
    );
} catch (error) {
  failure = error;
} finally {
  for (const resource of [browser, server]) {
    try {
      await resource?.close();
    } catch (error) {
      failure ||= error;
    }
  }
}
try {
  if (failure) throw failure;
  await batch.finish('passed', { required });
  console.log(
    `PASSED (automated checks only; visual review pending): ${batch.directory}`,
  );
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  try {
    await batch.write(
      'failure.json',
      JSON.stringify(
        { error: String(error.message || error), errors, records },
        null,
        2,
      ),
    );
  } catch (diagnosticError) {
    console.error(
      'Could not save failure diagnostics:',
      diagnosticError.message,
    );
  }
  try {
    await batch.finish('failed', { error });
  } catch (manifestError) {
    console.error(
      'Could not finalize manifest; running means incomplete:',
      manifestError.message,
    );
  }
}
