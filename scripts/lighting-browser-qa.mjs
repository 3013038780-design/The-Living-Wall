// Run against the development server. PLAYWRIGHT_MODULE can point to a bundled Playwright.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = 'docs/references/lighting/qa';
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.QA_URL || 'http://localhost:3022/', {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => window.qaTools.get_creature_state);
  await page.waitForTimeout(1500);
  const state = () =>
    page.evaluate(() => window.qaTools.get_creature_state.execute({}));
  const records = [];
  const captures = [];
  const shot = async (name) => {
    const capture = await page.evaluate(() => {
      const s = window.qaTools.get_creature_state.execute({});
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
    });
    records.push({ stage: name, ...capture.s });
    captures.push([
      `${root}/${name}.png`,
      Buffer.from(capture.full.split(',')[1], 'base64'),
    ]);
    captures.push([
      `${root}/${name}-detail.png`,
      Buffer.from(capture.detail.split(',')[1], 'base64'),
    ]);
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
    while (performance.now() - began < 12000) {
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
      if (!captured && t > 6 && s.disturb > 0.6) {
        await shot(`final-${mode}`);
        captured = true;
      }
    }
    if (!captured) await shot(`final-${mode}`);
  }
  await page.mouse.move(-1, -1);
  await page.waitForTimeout(5000);
  await shot('final-release');
  s = await state();
  await page.mouse.move(s.x * 1280 - 240, s.y * 720);
  await page.waitForTimeout(80);
  await page.mouse.move(s.x * 1280 + 40, s.y * 720);
  await page.waitForTimeout(300);
  await shot('final-fast');
  await page.mouse.move(-1, -1);
  await page.waitForTimeout(6000);
  await page.waitForFunction(
    () => window.qaTools.get_creature_state.execute({}).alarm < 0.01,
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
  for (const [path, bytes] of captures) await writeFile(path, bytes);
  await writeFile(
    `${root}/final-breath-strokes-recovery.webm`,
    Buffer.from(video, 'base64'),
  );
  await writeFile(
    `${root}/browser-results.json`,
    JSON.stringify(
      { viewport: '1280x720', dpr: 1, errors, timings, records },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ errors, timings, records }, null, 2));
} finally {
  await browser.close();
}
