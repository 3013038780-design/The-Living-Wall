import { Creature, ease, RIPPLE_SPEED, DISTURB_NEAR_AMP } from './creature.ts';

/** Issue #22: layered near-white brick body, tuned to the supplied references. */
export const FRAGMENT_COUNT = 720;
const CORE_COUNT = 64;
const BODY_END = 672;
const TAU = Math.PI * 2;

function noise(i: number, salt: number) {
  let x = Math.imul(i + 1, 374761393) ^ Math.imul(salt, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

type Brick = {
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radial: number;
  depth: number;
  length: number;
  thickness: number;
  seed: number;
  rotation: number;
  curl: number;
  ready: boolean;
};

function makeBrick(i: number): Brick {
  return {
    i,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    curl: 0,
    ready: false,
    // A stratified disc avoids accidental empty wedges and bright random clumps.
    angle: i * 2.399963229728653,
    radial:
      i < CORE_COUNT
        ? (i + 0.5) / CORE_COUNT
        : i < BODY_END
          ? (i - CORE_COUNT + 0.5) / (BODY_END - CORE_COUNT)
          : noise(i, 1),
    depth: noise(i, 3),
    length: noise(i, 4),
    thickness: noise(i, 5),
    seed: noise(i, 6) * TAU,
  };
}

export class CreatureRenderer {
  private atlas: OffscreenCanvas | null = null;
  private atlasMaturity = -1;
  private bodyHeading = 0;

  private prepareAtlas(maturity: number) {
    const level = Math.round(maturity * 24);
    if (this.atlasMaturity === level || typeof OffscreenCanvas === 'undefined')
      return;
    this.atlas ??= new OffscreenCanvas(2304, 336);
    const g = this.atlas.getContext('2d');
    if (!g) return;
    this.atlasMaturity = level;
    g.clearRect(0, 0, 2304, 336);
    for (let layer = 0; layer < 3; layer++) {
      for (let color = 0; color < 8; color++) {
        g.save();
        g.translate(color * 288 + 48, layer * 112 + 40);
        const hue = 190 + color * 45;
        const saturation = color === 0 ? 0 : (level / 24) * 55;
        const ink = (alpha: number) =>
          `hsla(${hue},${saturation}%,96%,${alpha})`;
        // Blur is baked once into the atlas, never applied to individual live shards.
        g.shadowColor = ink(0.7);
        g.shadowBlur = 17;
        g.fillStyle = ink(0.2);
        g.fillRect(0, 0, 192, 24);
        g.shadowBlur = 0;
        const face = g.createLinearGradient(0, 0, 0, 24);
        face.addColorStop(0, ink(0.17 + layer * 0.025));
        face.addColorStop(0.35, ink(0.38 + layer * 0.035));
        face.addColorStop(1, ink(0.08));
        g.fillStyle = face;
        g.fillRect(0, 0, 192, 24);
        g.fillStyle = ink(0.48 + layer * 0.13);
        g.fillRect(0, 0, 192, 1.3);
        g.fillStyle = ink(0.21 + layer * 0.065);
        g.fillRect(0, 1, 1.1, 23);
        g.fillRect(191, 1, 1, 23);
        g.fillRect(0, 23, 192, 1);
        g.restore();
      }
    }
  }

  particles = Array.from({ length: FRAGMENT_COUNT }, (_, i) =>
    makeBrick(i),
  ).sort((a, b) => a.depth - b.depth);

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dt: number,
    c: Creature,
    marker: boolean,
  ) {
    if (w <= 0 || h <= 0) return;
    dt = Math.max(0, Math.min(dt, 0.05));
    const unit = Math.min(w, h);
    const cx = c.x * w,
      cy = c.y * h;
    const base = unit * 0.165 * c.growthScale;
    const t = c.time;
    const breathe = 1 + (c.breath - 0.5) * (0.15 + c.enjoyment * 0.06);
    // Looking around must not turn an idle horizontal light body into a vertical stack.
    // Touch gradually frees the body's orientation; the behaviour heading is unchanged.
    const targetHeading = c.enjoyment > 0.05 ? c.heading : 0;
    const turn = Math.atan2(
      Math.sin(targetHeading - this.bodyHeading),
      Math.cos(targetHeading - this.bodyHeading),
    );
    this.bodyHeading +=
      turn * (1 - Math.exp(-dt * (c.enjoyment > 0.05 ? c.enjoyment * 2 : 1.5)));
    const heading = this.bodyHeading,
      cos = Math.cos(heading),
      sin = Math.sin(heading);
    const stretchAmp = c.stretchAmp();
    const wux = stretchAmp > 0.001 ? c.stretchX / stretchAmp : 0;
    const wuy = stretchAmp > 0.001 ? c.stretchY / stretchAmp : 0;
    const lux = wux * cos + wuy * sin,
      luy = -wux * sin + wuy * cos;
    const elongate = stretchAmp * (1 + 0.75 * Math.abs(wuy));
    const squash = Math.min(0.38, stretchAmp * (0.5 + 0.75 * Math.abs(wuy)));
    const toward = Math.hypot(c.lookX * w - cx, c.lookY * h - cy);
    const tipLength = Math.min(toward, base * 2.4) * c.feeler;
    const breathLight = 0.94 + c.breath * 0.06;
    this.prepareAtlas(c.maturity);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.05);
    glow.addColorStop(0, `rgba(250,251,255,${0.2 * breathLight})`);
    glow.addColorStop(0.4, 'rgba(250,251,255,0.085)');
    glow.addColorStop(1, 'rgba(250,251,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - base * 1.05, cy - base * 1.05, base * 2.1, base * 2.1);

    for (const p of this.particles) {
      const isCore = p.i < CORE_COUNT,
        isScout = p.i >= BODY_END;
      const radiusN = isCore
        ? Math.sqrt(p.radial) * 0.43
        : isScout
          ? 0.78 + p.radial * 0.26
          : 0.025 + Math.pow(p.radial, 0.7) * 0.99;
      const rim = Math.max(0, (radiusN - 0.65) / 0.4);
      const a = p.angle + Math.sin(t * 0.14 + p.seed) * 0.045;
      const radius =
        base *
        radiusN *
        (isCore ? c.core : c.radius) *
        breathe *
        (0.87 + p.depth * 0.2);
      let qx = Math.cos(a) * radius * (1.25 + c.openness * 0.14);
      let qy =
        Math.sin(a) * radius * (0.62 + c.openness * 0.1 - c.alarm * 0.12);
      qx += Math.sin(a * 3 + t * 0.32) * base * 0.02 * radiusN;
      qy += Math.cos(a * 4 - t * 0.24) * base * 0.018 * radiusN;
      if (isScout) {
        const n = (p.i - BODY_END) / (FRAGMENT_COUNT - BODY_END - 1);
        const attention = c.feeler * (p.i % 2 ? 0.82 : 0.16);
        qx = qx * (1 - attention) + (base * 0.55 + n * tipLength) * attention;
        qy =
          qy * (1 - attention) + Math.sin(n * Math.PI) * base * 0.1 * attention;
      }
      if (!isCore) {
        qx += Math.cos(a) * c.recoil * base * (0.3 + radiusN * 0.65);
        qy += Math.sin(a) * c.recoil * base * (0.25 + radiusN * 0.6);
        const localTouch = c.touchAngle - heading;
        const facing = Math.max(0, Math.cos(Math.atan2(qy, qx) - localTouch));
        qx += Math.cos(localTouch) * base * c.enjoyment * facing * 0.16;
        qy += Math.sin(localTouch) * base * c.enjoyment * facing * 0.16;
      }
      if (stretchAmp > 0.001 && !isScout) {
        const along = qx * lux + qy * luy;
        const ax = qx - lux * along,
          ay = qy - luy * along;
        qx = lux * along * (1 + elongate) + ax * (1 - squash);
        qy = luy * along * (1 + elongate) + ay * (1 - squash);
      }
      let wx = cx + qx * cos - qy * sin;
      let wy = cy + qx * sin + qy * cos;
      if (isScout) {
        // Exploration still follows the actual attention direction.
        wx = cx + qx * Math.cos(c.heading) - qy * Math.sin(c.heading);
        wy = cy + qx * Math.sin(c.heading) + qy * Math.cos(c.heading);
      }
      let disturbBoost = 0,
        bend = 0;
      if (c.disturbIntensity > 0.001 && !isScout) {
        disturbBoost = c.disturbWeight(wx / w, wy / h);
        if (disturbBoost > 0.001) {
          const dx = wx - c.disturbX * w,
            dy = wy - c.disturbY * h;
          const dist = Math.hypot(dx, dy);
          bend = disturbBoost * 1.15;
          const cb = Math.cos(bend),
            sb = Math.sin(bend);
          const push = base * DISTURB_NEAR_AMP * disturbBoost;
          const radial = dist > 0.5 ? push / dist : 0;
          wx += dx * (cb - 1) - dy * sb + dx * radial;
          wy += dx * sb + dy * (cb - 1) + dy * radial;
        }
      }
      let rippleBoost = 0;
      if (!isScout) {
        for (const ripple of c.ripples) {
          const dx = wx - ripple.x * w,
            dy = wy - ripple.y * h;
          const dist = Math.hypot(dx, dy);
          const front = ripple.age * RIPPLE_SPEED * unit;
          const band = base * 0.22;
          const strength =
            ripple.amp *
            Math.exp(-((dist - front) ** 2) / (2 * band * band)) *
            Math.max(0, 1 - ripple.age / ripple.life);
          rippleBoost = Math.max(rippleBoost, strength);
          if (dist > 0.5) {
            wx += (dx / dist) * base * strength;
            wy += (dy / dist) * base * strength;
          }
        }
      }
      if (!p.ready) {
        p.x = wx;
        p.y = wy;
        p.ready = true;
      }
      const stiffness = isCore ? 35 : isScout ? 15 : 15 + p.depth * 5;
      const damping = Math.exp(-dt * (isCore ? 9 : 7));
      p.vx = (p.vx + (wx - p.x) * stiffness * dt) * damping;
      p.vy = (p.vy + (wy - p.y) * stiffness * dt) * damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.curl = ease(p.curl, disturbBoost, 9, dt);
      p.rotation = ease(
        p.rotation,
        Math.sin(p.seed) * (0.015 + p.depth * 0.045 + p.curl * 0.4) +
          bend * 1.25,
        10,
        dt,
      );
      const alpha =
        (0.26 + p.depth * 0.42) *
        (isScout ? 0.6 : 1 - rim * 0.38) *
        breathLight;
      const feedback =
        1 +
        Math.min(
          0.14,
          rippleBoost * 0.32 + disturbBoost * 0.07 + elongate * 0.08,
        );
      const saturation = c.maturity * (isCore ? 8 : 65);
      const hue = (190 + p.i * 1.8 + c.enjoyment * 35) % 360;
      const light = isCore ? 98 : 92 + p.depth * 6 - c.maturity * 10;
      const length =
        base *
        (isScout ? 0.075 + p.length * 0.13 : 0.09 + p.length * p.length * 0.25);
      const width =
        length *
        (1 - c.enjoyment * 0.4) *
        (1 - p.curl * (0.58 + p.thickness * 0.16));
      const height =
        base *
        (isScout
          ? 0.004 + p.thickness * 0.005
          : 0.024 + p.thickness * p.thickness * 0.045) *
        (0.65 + p.depth * 0.6) *
        (1 + c.enjoyment * 0.6) *
        (1 + p.curl * 0.35);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.transform(1, 0, p.curl * Math.sin(p.seed) * 0.45, 1, 0, 0);
      // Screen blending transmits the underlying layers and bounds the highlights.
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(
        1,
        (0.65 + p.depth * 0.35) * (1 - rim * 0.3) * feedback * breathLight,
      );
      if (this.atlas) {
        const color = isCore ? 0 : 1 + (p.i % 7);
        const layer = Math.min(2, Math.floor(p.depth * 3));
        ctx.drawImage(
          this.atlas,
          color * 288,
          layer * 112,
          288,
          112,
          -width * 0.75,
          -height * (0.5 + 40 / 24),
          width * 1.5,
          (height * 112) / 24,
        );
      } else {
        // Canvas implementations without OffscreenCanvas retain the same face/edge geometry.
        ctx.fillStyle = `hsla(${hue},${saturation}%,${light}%,0.28)`;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(
          -width / 2,
          -height / 2,
          width,
          Math.max(0.35, height * 0.055),
        );
      }
      if (p.curl > 0.03) {
        // A projected side face opens as the same brick turns through the local bend.
        const side = height * (0.18 + p.curl * 0.55);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `hsla(${hue},${saturation}%,76%,${p.curl * (0.2 + p.depth * 0.35)})`;
        ctx.beginPath();
        ctx.moveTo(width / 2, -height / 2);
        ctx.lineTo(width / 2 + side, -height / 2 - side * 0.6);
        ctx.lineTo(width / 2 + side, height / 2 - side * 0.6);
        ctx.lineTo(width / 2, height / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (marker && c.presence > 0.1) {
      ctx.strokeStyle = `rgba(198,239,188,${c.presence * 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.lookX * w, c.lookY * h, 9, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}
