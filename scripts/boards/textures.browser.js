// Procedural board textures, run inside Chromium by generate.mjs (plain script, no modules).
// Defines window.renderBoard(theme, size) -> an HTMLCanvasElement holding a full 8x8 board,
// light square at the top-left (a8 from White's side, h1 from Black's: both light).
//
// Everything is value noise + fractal Brownian motion (FBM), seeded, so reruns give the same
// images. Each square samples its own region (and, for wood, its own grain direction) of the
// material, like a board inlaid from separate pieces.
(function () {
  'use strict';

  // ---------- Seeded noise ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 2D value noise on a 256x256 lattice (wraps), smooth-stepped, range [0, 1]. */
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const table = new Float32Array(256 * 256);
    for (let i = 0; i < table.length; i++) table[i] = rnd();
    return function noise(x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const x0 = xi & 255;
      const y0 = yi & 255;
      const x1 = (x0 + 1) & 255;
      const y1 = (y0 + 1) & 255;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      const a = table[y0 * 256 + x0];
      const b = table[y0 * 256 + x1];
      const c = table[y1 * 256 + x0];
      const d = table[y1 * 256 + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function makeFbm(noise) {
    return function fbm(x, y, octaves) {
      let sum = 0;
      let amp = 0.5;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x, y);
        norm += amp;
        // Rotate a little between octaves to hide the lattice.
        const nx = x * 1.6 + y * 1.2 + 17.3;
        y = -x * 1.2 + y * 1.6 + 5.1;
        x = nx;
        amp *= 0.5;
      }
      return sum / norm;
    };
  }

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---------- Materials: (u, v) in square units -> [r, g, b] ----------

  /**
   * Straight-grained, quarter-sawn wood. u runs along the grain, v across it. `p` holds the
   * palette and the grain scale; `n`/`f` are the square's noise functions.
   */
  function wood(p, n, f, u, v) {
    // Grain lines wander slowly along the board and a little across it.
    const warp = f(u * 0.55, v * 2.2, 4) - 0.5;
    // Low-frequency warp across the grain makes the ring spacing irregular (wide and tight bands).
    const spread = p.spread ? (f(u * 0.22 + 31, v * 0.9 - 17, 3) - 0.5) * p.spread : 0;
    const t = v * p.rings + spread + warp * p.warp + (f(u * 2.2, v * 0.7 + 9.1, 3) - 0.5) * 0.9;
    const g = t - Math.floor(t);
    // Latewood: a thin darker band at the end of each growth ring, fading into earlywood.
    const late = smooth(0.62, 0.9, g) * (1 - smooth(0.9, 1.0, g));
    const strength = 0.55 + 0.9 * f(u * 0.9 + 3.3, t * 0.35, 3);
    // Pores: fine dark streaks stretched along the grain.
    const pore = smooth(0.66, 0.9, n(u * 5 + 40, v * p.pores)) * 0.55 + smooth(0.72, 0.95, n(u * 11 + 7, v * p.pores * 1.7)) * 0.35;
    // Broad figure: color drifts across the piece.
    const figure = f(u * 0.8 + 11, v * 1.6 - 4, 4);
    let c = mix3(p.base, p.alt, smooth(0.25, 0.75, figure));
    c = mix3(c, p.line, clamp(late * strength * p.lineAmt, 0, 1));
    c = mix3(c, p.pore, clamp(pore * p.poreAmt, 0, 1));
    // Chatoyance: soft bands of sheen across the grain (curly figure), subtle.
    if (p.curl) {
      const curl = Math.sin(u * p.curl + (f(u * 1.3, v * 1.3 + 50, 3) - 0.5) * 7) * f(u * 0.7 - 20, v * 0.5, 2) * 1.6;
      const k = 1 + curl * p.curlAmt;
      c = [c[0] * k, c[1] * k, c[2] * k];
    }
    return c;
  }

  /**
   * Polished marble: a cloudy, domain-warped body with long veins and a sparse network of
   * hairline cracks. `a` runs along the stone's vein direction, `b` across it.
   *
   * Veins are level lines of a "phase" field: b * freq plus turbulence. The linear term keeps
   * the lines long and running with the grain of the stone (few closed loops), and every
   * distance is divided by the field's gradient (finite differences), so a vein keeps its width
   * wherever the field is flat instead of swelling into blobs.
   */
  function marble(p, n, f, u, v, a, b) {
    const qx = f(u * 0.8, v * 0.8, 5);
    const qy = f(u * 0.8 + 5.2, v * 0.8 + 1.3, 5);
    const cloud = f(u * 0.6 + qx * 2.4, v * 0.6 + qy * 2.4, 6);
    let c = mix3(p.base, p.cloud, smooth(0.28, 0.78, cloud));
    // Lighter drifts of clouding, stretched a little along the veins.
    const drift = f(a * 0.5 + qy * 1.5 + 30, b * 1.4 + qx * 1.5 - 7, 5);
    c = mix3(c, p.drift, smooth(0.5, 0.78, drift) * p.driftAmt);

    const e = 1 / 300;
    const veinLayer = (L) => {
      const ph = (aa, bb) => {
        const t = f(aa * L.turbA + L.seed, bb * L.turbB + L.seed * 0.37, 5);
        const w = f(aa * 0.35 + L.seed * 1.7, bb * 0.35, 3);
        return bb * L.freq + (t - 0.5) * L.turb + (w - 0.5) * L.bend;
      };
      const p0 = ph(a, b);
      const ga = (ph(a + e, b) - p0) / e;
      const gb = (ph(a, b + e) - p0) / e;
      const g = Math.max(Math.hypot(ga, gb), 0.25);
      const d = Math.abs(p0 - Math.round(p0 + L.phase) + L.phase) / g; // in square units
      // Vein strength varies along its length (so veins fade in and out and seem to branch).
      const s = smooth(L.maskLo, L.maskHi, f(a * L.maskScale + L.seed * 3.1, b * L.maskScale * 1.6 - L.seed, 4));
      const core = (1 - smooth(L.width * 0.35, L.width, d)) * s;
      const halo = Math.exp(-d / L.halo) * s;
      return [core, halo];
    };
    let core = 0;
    let halo = 0;
    for (const L of p.veins) {
      const [cL, hL] = veinLayer(L);
      core = Math.max(core, cL * L.amt);
      halo = Math.max(halo, hL * L.amt);
    }
    c = mix3(c, p.halo, clamp(halo * p.haloAmt, 0, 1));
    c = mix3(c, p.vein, clamp(core * p.veinAmt, 0, 1));
    // Hairline cracks: a finer, more turbulent vein layer crossing the main ones at an angle,
    // present only in patches, thin and faint.
    if (p.crackAmt) {
      const ca = a * 0.5 - b * 0.866;
      const cb = a * 0.866 + b * 0.5;
      const cf = (aa, bb) => bb * 2.6 + (f(aa * 1.2 + 70, bb * 2 - 40, 6) - 0.5) * 3.4;
      const c0 = cf(ca, cb);
      const g = Math.max(Math.hypot((cf(ca + e, cb) - c0) / e, (cf(ca, cb + e) - c0) / e), 0.5);
      const d = Math.abs(c0 - Math.round(c0)) / g;
      const m = smooth(0.5, 0.72, f(u * 1.3 - 60, v * 1.3 + 25, 4));
      const crack = (1 - smooth(0.0012, 0.0035, d)) * m;
      c = mix3(c, p.crack, clamp(crack * p.crackAmt, 0, 1));
    }
    // Crystalline speckle.
    const sp = n(u * 90 + 3, v * 90 - 8);
    const k = 1 + (sp - 0.5) * p.speckle;
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  const THEMES = {
    walnut: {
      seed: 1907,
      light: {
        kind: 'wood',
        base: hex('#e9cf9f'),
        alt: hex('#dcb983'),
        line: hex('#c29762'),
        pore: hex('#b98d5a'),
        rings: 11,
        ringVar: 0.25,
        spread: 4,
        tintVar: 0.028,
        warp: 3.2,
        pores: 70,
        lineAmt: 0.38,
        poreAmt: 0.35,
        curl: 38,
        curlAmt: 0.014,
      },
      dark: {
        kind: 'wood',
        base: hex('#8a5a36'),
        alt: hex('#6f4527'),
        line: hex('#4a2c17'),
        pore: hex('#3d2312'),
        rings: 8,
        ringVar: 0.2,
        spread: 3,
        tintVar: 0.02,
        warp: 3.8,
        pores: 55,
        lineAmt: 0.6,
        poreAmt: 0.5,
        curl: 0,
      },
      seam: 0.34,
      bevel: 0.1,
      sheen: 0.045,
      varyPiece: 0.045,
    },
    marble: {
      seed: 4242,
      light: {
        // Carrara-like: warm white with soft grey clouding and grey veins.
        kind: 'marble',
        angle: 0.62,
        base: hex('#f1eee8'),
        cloud: hex('#e0dbd1'),
        drift: hex('#d4d0c8'),
        driftAmt: 0.35,
        vein: hex('#7f8486'),
        halo: hex('#c4c3be'),
        haloAmt: 0.42,
        veinAmt: 0.62,
        veins: [
          { seed: 3, freq: 0.9, turb: 2.2, turbA: 0.45, turbB: 0.3, bend: 1.6, phase: 0, width: 0.011, halo: 0.03, maskScale: 0.6, maskLo: 0.3, maskHi: 0.6, amt: 1 },
          { seed: 11, freq: 1.7, turb: 2.6, turbA: 0.7, turbB: 0.4, bend: 1.2, phase: 0.5, width: 0.006, halo: 0.014, maskScale: 0.9, maskLo: 0.45, maskHi: 0.7, amt: 0.6 },
        ],
        crack: hex('#9a9c9a'),
        crackAmt: 0.35,
        speckle: 0.03,
      },
      dark: {
        // Verde antico: deep green body with lighter green clouding and pale veins set into it.
        kind: 'marble',
        angle: -0.9,
        base: hex('#527264'),
        cloud: hex('#35503f'),
        drift: hex('#739a87'),
        driftAmt: 0.45,
        vein: hex('#d5e0d8'),
        halo: hex('#2a4035'),
        haloAmt: 0.35,
        veinAmt: 0.5,
        veins: [
          { seed: 5, freq: 0.8, turb: 2.4, turbA: 0.45, turbB: 0.3, bend: 1.6, phase: 0, width: 0.01, halo: 0.03, maskScale: 0.6, maskLo: 0.3, maskHi: 0.6, amt: 1 },
          { seed: 17, freq: 1.6, turb: 2.6, turbA: 0.7, turbB: 0.4, bend: 1.2, phase: 0.5, width: 0.0055, halo: 0.014, maskScale: 0.9, maskLo: 0.45, maskHi: 0.7, amt: 0.65 },
        ],
        crack: hex('#a9bcb0'),
        crackAmt: 0.22,
        speckle: 0.05,
      },
      seam: 0.28,
      bevel: 0.14,
      sheen: 0.06,
      varyPiece: 0.03,
    },
  };

  /** Renders the board at `size` px (a multiple of 8), supersampled 2x then downscaled. */
  window.renderBoard = function renderBoard(themeId, size) {
    const theme = THEMES[themeId];
    if (!theme) throw new Error('Unknown theme ' + themeId);
    const S = size * 2;
    const sq = S / 8;
    const rnd = mulberry32(theme.seed);
    const noise = makeNoise(theme.seed * 7 + 1);
    const fbm = makeFbm(noise);
    const big = document.createElement('canvas');
    big.width = big.height = S;
    const ctx = big.getContext('2d');
    const img = ctx.createImageData(S, S);
    const data = img.data;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const light = (row + col) % 2 === 0;
        const mat = light ? theme.light : theme.dark;
        // Each square is its own piece: its own place in the material, direction and tone.
        const ox = rnd() * 200;
        const oy = rnd() * 200;
        let angle;
        if (mat.kind === 'wood') {
          // Inlaid: grain alternates between neighbouring pieces, with a slight skew.
          const across = (row + (light ? 0 : 1)) % 2 === 0;
          angle = (across ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.07;
        } else {
          // Cut from one slab: every tile's veins follow the stone's direction, give or take 25deg.
          angle = mat.angle + (rnd() - 0.5) * 2 * (25 * Math.PI / 180);
        }
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tone = 1 + (rnd() - 0.5) * 2 * theme.varyPiece;
        // Per piece: ring spacing and a slightly warmer or cooler cast, as in a real inlay.
        const sqMat = mat.ringVar ? { ...mat, rings: mat.rings * (1 + (rnd() - 0.5) * 2 * mat.ringVar) } : mat;
        const w = mat.tintVar ? (rnd() - 0.4) * 2 * mat.tintVar : 0;
        const tint = [1 + w, 1 + w * 0.15, 1 - w * 1.4];
        for (let py = 0; py < sq; py++) {
          for (let px = 0; px < sq; px++) {
            const lx = (px + 0.5) / sq - 0.5;
            const ly = (py + 0.5) / sq - 0.5;
            const u = lx * ca - ly * sa + ox;
            const v = lx * sa + ly * ca + oy;
            let c = mat.kind === 'wood' ? wood(sqMat, noise, fbm, u, v) : marble(mat, noise, fbm, u, v, u, v);
            c = [c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]];
            // Satin sheen: a broad soft light from the top-left across the whole board.
            const gx = (col * sq + px) / S;
            const gy = (row * sq + py) / S;
            const sheen = 1 + theme.sheen * (0.6 - (gx * 0.55 + gy * 0.85)) + theme.sheen * 0.8 * Math.exp(-((gx - 0.3) ** 2 + (gy - 0.22) ** 2) * 6);
            // Inlay seams: a hairline darkening at each piece's edge, lit on its top/left.
            const ex = Math.min(px, sq - 1 - px);
            const ey = Math.min(py, sq - 1 - py);
            const edge = Math.min(ex, ey);
            let k = tone * sheen;
            if (edge < 1.5) k *= 1 - theme.seam * (1 - edge / 1.5);
            else if ((px < 4 || py < 4) && edge < 4) k *= 1 + theme.bevel * (1 - (edge - 1.5) / 2.5);
            const i = ((row * sq + py) * S + col * sq + px) * 4;
            data[i] = clamp(c[0] * k, 0, 255);
            data[i + 1] = clamp(c[1] * k, 0, 255);
            data[i + 2] = clamp(c[2] * k, 0, 255);
            data[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(big, 0, 0, size, size);
    return out;
  };

  window.BOARD_THEMES = Object.keys(THEMES);
})();
