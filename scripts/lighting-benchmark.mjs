import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ts = require('typescript');
const root = process.cwd().replaceAll('\\', '/') + '/';
const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  ).toString('base64');
const creature = moduleUrl(await readFile(root + 'lib/creature.ts', 'utf8'));
const before = execFileSync(
  'git',
  [
    '-c',
    'safe.directory=E:/03_obsidian_sync/ob_sync/102_living_wall',
    'show',
    '95300a3:lib/draw-creature.ts',
  ],
  { cwd: root, encoding: 'utf8' },
);
const current = await readFile(root + 'lib/draw-creature.ts', 'utf8');
const sources = [before, current].map((s) =>
  moduleUrl(s.replace('./creature.ts', creature)),
);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const results = [];
for (const [width, height, dpr] of [
  [1280, 720, 1],
  [1920, 1080, 1],
  [599, 498, 1],
  [1280, 720, 2],
]) {
  for (let revision = 0; revision < 2; revision++) {
    const r = await page.evaluate(
      async ({ source, creature, width, height, dpr }) => {
        const { Creature } = await import(creature);
        const { CreatureRenderer } = await import(source);
        const canvas = document.createElement('canvas');
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        document.body.replaceChildren(canvas);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const model = new Creature();
        model.resize(width, height);
        const renderer = new CreatureRenderer();
        const times = [];
        for (let i = 0; i < 100; i++) {
          await new Promise(requestAnimationFrame);
          model.step(1 / 60, { x: 0, y: 0, speed: 0, seen: false });
          const t = performance.now();
          renderer.draw(ctx, width, height, 1 / 60, model, false);
          if (i >= 20) times.push(performance.now() - t);
        }
        times.sort((a, b) => a - b);
        return { medianMs: times[40], p95Ms: times[76], samples: times.length };
      },
      { source: sources[revision], creature, width, height, dpr },
    );
    results.push({
      revision: revision ? 'current' : '95300a3',
      width,
      height,
      dpr,
      ...r,
    });
  }
}
await writeFile(
  root + 'docs/references/lighting/qa/performance.json',
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
await browser.close();
