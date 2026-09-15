import test from 'node:test';
import assert from 'node:assert/strict';
import { Creature } from '../lib/creature.ts';
import { CreatureRenderer, FRAGMENT_COUNT } from '../lib/draw-creature.ts';

// Validate geometry sent to Canvas, including invisible facets, across real state transitions.
function checkedContext() {
  let balance = 0;
  const numeric = (...values: number[]) => {
    assert.ok(
      values.every(Number.isFinite),
      `invalid Canvas coordinates: ${String(values)}`,
    );
  };
  return {
    ctx: {
      save() {
        balance++;
      },
      restore() {
        assert.ok(--balance >= 0);
      },
      translate: numeric,
      rotate: numeric,
      arc: numeric,
      fillRect(x: number, y: number, w: number, h: number) {
        numeric(x, y, w, h);
        assert.ok(w >= 0 && h >= 0);
      },
      createRadialGradient(...args: number[]) {
        numeric(...args);
        return {
          addColorStop(offset: number) {
            assert.ok(offset >= 0 && offset <= 1);
          },
        };
      },
      beginPath() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D,
    balanced() {
      assert.equal(balance, 0);
    },
  };
}

void test('layer geometry is reproducible, depth ordered and overlaps the core/body boundary', () => {
  const a = new CreatureRenderer(),
    b = new CreatureRenderer();
  assert.deepEqual(a.particles, b.particles);
  assert.equal(a.particles.length, FRAGMENT_COUNT);
  assert.equal(new Set(a.particles.map((p) => p.i)).size, 720);
  assert.ok(
    a.particles.every((p, i, all) => i === 0 || all[i - 1].depth <= p.depth),
  );
  const c = new Creature();
  const harness = checkedContext();
  a.draw(harness.ctx, 1280, 720, 1 / 60, c, false);
  const middle = a.particles.filter(
    (p) =>
      p.i >= 64 &&
      p.i < 672 &&
      Math.hypot(p.x - c.x * 1280, p.y - c.y * 720) < 40,
  );
  assert.ok(
    middle.length > 60,
    'body must overlap the core instead of forming a hollow shell',
  );
  harness.balanced();
});

void test('renderer emits finite geometry in narrow, full HD, mature, startled and resting states', () => {
  for (const [w, h] of [
    [390, 844],
    [1280, 720],
    [1920, 1080],
  ]) {
    const c = new Creature();
    c.resize(w, h);
    c.care = 1800;
    const r = new CreatureRenderer();
    const harness = checkedContext();
    for (let frame = 0; frame < 360; frame++) {
      if (frame === 240) {
        c.resting = true;
        c.restTime = 5;
      }
      c.step(1 / 60, {
        x: c.x + 0.05,
        y: c.y,
        speed: frame < 120 ? 0.15 : frame < 150 ? 2 : 0,
        seen: frame < 240,
      });
      r.draw(harness.ctx, w, h, frame === 200 ? 1 : 1 / 60, c, true);
      harness.balanced();
    }
  }
});

void test('touch bends existing fragments and decays after release without replacing them', () => {
  const c = new Creature();
  c.resize(1280, 720);
  const r = new CreatureRenderer();
  const harness = checkedContext();
  const identities = [...r.particles];
  c.disturbX = c.x + 0.04;
  c.disturbY = c.y;
  c.disturbIntensity = 1;
  for (let i = 0; i < 90; i++) r.draw(harness.ctx, 1280, 720, 1 / 60, c, false);
  const peak = Math.max(...r.particles.map((p) => p.curl));
  assert.ok(peak > 0.5);
  assert.ok(r.particles.some((p) => p.rotation > 0.5));
  for (let i = 0; i < 180; i++) {
    c.step(1 / 60, { x: 0, y: 0, speed: 0, seen: false });
    r.draw(harness.ctx, 1280, 720, 1 / 60, c, false);
  }
  assert.ok(Math.max(...r.particles.map((p) => p.curl)) < 0.01);
  assert.ok(r.particles.every((p, i) => p === identities[i]));
  harness.balanced();
});
