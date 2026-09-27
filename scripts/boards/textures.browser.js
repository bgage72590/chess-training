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
    const t = v * p.rings + warp * p.warp + (f(u * 2.2, v * 0.7 + 9.1, 3) - 0.5) * 0.9;
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

  /** Polished marble: cloudy base, domain-warped veins, faint speckle. */
  function marble(p, n, f, u, v) {
    const qx = f(u * 0.9, v * 0.9, 5);
    const qy = f(u * 0.9 + 5.2, v * 0.9 + 1.3, 5);
    const cloud = f(u * 0.7 + qx * 2.2, v * 0.7 + qy * 2.2, 5);
    let c = mix3(p.base, p.cloud, smooth(0.3, 0.75, cloud));
    // Veins: level lines of a domain-warped FBM, stretched along the vein direction so they
    // run long and meander rather than loop. Their width follows the field's slope, so they
    // swell and thin like real veins.
    const a = u * p.dir[0] + v * p.dir[1];
    const b = -u * p.dir[1] + v * p.dir[0];
    const wx = f(a * 0.45 + 1, b * 0.9, 4);
    const wy = f(a * 0.45 + 7, b * 0.9 + 3, 4);
    const r1 = f(a * 0.3 + wx * 1.4, b * p.freq + wy * 1.4, 5);
    const d1 = Math.abs(r1 - 0.5);
    const vein1 = 1 - smooth(0, p.width, d1);
    const halo = 1 - smooth(0, p.width * 7, d1);
    const r2 = f(a * 0.5 - wy * 1.2 + 40, b * p.freq * 1.8 + wx * 1.2, 5);
    const d2 = Math.abs(r2 - 0.52);
    const vein2 = (1 - smooth(0, p.width * 0.55, d2)) * smooth(0.4, 0.65, f(u * 1.2 + 20, v * 1.2, 3));
    const fade = 0.5 + 0.5 * smooth(0.3, 0.7, f(u * 0.8 - 30, v * 0.8 + 12, 3));
    c = mix3(c, p.vein, clamp(halo * 0.16 * fade, 0, 1));
    c = mix3(c, p.vein, clamp(vein1 * p.veinAmt * fade, 0, 1));
    c = mix3(c, p.vein2 ?? p.vein, clamp(vein2 * p.veinAmt * 0.7, 0, 1));
    // Crystalline speckle.
    const s = n(u * 90 + 3, v * 90 - 8);
    const k = 1 + (s - 0.5) * p.speckle;
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
        warp: 3.2,
        pores: 70,
        lineAmt: 0.55,
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
        kind: 'marble',
        base: hex('#efebe3'),
        cloud: hex('#ddd6ca'),
        vein: hex('#8e908e'),
        vein2: hex('#b5b1a9'),
        dir: [0.8, 0.6],
        freq: 1.1,
        width: 0.012,
        veinAmt: 0.55,
        speckle: 0.035,
      },
      dark: {
        kind: 'marble',
        base: hex('#6b8076'),
        cloud: hex('#4d5f57'),
        vein: hex('#dfe5df'),
        vein2: hex('#a4b4aa'),
        dir: [0.6, -0.8],
        freq: 1.2,
        width: 0.011,
        veinAmt: 0.55,
        speckle: 0.06,
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
          angle = rnd() * Math.PI * 2;
        }
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tone = 1 + (rnd() - 0.5) * 2 * theme.varyPiece;
        for (let py = 0; py < sq; py++) {
          for (let px = 0; px < sq; px++) {
            const lx = (px + 0.5) / sq - 0.5;
            const ly = (py + 0.5) / sq - 0.5;
            const u = lx * ca - ly * sa + ox;
            const v = lx * sa + ly * ca + oy;
            let c = mat.kind === 'wood' ? wood(mat, noise, fbm, u, v) : marble(mat, noise, fbm, u, v);
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
