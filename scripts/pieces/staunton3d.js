// Procedural 3D Staunton chess set, rendered to transparent sprites with three.js.
// Loaded by render-3d.html (driven by render-3d.cjs). Units: the king is 1.0 tall.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// ---------------------------------------------------------------------------------------------
// Small maths helpers
// ---------------------------------------------------------------------------------------------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Smooth value noise in [0, 1]. */
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const wt = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
        r += wt * hash3(xi + dx, yi + dy, zi + dz);
      }
  return r;
}

// ---------------------------------------------------------------------------------------------
// Lathe profiles. A spec is a list of [r, y] points ([r, y, f] rounds that corner with radius f),
// {c: [c1r, c1y, c2r, c2y, r, y]} cubic curves from the previous point and
// {arc: [cr, cy, radius, deg0, deg1]} circular arcs.
// ---------------------------------------------------------------------------------------------
function resolve(spec) {
  const pts = [];
  for (const it of spec) {
    if (Array.isArray(it)) pts.push([it[0], it[1], it[2] || 0]);
    else if (it.c) {
      const [ax, ay] = pts[pts.length - 1];
      const [c1x, c1y, c2x, c2y, px, py] = it.c;
      const n = it.n || 20;
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        pts.push([
          u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * px,
          u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * py,
          0,
        ]);
      }
      if (it.f) pts[pts.length - 1][2] = it.f;
    } else if (it.arc) {
      const [cx, cy, rad, a0, a1] = it.arc;
      const n = it.n || 24;
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
        pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a), 0]);
      }
    }
  }
  const dedup = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
  return fillet(dedup).map(([r, y]) => [Math.max(0, r), y]);
}

function fillet(pts) {
  const res = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, f] = pts[i];
    if (!f || i === 0 || i === pts.length - 1) {
      res.push([x, y]);
      continue;
    }
    const a = pts[i - 1], b = pts[i + 1];
    const la = Math.hypot(a[0] - x, a[1] - y), lb = Math.hypot(b[0] - x, b[1] - y);
    const t = Math.min(f, la * 0.5, lb * 0.5);
    const p1 = [x + ((a[0] - x) / la) * t, y + ((a[1] - y) / la) * t];
    const p2 = [x + ((b[0] - x) / lb) * t, y + ((b[1] - y) / lb) * t];
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const s = k / n, u = 1 - s;
      res.push([u * u * p1[0] + 2 * u * s * x + s * s * p2[0], u * u * p1[1] + 2 * u * s * y + s * s * p2[1]]);
    }
  }
  return res;
}

/** Resamples a polyline to points spaced about `step` apart (keeps the ends). */
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d < len) {
      const t = d / len;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}


/**
 * Stouter than a real set so the pieces read as sprites on small squares (like the 3D sets of the
 * big chess sites): the foot is widened a little, the body and head more.
 */
const W_FOOT = 1.33, W_BODY = 1.38;
const widen = (y) => lerp(W_FOOT, W_BODY, smooth(0.08, 0.26, y));

/**
 * A lathe of the profile, widened by widen(y). Above `roundFrom` the widening fades out so ball
 * heads and finials stay round (their radii are drawn at full size instead).
 */
function lathe(pts, segments = 160, roundFrom = 99) {
  const k = (y) => lerp(widen(y), 1, smooth(roundFrom, roundFrom + 0.02, y));
  // phiStart = PI puts the seam at the back, away from the camera.
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * k(y), y)), segments, Math.PI, Math.PI * 2);
}

/** The weighted, stepped Staunton foot shared by every piece, ending at the stem (rStem, top). */
function base(R, rStem) {
  const s = R / 0.25;
  return [
    [0, 0],
    [R * 0.975, 0, 0.004],
    [R, 0.012 * s, 0.008],
    [R, 0.034 * s, 0.006],
    [R * 0.965, 0.04 * s, 0.004],
    { c: [R * 0.962, 0.066 * s, R * 0.9, 0.086 * s, R * 0.8, 0.088 * s], n: 18 },
    [R * 0.77, 0.09 * s, 0.003],
    [R * 0.77, 0.098 * s, 0.002],
    { arc: [R * 0.77, 0.107 * s, 0.009 * s, -90, 90], n: 14 },
    [R * 0.7, 0.117 * s, 0.003],
    { c: [R * 0.52, 0.12 * s, rStem, 0.14 * s, rStem, 0.19 * s], n: 22 },
  ];
}

/** A turned collar (flat disc + bead) sitting on a flared stem top at height y. */
function collar(y, rDisc, rBead, rNeck) {
  return [
    [rDisc, y + 0.003, 0.004],
    [rDisc, y + 0.019, 0.006],
    [rBead, y + 0.025, 0.003],
    { arc: [rBead, y + 0.034, 0.009, -90, 90], n: 14 },
    [rNeck, y + 0.046, 0.004],
  ];
}

// ---------------------------------------------------------------------------------------------
// Pieces. Heights (king = 1) exaggerate the Staunton hierarchy a little so every piece can be
// named from its silhouette at 40px: king 0.99, queen 0.89, bishop 0.88, knight 0.76, rook 0.58,
// pawn 0.56 (in the sprites: 94%, 83%, 80%, 72%, 66% and 54% of the height).
// ---------------------------------------------------------------------------------------------
function king() {
  const prof = resolve([
    ...base(0.25, 0.108),
    { c: [0.1, 0.3, 0.079, 0.42, 0.081, 0.5] },
    { c: [0.083, 0.53, 0.12, 0.545, 0.155, 0.55] },
    ...collar(0.55, 0.162, 0.13, 0.106),
    { c: [0.09, 0.63, 0.1, 0.72, 0.163, 0.765] },
    [0.169, 0.772, 0.004],
    [0.167, 0.79, 0.006],
    { c: [0.14, 0.802, 0.1, 0.83, 0.058, 0.838] },
    [0.046, 0.842, 0.004],
    [0.046, 0.862, 0.004],
    [0, 0.864],
  ]);
  const parts = [lathe(prof)];
  // Cross pattee: a flared cross, extruded and bevelled.
  const w = 0.02, arm = 0.058, flare = 0.03, top = 0.074, bottom = 0.058;
  const sh = new THREE.Shape();
  sh.moveTo(-w, -bottom);
  sh.lineTo(w, -bottom);
  sh.lineTo(w * 0.8, -w);
  sh.quadraticCurveTo(w * 0.85, -w * 0.85, w, -w * 0.8);
  sh.lineTo(arm, -flare);
  sh.lineTo(arm, flare);
  sh.lineTo(w, w * 0.8);
  sh.quadraticCurveTo(w * 0.85, w * 0.85, w * 0.8, w);
  sh.lineTo(flare, top);
  sh.lineTo(-flare, top);
  sh.lineTo(-w * 0.8, w);
  sh.quadraticCurveTo(-w * 0.85, w * 0.85, -w, w * 0.8);
  sh.lineTo(-arm, flare);
  sh.lineTo(-arm, -flare);
  sh.lineTo(-w, -w * 0.8);
  sh.quadraticCurveTo(-w * 0.85, -w * 0.85, -w * 0.8, -w);
  sh.closePath();
  const bev = 0.008;
  const cross = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 5, curveSegments: 8 });
  cross.translate(0, 0, -0.014);
  cross.scale(1.3, 1.02, 1.3);
  cross.rotateY(0.35);
  cross.translate(0, 0.921, 0);
  parts.push(cross);
  return parts;
}

function queen() {
  const prof = resolve([
    ...base(0.24, 0.102),
    { c: [0.096, 0.29, 0.073, 0.4, 0.075, 0.46] },
    { c: [0.077, 0.49, 0.11, 0.505, 0.142, 0.51] },
    ...collar(0.51, 0.15, 0.122, 0.1),
    { c: [0.084, 0.59, 0.094, 0.68, 0.16, 0.728] },
    [0.166, 0.736, 0.004],
    [0.162, 0.75, 0.004],
    [0.132, 0.752, 0.003],
    { c: [0.118, 0.765, 0.078, 0.788, 0.042, 0.792] },
    [0.03, 0.8, 0.005],
    { arc: [0, 0.842, 0.052, -52, 90], n: 30 },
  ]);
  const parts = [lathe(prof, 160, 0.795)];
  const n = 10, rr = 0.146 * widen(0.764);
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const ball = new THREE.SphereGeometry(0.026, 24, 16);
    ball.translate(Math.sin(a) * rr, 0.766, Math.cos(a) * rr);
    parts.push(ball);
  }
  return parts;
}

function bishop() {
  let prof = resolve([
    ...base(0.22, 0.094),
    { c: [0.087, 0.31, 0.064, 0.41, 0.066, 0.466] },
    { c: [0.068, 0.486, 0.1, 0.496, 0.126, 0.5] },
    ...collar(0.5, 0.132, 0.104, 0.066),
    { c: [0.048, 0.59, 0.114, 0.615, 0.114, 0.675] },
    { c: [0.114, 0.742, 0.052, 0.795, 0.02, 0.812] },
    [0.015, 0.816, 0.003],
    { arc: [0, 0.846, 0.033, -62, 90], n: 28 },
  ]);
  prof = resample(prof, 0.0016);
  const geo = lathe(prof, 240, 0.814);
  // The mitre's slanted cut: a deep groove pressed into the front of the mitre along a tilted
  // plane, its dark inside turned towards the camera.
  const pos = geo.attributes.position;
  const cav = new Float32Array(pos.count);
  const n = new THREE.Vector3(0.66, 1, 0.12).normalize();
  const c = new THREE.Vector3(0, 0.705, 0);
  const face = new THREE.Vector3(-0.3, 0, 1).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0.58 || v.y > 0.81) continue;
    const d = v.clone().sub(c).dot(n);
    const w = 0.017;
    if (Math.abs(d) > w * 1.6) continue;
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const dir = (v.x * face.x + v.z * face.z) / r;
    const m = smooth(-0.6, 0.05, dir);
    const t = Math.abs(d) / w;
    const g = t < 1 ? Math.sqrt(1 - t * t) : 0;
    const depth = 0.085 * g * m;
    const nr = Math.max(0.006, r - depth);
    v.x *= nr / r;
    v.z *= nr / r;
    pos.setXYZ(i, v.x, v.y, v.z);
    cav[i] = Math.min(1, g * m * 1.4);
  }
  geo.setAttribute('cavity', new THREE.BufferAttribute(cav, 1));
  geo.computeVertexNormals();
  return [geo];
}

function rook() {
  const top = 0.505;
  const prof = resolve([
    ...base(0.235, 0.145),
    { c: [0.139, 0.235, 0.13, 0.32, 0.142, 0.366] },
    { c: [0.146, 0.38, 0.16, 0.386, 0.172, 0.39] },
    [0.18, 0.393, 0.004],
    [0.18, 0.407, 0.005],
    [0.166, 0.413, 0.003],
    [0.168, 0.421, 0.004],
    [0.176, top, 0.006],
    [0.112, top, 0.004],
    [0.112, top - 0.04, 0.004],
    [0, top - 0.04],
  ]);
  const parts = [lathe(prof)];
  const k = widen(top), ri = 0.112 * k, ro = 0.176 * k;
  const n = 5, bev = 0.007;
  const gap = 0.78; // radians between merlons at the outer rim
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + gap / 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - gap / 2 - Math.PI / 2;
    const r0 = ri + bev, r1 = ro - bev;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, a0, a1, false);
    sh.absarc(0, 0, r0, a1 - 0.01, a0 + 0.01, true);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.066, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); // extrusion (z) becomes up (y)
    g.translate(0, top - 0.004 + bev, 0);
    parts.push(g);
  }
  return parts;
}

function pawn() {
  const prof = resolve([
    ...base(0.2, 0.088),
    { c: [0.08, 0.2, 0.058, 0.25, 0.056, 0.282] },
    { c: [0.058, 0.292, 0.094, 0.298, 0.117, 0.302] },
    [0.123, 0.305, 0.004],
    [0.123, 0.318, 0.005],
    [0.092, 0.323, 0.003],
    [0.056, 0.33, 0.004],
    { arc: [0, 0.436, 0.122, -60, 90], n: 48 },
  ]);
  return [lathe(prof, 160, 0.33)];
}

// ---------------------------------------------------------------------------------------------
// Knight: a horse-head silhouette inflated into a carved 3D form (distance-field height map,
// mirrored halves) with eye, nostril, mouth, jaw and carved mane locks, growing out of a turned
// collar. Silhouette coordinates: 1000 units wide, y down, the horse faces left.
// ---------------------------------------------------------------------------------------------
const KN_H = 1160;
const KN_POLL = [446, 172];
const KN_NOTCHES = [KN_POLL, [548, 232], [628, 312], [684, 412], [716, 530], [738, 660], [760, 790], [790, 920], [812, 1040]];

function knightPath() {
  let d = 'M 262 1160 L 262 1000 ';
  d += 'C 240 935 222 860 244 790 '; // chest
  d += 'C 262 730 318 684 368 648 '; // front of the neck
  d += 'C 396 628 410 604 396 586 '; // throat latch
  d += 'C 360 598 300 594 252 578 '; // jowl
  d += 'C 204 562 152 552 120 548 '; // under the jaw
  d += 'C 94 546 74 532 78 514 '; // chin
  d += 'L 104 500 '; // mouth
  d += 'C 82 494 58 484 54 460 '; // upper lip
  d += 'C 50 432 62 410 84 392 '; // muzzle
  d += 'C 140 330 220 240 292 186 '; // face
  d += 'C 296 140 306 90 322 52 '; // front ear
  d += 'C 342 90 356 125 366 146 ';
  d += 'C 376 118 390 92 404 72 '; // back ear
  d += `C 420 110 432 150 ${KN_POLL[0]} ${KN_POLL[1]} `;
  for (let i = 1; i < KN_NOTCHES.length; i++) {
    const [ax, ay] = KN_NOTCHES[i - 1], [bx, by] = KN_NOTCHES[i];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len; // outward (to the back)
    const k = 0.2 * len;
    d += `C ${ax + dx * 0.2 + nx * k} ${ay + dy * 0.2 + ny * k} ${ax + dx * 0.75 + nx * k} ${ay + dy * 0.75 + ny * k} ${bx} ${by} `;
  }
  d += 'L 812 1160 Z';
  return d;
}

/** The silhouette flattened to a polygon (silhouette units). */
function knightPolygon() {
  const tok = knightPath().trim().split(/\s+/);
  const pts = [];
  let i = 0;
  while (i < tok.length) {
    const cmd = tok[i++];
    if (cmd === 'M' || cmd === 'L') {
      pts.push([+tok[i], +tok[i + 1]]);
      i += 2;
    } else if (cmd === 'C') {
      const [ax, ay] = pts[pts.length - 1];
      const [c1x, c1y, c2x, c2y, px, py] = tok.slice(i, i + 6).map(Number);
      i += 6;
      const n = 28;
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        pts.push([
          u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * px,
          u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * py,
        ]);
      }
    }
  }
  return pts;
}

/**
 * Signed distance (silhouette units, positive inside) to the knight outline. The bottom edge is
 * left out of the distance so the neck is not rounded off where it enters the base.
 */
function knightField() {
  const poly = knightPolygon();
  const n = poly.length;
  const sample = (x, y) => {
    let best = Infinity, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      if (ay >= KN_H - 0.5 && by >= KN_H - 0.5) continue; // bottom edge
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2;
      if (d < best) best = d;
    }
    return inside ? Math.sqrt(best) : -Math.sqrt(best);
  };
  return { sample, poly };
}

/** Debug view of the silhouette. */
function silhouettePng() {
  const cv = document.createElement('canvas');
  cv.width = 500;
  cv.height = KN_H / 2;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = '#333';
  ctx.fill(new Path2D(knightPath()));
  return cv.toDataURL('image/png');
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return { d: Math.hypot(px - ax - dx * t, py - ay - dy * t), t };
};

/** Arc length along the crest of the mane (the notch polyline) of its closest point to (x, y). */
const CREST_S = KN_NOTCHES.reduce((acc, p, i) => {
  acc.push(i ? acc[i - 1] + Math.hypot(p[0] - KN_NOTCHES[i - 1][0], p[1] - KN_NOTCHES[i - 1][1]) : 0);
  return acc;
}, []);
function crestArc(x, y) {
  let best = Infinity, s = 0;
  for (let i = 1; i < KN_NOTCHES.length; i++) {
    const [ax, ay] = KN_NOTCHES[i - 1], [bx, by] = KN_NOTCHES[i];
    const { d, t } = segDist(x, y, ax, ay, bx, by);
    if (d < best) {
      best = d;
      s = CREST_S[i - 1] + t * (CREST_S[i] - CREST_S[i - 1]);
    }
  }
  return s;
}

/**
 * One row of mane locks: rounded strips, grooved on both sides, that run from the crest (v0)
 * inwards (v1) with an S-bend, slanting down the neck. `bounds` are the lock edges (arc length).
 * Returns 0..~1.2 (lock height) or 0 outside the row.
 */
function maneRow(s, v, v0, v1, bounds, seed) {
  const vv = (v - v0) / (v1 - v0);
  if (vv <= 0 || vv >= 1) return 0;
  const sp = s - 0.42 * (v - v0) - 14 * Math.sin(Math.PI * vv);
  let k = 0;
  while (k < bounds.length - 2 && sp > bounds[k + 1]) k++;
  const f = (sp - bounds[k]) / (bounds[k + 1] - bounds[k]);
  if (f <= 0 || f >= 1) return 0;
  const amp = 0.75 + 0.5 * hash3(k, seed, 7);
  // A rounded strip with two fine carved strands along it.
  const prof = Math.pow(Math.sin(Math.PI * f), 0.75) * (1 - 0.14 * Math.pow(Math.abs(Math.cos(3 * Math.PI * f)), 6));
  // Round the inner tip of each lock; the tip length varies from lock to lock.
  const tip = 0.62 + 0.2 * hash3(k, seed, 11);
  return amp * prof * smooth(1, tip, vv) * smooth(0, 0.08, vv);
}
const MANE_ROW1 = CREST_S.map((s, i) => s + (i ? 8 * (hash3(i, 1, 3) - 0.5) : 0));
const MANE_ROW2 = [-60, ...CREST_S.slice(0, -1).map((s, i) => (s + CREST_S[i + 1]) / 2 + 10 * (hash3(i, 2, 3) - 0.5)), CREST_S[CREST_S.length - 1] + 60];

/** Relief on each side of the head, in world units, at silhouette point (x, y) with inside distance d. */
function knightRelief(x, y, d) {
  let h = 0;
  const bump = (cx, cy, r, amt) => {
    const q = Math.hypot(x - cx, y - cy) / r;
    return q < 1 ? amt * (1 - q * q) * (1 - q * q) : 0;
  };
  const blob = (cx, cy, rx, ry, amt) => {
    const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    return q < 6 ? amt * Math.exp(-1.6 * q) : 0;
  };
  const ring = (cx, cy, r, w, amt) => {
    const q = Math.abs(Math.hypot(x - cx, y - cy) - r) / w;
    return q < 1 ? amt * (1 - q * q) : 0;
  };
  const groove = (ax, ay, bx, by, w, amt) => {
    const { d: dd, t } = segDist(x, y, ax, ay, bx, by);
    const q = dd / w;
    return q < 1 ? amt * (1 - q * q) * (1 - q * q) * smooth(0, 0.15, t) * smooth(1, 0.8, t) : 0;
  };
  // Eye: a rounded eyeball in a socket under a soft brow ridge.
  h += bump(258, 298, 22, 0.016);
  h -= ring(258, 298, 30, 12, 0.007);
  h += blob(246, 258, 52, 26, 0.009);
  // Face: a soft nasal ridge down the front, and the flare around the nostril.
  h += groove(150, 360, 250, 250, 40, 0.006);
  h += blob(104, 424, 36, 30, 0.009);
  h -= bump(100, 426, 17, 0.02);
  // Mouth.
  h -= groove(92, 500, 196, 522, 11, 0.013);
  // Jaw: a soft, ellipsoidal muscle.
  h += blob(322, 472, 108, 74, 0.034);
  // Ear hollows.
  h -= groove(326, 82, 340, 160, 12, 0.009);
  h -= groove(402, 100, 410, 165, 9, 0.006);
  // Mane: two rows of overlapping, carved locks along the back of the neck.
  const [px, py] = KN_POLL;
  const side = ((x - px) * (1100 - py) - (y - py) * (600 - px)) / Math.hypot(600 - px, 1100 - py);
  const back = smooth(-70, 40, side);
  if (back > 0 && d < 124) {
    const s = crestArc(x, y);
    const r1 = maneRow(s, d, -4, 78, MANE_ROW1, 1);
    const r2 = maneRow(s, d, 46, 104, MANE_ROW2, 2) * 0.75;
    h += back * (Math.max(r1, r2) * 0.012 + smooth(112, 88, d) * 0.006);
    h -= back * (Math.abs(d - 110) < 12 ? 0.005 * (1 - ((d - 110) / 12) ** 2) : 0);
  }
  return h;
}

/** Taubin smoothing (shrink-free Laplacian): removes the grid's stair-step ripples on the rounded edges. */
function taubin(pos, index, iterations) {
  const n = pos.length / 3;
  // Compressed adjacency (edges may repeat; that only weights the average slightly).
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < index.length; i += 3)
    for (let e = 0; e < 3; e++) deg[index[i + e] + 1] += 2;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const adj = new Int32Array(deg[n]);
  const fill = deg.slice(0, n);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    adj[fill[a]++] = b;
    adj[fill[a]++] = c;
    adj[fill[b]++] = a;
    adj[fill[b]++] = c;
    adj[fill[c]++] = a;
    adj[fill[c]++] = b;
  }
  const tmp = new Float64Array(pos.length);
  const step = (f) => {
    for (let i = 0; i < n; i++) {
      const a = deg[i], b = deg[i + 1];
      if (a === b) continue;
      let x = 0, y = 0, z = 0;
      for (let k = a; k < b; k++) {
        const j = adj[k] * 3;
        x += pos[j];
        y += pos[j + 1];
        z += pos[j + 2];
      }
      const m = b - a;
      tmp[i * 3] = pos[i * 3] + f * (x / m - pos[i * 3]);
      tmp[i * 3 + 1] = pos[i * 3 + 1] + f * (y / m - pos[i * 3 + 1]);
      tmp[i * 3 + 2] = pos[i * 3 + 2] + f * (z / m - pos[i * 3 + 2]);
    }
    for (let i = 0; i < pos.length; i++) pos[i] = tmp[i];
  };
  for (let k = 0; k < iterations; k++) {
    step(0.5);
    step(-0.53);
  }
}

/**
 * Solves the Poisson equation lap(u) = -1 inside the silhouette (u = 0 on the true contour, found
 * from the signed distance: Shortley-Weller arms; zero flux through the hidden bottom edge) by SOR.
 */
function inflate(sd, nx, ny, cell) {
  const n = nx * ny;
  const u = new Float64Array(n);
  const inside = (k) => sd[k] > 0;
  const coef = new Float64Array(n * 5); // a_e, a_w, a_s, a_n, 1 / sum
  const nb = new Int32Array(n * 4).fill(-1);
  for (let j = 1; j < ny - 1; j++)
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      if (!inside(k)) continue;
      u[k] = sd[k] * sd[k] * 0.5;
      const ks = [k + 1, k - 1, k + nx, k - nx];
      const arm = ks.map((q) => (inside(q) ? cell : cell * Math.max(0.08, sd[k] / (sd[k] - sd[q]))));
      const bottom = (j + 1) * cell > KN_H - 60; // near the hidden bottom edge: no boundary below
      const a = [2 / (arm[0] * (arm[0] + arm[1])), 2 / (arm[1] * (arm[0] + arm[1])), 2 / (arm[2] * (arm[2] + arm[3])), 2 / (arm[3] * (arm[2] + arm[3]))];
      if (bottom && !inside(ks[2])) a[2] = 0;
      let sum = 0;
      for (let d = 0; d < 4; d++) {
        coef[k * 5 + d] = a[d];
        sum += a[d];
        if (inside(ks[d])) nb[k * 4 + d] = ks[d];
      }
      coef[k * 5 + 4] = 1 / sum;
    }
  const cells = [];
  for (let k = 0; k < n; k++) if (coef[k * 5 + 4] > 0) cells.push(k);
  const w = 1.94;
  for (let it = 0; it < 1400; it++)
    for (const k of cells) {
      let acc = 1;
      for (let d = 0; d < 4; d++) {
        const q = nb[k * 4 + d];
        if (q >= 0) acc += coef[k * 5 + d] * u[q];
      }
      u[k] += w * (acc * coef[k * 5 + 4] - u[k]);
    }
  return u;
}

const KN_S = 0.735 / 1000; // world units per silhouette unit
const KN_X0 = 520; // silhouette x over the base centre (the middle of the neck where it meets the collar)
const KN_Y0 = 0.1; // world height of silhouette y = 1000 (inside the collar)
const KN_COLLAR = 0.16; // top of the knight's turned collar

function knight() {
  const S = KN_S;
  const toWorld = (x, y) => [(x - KN_X0) * S, (1000 - y) * S + KN_Y0];
  const field = knightField();
  const cell = 2; // silhouette units per grid cell
  const nx = Math.ceil(1000 / cell) + 1, ny = Math.ceil(KN_H / cell) + 1;
  const sdg = new Float32Array(nx * ny);
  const rowMin = new Float32Array(ny).fill(Infinity), rowMax = new Float32Array(ny).fill(-Infinity);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const sd = field.sample(i * cell, j * cell);
      sdg[j * nx + i] = sd;
      if (sd > 0) {
        rowMin[j] = Math.min(rowMin[j], i * cell);
        rowMax[j] = Math.max(rowMax[j], i * cell);
      }
    }
  // A blurred copy of the distance field for the inflation: the raw field has creases along its
  // medial axis (where the nearest edge switches between mane scallops) that would show as facets.
  // Separable box filters over the grid (3 box passes approximate a Gaussian blur).
  const tmpRow = new Float32Array(Math.max(nx, ny));
  const filter = (src, r, passes, op) => {
    const a = src.slice();
    const line = (n, get, set) => {
      for (let q = 0; q < n; q++) {
        let acc = op === 'max' ? -Infinity : 0;
        for (let o = -r; o <= r; o++) {
          const v = get(clamp(q + o, 0, n - 1));
          acc = op === 'max' ? Math.max(acc, v) : acc + v;
        }
        tmpRow[q] = op === 'max' ? acc : acc / (2 * r + 1);
      }
      for (let q = 0; q < n; q++) set(q, tmpRow[q]);
    };
    for (let p = 0; p < passes; p++) {
      for (let j = 0; j < ny; j++) line(nx, (i) => a[j * nx + i], (i, v) => (a[j * nx + i] = v));
      for (let i = 0; i < nx; i++) line(ny, (j) => a[j * nx + i], (j, v) => (a[j * nx + i] = v));
    }
    return a;
  };
  const sdS = filter(sdg, 18, 3, 'mean');
  const u = inflate(sdg, nx, ny, cell);
  const idxF = new Int32Array(nx * ny).fill(-1), idxB = new Int32Array(nx * ny).fill(-1);
  const pos = [];
  const muzzle = [80, 450];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const sd = sdg[k];
      if (sd <= 0) continue;
      let x = i * cell, y = j * cell;
      if (sd < cell * 1.25) {
        // Snap the outer ring onto the contour so the silhouette is smooth, not stair-stepped.
        const e = 0.5;
        const gx = (field.sample(x + e, y) - field.sample(x - e, y)) / (2 * e);
        const gy = (field.sample(x, y + e) - field.sample(x, y - e)) / (2 * e);
        const gl = Math.hypot(gx, gy) || 1;
        x -= (gx / gl) * sd;
        y -= (gy / gl) * sd;
        const [wx, wy] = toWorld(x, y);
        idxF[k] = idxB[k] = pos.length / 3;
        pos.push(wx, wy, 0);
        continue;
      }
      const dB = lerp(sd, Math.max(sd, sdS[k]), smooth(6, 60, sd));
      const dW = dB * S;
      // Half-thickness: narrow at the muzzle and nose bridge, full across the jowl and neck, so
      // the head is wedge-shaped from above rather than a slab.
      const dm = Math.hypot(x - muzzle[0], y - muzzle[1]);
      // Poisson inflation: sqrt(2u) is a circle's half-chord across a strip, so every section is a
      // smooth oval with no creases. Its ratio to the half-width tapers from muzzle to jowl.
      let ratio = lerp(0.62, 0.84, smooth(60, 400, dm));
      ratio *= 1 - 0.35 * smooth(215, 110, y); // thin ears
      // (sqrt(2u + e^2) - e: the same oval, with a finite slope at the rim so the grid cannot alias it.)
      const e = 34;
      let h = ratio * (Math.sqrt(2 * Math.max(0, u[k]) + e * e) - e) * S;
      h += knightRelief(x, y, dB) * smooth(4, 26, sd);
      // Where the neck meets the collar its section becomes a round ellipse over the row's width.
      const nb = smooth(800, 950, y);
      if (nb > 0) {
        const half = ((rowMax[j] - rowMin[j]) / 2) * S;
        const xc = (rowMax[j] + rowMin[j]) / 2;
        const u = ((x - xc) * S) / half;
        const hc = Math.min(half, 0.165) * Math.sqrt(Math.max(0, 1 - u * u));
        h = lerp(h, hc, nb);
      }
      h = Math.max(0.002, h);
      const [wx, wy] = toWorld(x, y);
      idxF[k] = pos.length / 3;
      pos.push(wx, wy, h);
      idxB[k] = pos.length / 3;
      pos.push(wx, wy, -h);
    }
  const index = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, d = a + nx, c = d + 1;
      const inA = idxF[a] >= 0, inB = idxF[b] >= 0, inC = idxF[c] >= 0, inD = idxF[d] >= 0;
      const count = inA + inB + inC + inD;
      const tri = (p, q, r) => {
        index.push(idxF[p], idxF[q], idxF[r]);
        index.push(idxB[p], idxB[r], idxB[q]);
      };
      if (count === 4) {
        tri(a, d, c);
        tri(a, c, b);
      } else if (count === 3) {
        if (!inA) tri(b, d, c);
        else if (!inB) tri(a, d, c);
        else if (!inC) tri(a, d, b);
        else tri(a, c, b);
      }
    }
  taubin(pos, index, 18);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Stouter than the drawing (the lathe pieces are widened too), then turned to face left, three-quarters on.
  geo.scale(1.1, 1, 1.18);
  geo.computeVertexNormals();
  geo.rotateY(0.5);

  // The turned base: the stepped foot, then a cove and bead collar that the neck grows out of.
  const R = 0.235, s = R / 0.25;
  const baseProf = resolve([
    ...base(R, 0).slice(0, -1),
    { c: [R * 0.6, 0.122 * s, 0.142, 0.128, 0.151, 0.132], n: 14 },
    { arc: [0.151, 0.143, 0.011, -90, 90], n: 16 },
    [0.14, 0.156, 0.003],
    [0.132, KN_COLLAR, 0.004],
    [0, KN_COLLAR],
  ]);
  return { parts: [lathe(baseProf), geo], field };
}

// ---------------------------------------------------------------------------------------------
// Materials: a satin boxwood and a satin ebony. The wood grain is computed per pixel in the
// shader (rings of a log whose axis runs up the piece, just off the turning axis).
// ---------------------------------------------------------------------------------------------
const PALETTE = {
  w: { base: '#e8c28a', cavity: '#b0844c', deep: '#7a5530', late: [0.86, 0.77, 0.64], grain: 0.4, roughness: 0.4, clearcoat: 0.35, ccRough: 0.3, sheen: 0, specular: 0.55 },
  b: { base: '#2c1f18', cavity: '#150e0b', deep: '#0c0806', late: [0.6, 0.54, 0.5], grain: 0.6, roughness: 0.5, clearcoat: 0.35, ccRough: 0.35, sheen: 0.3, sheenColor: '#5e4436', specular: 0.5 },
};

const GRAIN_GLSL = /* glsl */ `
varying vec3 vObj;
uniform vec3 uLate;
uniform float uGrain;
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float woodGrain(vec3 p) {
  float warp = gNoise(p * vec3(5.0, 1.1, 5.0)) * 1.7 + gNoise(p * vec3(22.0, 3.0, 22.0)) * 0.35;
  float r = length(p.xz - vec2(0.38, -0.9)) * 90.0 + warp;
  float ring = fract(r);
  float late = smoothstep(0.6, 0.82, ring) * smoothstep(1.0, 0.9, ring);
  float pores = gNoise(p * vec3(300.0, 24.0, 300.0));
  float figure = gNoise(p * vec3(7.0, 1.4, 7.0));
  return clamp(late * 0.7 + (pores - 0.5) * 0.3 + (figure - 0.5) * 0.35, 0.0, 1.0);
}
`;

function colorize(geo, pal) {
  const pos = geo.attributes.position;
  const cav = geo.attributes.cavity;
  const base = new THREE.Color(pal.base), cavC = new THREE.Color(pal.cavity);
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(base);
    if (cav) c.lerp(cavC, cav.getX(i) * 0.85);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function material(pal) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: pal.roughness,
    metalness: 0,
    clearcoat: pal.clearcoat,
    clearcoatRoughness: pal.ccRough,
    specularIntensity: pal.specular,
    sheen: pal.sheen,
    sheenColor: new THREE.Color(pal.sheenColor || '#000000'),
    sheenRoughness: 0.5,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLate = { value: new THREE.Vector3(...pal.late) };
    sh.uniforms.uGrain = { value: pal.grain };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRAIN_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat gW = woodGrain(vObj);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uLate, gW * uGrain);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + gW * 0.08, 0.0, 1.0);');
  };
  return m;
}

function blobTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const r = Math.hypot(x - 127.5, y - 127.5) / 128;
      const a = r >= 1 ? 0 : Math.exp(-r * r * 4.5) * (1 - r * r);
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BUILDERS = { K: king, Q: queen, B: bishop, R: rook, P: pawn, N: () => knight().parts };
const RADIUS = { K: 0.25, Q: 0.24, B: 0.22, R: 0.235, P: 0.2, N: 0.235 };

function buildPiece(type, color) {
  const pal = PALETTE[color];
  const group = new THREE.Group();
  const mat = material(pal);
  for (const g of BUILDERS[type]()) {
    colorize(g, pal);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------
const ELEVATION = 26; // degrees above horizontal

function makeCamera() {
  const el = (ELEVATION * Math.PI) / 180, dist = 5.2, yc = 0.46;
  const cam = new THREE.PerspectiveCamera(16, 1, 0.5, 20);
  cam.position.set(0, yc + Math.sin(el) * dist, Math.cos(el) * dist);
  cam.lookAt(0, yc, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

/**
 * Rescales the projection so the king fills `fill` of the frame height with its foot `bottom`
 * above the lower edge (clear of the file letters drawn in the square's corner).
 */
function frameCamera(cam, king, fill = 0.935, bottom = 0.052) {
  let ymin = Infinity, ymax = -Infinity;
  const v = new THREE.Vector3();
  king.updateMatrixWorld(true);
  king.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam);
      ymin = Math.min(ymin, v.y);
      ymax = Math.max(ymax, v.y);
    }
  });
  const s = (2 * fill) / (ymax - ymin);
  const t = -1 + 2 * bottom - s * ymin;
  const m = new THREE.Matrix4().makeTranslation(0, t, 0).multiply(new THREE.Matrix4().makeScale(s, s, 1)).multiply(cam.projectionMatrix);
  cam.projectionMatrix.copy(m);
  cam.projectionMatrixInverse.copy(m).invert();
}

/** One studio rig for both colours: key from the upper left, a soft fill, one broad rim from behind. */
function makeScene(env, blob, R) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = LIGHT.env;

  const key = new THREE.DirectionalLight(0xfff0dc, LIGHT.key);
  key.position.set(-2.4, 3.8, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 1, far: 10 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe6edff, LIGHT.fill);
  fill.position.set(3, 1.2, 2.5);
  scene.add(fill);

  const rim = new THREE.RectAreaLight(0xfff4e6, LIGHT.rim, 4, 3);
  rim.position.set(2.2, 2.2, -3.0);
  rim.lookAt(0, 0.5, 0);
  scene.add(rim);

  // Soft contact shadow baked under the foot: a tight dark ring at the foot, an umbra and a wide penumbra.
  const Rw = R * W_FOOT;
  const mk = (radius, opacity, dx, dz) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity, depthWrite: false, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(dx, 0.0005, dz);
    m.userData.contactShadow = true;
    return m;
  };
  scene.add(mk(Rw * 1.08, 0.75, 0.0, 0.0));
  scene.add(mk(Rw * 1.3, 0.6, 0.015, -0.01));
  scene.add(mk(Rw * 1.9, 0.32, 0.05, -0.05));
  return scene;
}
const LIGHT = { env: 0.5, key: 2.7, fill: 0.28, rim: 8 };

/**
 * Slightly darkens the piece just inside its silhouette (like a photographed piece's shadowed
 * rim), so light pieces keep a readable outline on light squares at small sizes.
 */
const EDGE_DARKEN = { w: 0.42, b: 0 };
function darkenEdge(canvas, mask, amount, radius) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = mask[(y * w + x) * 4 + 3] / 255;
      if (a <= 0) continue;
      let min = 1;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius + radius) continue;
          const xx = x + dx, yy = y + dy;
          const b = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : mask[(yy * w + xx) * 4 + 3] / 255;
          if (b < min) min = b;
        }
      const e = clamp(a - min, 0, 1) * amount;
      const i = (y * w + x) * 4;
      d[i] *= 1 - e * 0.85;
      d[i + 1] *= 1 - e;
      d[i + 2] *= 1 - e * 1.2;
    }
  ctx.putImageData(img, 0, 0);
}

/** Bounding box of the piece (alpha > 1/8) as fractions of the sprite. */
function bbox(mask, n) {
  let x0 = n, x1 = -1, y0 = n, y1 = -1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (mask[(y * n + x) * 4 + 3] > 32) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const f = (v) => Math.round((v / n) * 1000) / 1000;
  return { height: f(y1 - y0 + 1), width: f(x1 - x0 + 1), top: f(y0), bottom: f(n - 1 - y1) };
}

function downscale(src, out) {
  let cur = src;
  while (cur.width / 2 >= out) {
    const c = document.createElement('canvas');
    c.width = cur.width / 2;
    c.height = cur.height / 2;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  if (cur.width !== out) {
    const c = document.createElement('canvas');
    c.width = c.height = out;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, out, out);
    cur = c;
  }
  return cur;
}

export async function renderAll({ size = 1024, out = 256, only = null, debug = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);

  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const blob = blobTexture();

  const cam = makeCamera();
  frameCamera(cam, buildPiece('K', 'w'));

  const sprites = {};
  const full = {};
  const metrics = {};
  const names = only || ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
  for (const name of names) {
    const color = name[0], type = name[1];
    const scene = makeScene(env, blob, RADIUS[type]);
    scene.add(buildPiece(type, color));
    // First the piece alone (no contact shadow) for its outline mask, then the full render.
    const shadows = scene.children.filter((o) => o.userData.contactShadow);
    shadows.forEach((o) => (o.visible = false));
    renderer.render(scene, cam);
    const mask = downscale(renderer.domElement, out).getContext('2d').getImageData(0, 0, out, out).data;
    shadows.forEach((o) => (o.visible = true));
    metrics[name] = bbox(mask, out);
    renderer.render(scene, cam);
    const sprite = downscale(renderer.domElement, out);
    if (EDGE_DARKEN[color]) darkenEdge(sprite, mask, EDGE_DARKEN[color], Math.max(1, Math.round(out / 110)));
    sprites[name] = sprite.toDataURL('image/webp', 0.9);
    if (debug) full[name] = renderer.domElement.toDataURL('image/png');
  }
  const result = { sprites, metrics };
  if (debug) {
    // One sheet of the full-size renders (512px each) on mid-grey.
    const cols = 6, cell = 512, keys = Object.keys(full);
    const sheet = document.createElement('canvas');
    sheet.width = cols * cell;
    sheet.height = Math.ceil(keys.length / cols) * cell;
    const sctx = sheet.getContext('2d');
    sctx.fillStyle = '#8a8f96';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    await Promise.all(
      keys.map(
        (k, i) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              sctx.drawImage(im, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
              res();
            };
            im.src = full[k];
          }),
      ),
    );
    full.sheet = sheet.toDataURL('image/png');
    result.full = full;
    result.silhouette = silhouettePng();
  }
  return result;
}

// Exports for the 3D board prototype (prototypes/board3d).
export { buildPiece, PALETTE, W_FOOT, RADIUS, blobTexture, material, colorize };
export const BUILDERS_FOR_BAKE = BUILDERS;
