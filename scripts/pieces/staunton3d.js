// Procedural 3D Staunton chess set, rendered to transparent sprites with three.js.
// Loaded by render-3d.html (driven by render-3d.cjs). Units: the king is 1.0 tall.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

function lathe(pts, segments = 144) {
  // phiStart = PI puts the seam at the back, away from the camera.
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments, Math.PI, Math.PI * 2);
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
// Pieces
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
  const w = 0.0165, arm = 0.056, flare = 0.027, top = 0.072, bottom = 0.06;
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
  cross.rotateY(0.35);
  cross.translate(0, 0.925, 0);
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
    { arc: [0, 0.836, 0.043, -45, 90], n: 30 },
  ]);
  const parts = [lathe(prof)];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const ball = new THREE.SphereGeometry(0.02, 24, 16);
    ball.translate(Math.sin(a) * 0.146, 0.764, Math.cos(a) * 0.146);
    parts.push(ball);
  }
  return parts;
}

function bishop() {
  let prof = resolve([
    ...base(0.22, 0.094),
    { c: [0.087, 0.26, 0.064, 0.34, 0.066, 0.39] },
    { c: [0.068, 0.41, 0.1, 0.42, 0.126, 0.424] },
    ...collar(0.424, 0.132, 0.102, 0.07),
    { c: [0.052, 0.49, 0.104, 0.515, 0.104, 0.565] },
    { c: [0.104, 0.625, 0.05, 0.676, 0.016, 0.7] },
    [0.013, 0.703, 0.003],
    { arc: [0, 0.722, 0.021, -52, 90], n: 24 },
  ]);
  prof = resample(prof, 0.0018);
  const geo = lathe(prof, 200);
  // The mitre's slanted cut: a groove pressed into the front of the mitre along a tilted plane.
  const pos = geo.attributes.position;
  const cav = new Float32Array(pos.count);
  const n = new THREE.Vector3(0.62, 1, 0.1).normalize();
  const c = new THREE.Vector3(0, 0.605, 0);
  const face = new THREE.Vector3(-0.35, 0, 1).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0.5 || v.y > 0.69) continue;
    const d = v.clone().sub(c).dot(n);
    const w = 0.011;
    if (Math.abs(d) > w * 1.6) continue;
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const dir = (v.x * face.x + v.z * face.z) / r;
    const m = smooth(-0.55, 0.1, dir);
    const t = Math.abs(d) / w;
    const g = t < 1 ? Math.sqrt(1 - t * t) : 0;
    const depth = 0.05 * g * m;
    const nr = Math.max(0.004, r - depth);
    v.x *= nr / r;
    v.z *= nr / r;
    pos.setXYZ(i, v.x, v.y, v.z);
    cav[i] = g * m;
  }
  geo.setAttribute('cavity', new THREE.BufferAttribute(cav, 1));
  geo.computeVertexNormals();
  return [geo];
}

function rook() {
  const ri = 0.116, ro = 0.176, top = 0.566;
  const prof = resolve([
    ...base(0.235, 0.145),
    { c: [0.139, 0.25, 0.13, 0.36, 0.142, 0.418] },
    { c: [0.146, 0.432, 0.16, 0.438, 0.172, 0.442] },
    [0.18, 0.445, 0.004],
    [0.18, 0.46, 0.005],
    [0.166, 0.466, 0.003],
    [0.168, 0.474, 0.004],
    [ro, top, 0.006],
    [ri, top, 0.004],
    [ri, top - 0.03, 0.004],
    [0, top - 0.03],
  ]);
  const parts = [lathe(prof)];
  const n = 5, bev = 0.006;
  const gap = 0.6; // radians between merlons at the outer rim
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + gap / 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - gap / 2 - Math.PI / 2;
    const r0 = ri + bev, r1 = ro - bev;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, a0, a1, false);
    sh.absarc(0, 0, r0, a1 - 0.01, a0 + 0.01, true);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.052, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); // extrusion (z) becomes up (y)
    g.translate(0, top - 0.004 + bev, 0);
    parts.push(g);
  }
  return parts;
}

function pawn() {
  const prof = resolve([
    ...base(0.2, 0.09),
    { c: [0.083, 0.24, 0.06, 0.3, 0.056, 0.338] },
    { c: [0.058, 0.35, 0.094, 0.358, 0.117, 0.362] },
    [0.123, 0.365, 0.004],
    [0.123, 0.379, 0.005],
    [0.092, 0.384, 0.003],
    [0.055, 0.393, 0.004],
    { arc: [0, 0.516, 0.117, -64, 90], n: 48 },
  ]);
  return [lathe(prof)];
}

// ---------------------------------------------------------------------------------------------
// Knight: a horse-head silhouette inflated into a carved 3D form (distance-field height map,
// mirrored halves) with eye, nostril, mouth, cheek plate and mane carving, on a turned base.
// Silhouette coordinates: 1000 units wide, y down, the horse faces left.
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

/** Relief on each side of the head, in world units, at silhouette point (x, y) with inside distance d. */
function knightRelief(x, y, d) {
  let h = 0;
  const bump = (cx, cy, r, amt) => {
    const q = Math.hypot(x - cx, y - cy) / r;
    return q < 1 ? amt * (1 - q * q) * (1 - q * q) : 0;
  };
  const ring = (cx, cy, r, w, amt) => {
    const q = Math.abs(Math.hypot(x - cx, y - cy) - r) / w;
    return q < 1 ? amt * (1 - q * q) : 0;
  };
  const groove = (ax, ay, bx, by, w, amt) => {
    const { d: dd, t } = segDist(x, y, ax, ay, bx, by);
    const q = dd / w;
    return q < 1 ? amt * (1 - q * q) * smooth(0, 0.15, t) * smooth(1, 0.8, t) : 0;
  };
  // Eye: a rounded eyeball in a socket under a soft brow.
  h += bump(258, 298, 22, 0.014);
  h -= ring(258, 298, 30, 12, 0.006);
  h += bump(246, 262, 44, 0.007);
  // Nostril and mouth.
  h -= bump(102, 424, 18, 0.016);
  h += ring(102, 424, 22, 8, 0.004);
  h -= groove(98, 500, 180, 518, 9, 0.012);
  // Cheek plate: a raised round jowl with a cut edge.
  h += bump(332, 468, 124, 0.016);
  h -= ring(332, 468, 94, 12, 0.006);
  // Ear hollows.
  h -= groove(326, 82, 340, 160, 12, 0.009);
  h -= groove(402, 100, 410, 165, 9, 0.006);
  // Mane: a raised band along the back of the neck carved into locks.
  const [px, py] = KN_POLL;
  const side = ((x - px) * (1100 - py) - (y - py) * (600 - px)) / Math.hypot(600 - px, 1100 - py);
  const back = smooth(-30, 30, side);
  h += back * smooth(80, 58, d) * 0.009;
  h -= back * (Math.abs(d - 72) < 12 ? 0.007 * (1 - ((d - 72) / 12) ** 2) : 0);
  for (let i = 1; i < KN_NOTCHES.length - 1; i++) {
    const [nx, ny] = KN_NOTCHES[i];
    h -= groove(nx + 6, ny + 2, nx - 78, ny - 30, 11, 0.009) * back;
  }
  return h;
}

/** Taubin smoothing (shrink-free Laplacian): removes the grid's stair-step ripples on the rounded edges. */
function taubin(pos, index, iterations) {
  const n = pos.length / 3;
  const nb = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
    nb[a].add(b).add(c);
    nb[b].add(a).add(c);
    nb[c].add(a).add(b);
  }
  const lists = nb.map((s) => [...s]);
  const tmp = new Float64Array(pos.length);
  const step = (f) => {
    for (let i = 0; i < n; i++) {
      const l = lists[i];
      if (!l.length) continue;
      let x = 0, y = 0, z = 0;
      for (const j of l) {
        x += pos[j * 3];
        y += pos[j * 3 + 1];
        z += pos[j * 3 + 2];
      }
      tmp[i * 3] = pos[i * 3] + f * (x / l.length - pos[i * 3]);
      tmp[i * 3 + 1] = pos[i * 3 + 1] + f * (y / l.length - pos[i * 3 + 1]);
      tmp[i * 3 + 2] = pos[i * 3 + 2] + f * (z / l.length - pos[i * 3 + 2]);
    }
    for (let i = 0; i < pos.length; i++) pos[i] = tmp[i];
  };
  for (let k = 0; k < iterations; k++) {
    step(0.5);
    step(-0.53);
  }
}

function knight() {
  const S = 0.69 / 1000; // world units per silhouette unit
  const X0 = 436; // silhouette x over the base centre; y=1000 (top of the base) sits at 0.112
  const toWorld = (x, y) => [(x - X0) * S, (1000 - y) * S + 0.112];
  const field = knightField();
  const cell = 3; // silhouette units per grid cell
  const nx = Math.ceil(1000 / cell) + 1, ny = Math.ceil(KN_H / cell) + 1;
  const idxF = new Int32Array(nx * ny).fill(-1), idxB = new Int32Array(nx * ny).fill(-1);
  const pos = [];
  const muzzle = [80, 450];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let x = i * cell, y = j * cell;
      const sd = field.sample(x, y);
      if (sd <= 0) continue;
      const k = j * nx + i;
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
      const dW = sd * S;
      const dm = Math.hypot(x - muzzle[0], y - muzzle[1]);
      let T = lerp(0.052, 0.094, smooth(60, 620, dm));
      T *= 1 - 0.58 * smooth(215, 110, y); // thin ears
      const Rr = Math.min(1.0 * T, 0.085);
      const t = Math.min(1, dW / Rr);
      // A sine shoulder (finite slope at the rim) instead of a quarter circle: the grid cannot alias it into ripples.
      let h = T * Math.sin((Math.PI / 2) * t);
      h += T * 0.08 * smooth(0, 0.12, dW); // a slight swell towards the middle
      h += knightRelief(x, y, sd) * smooth(4, 26, sd);
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
  taubin(pos, index, 12);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  // Drop anything below the base top (hidden) and turn the head to face left, three-quarters on.
  geo.computeVertexNormals();
  geo.rotateY(0.5);
  geo.translate(0.01, 0, 0.0);

  const baseProf = resolve([
    ...base(0.235, 0.16).slice(0, -1),
    { c: [0.178, 0.118, 0.19, 0.13, 0.186, 0.142], n: 16 },
    { c: [0.182, 0.156, 0.15, 0.166, 0.1, 0.168], n: 20 },
    [0, 0.17],
  ]);
  return { parts: [lathe(baseProf), geo], field };
}

// ---------------------------------------------------------------------------------------------
// Materials and colour
// ---------------------------------------------------------------------------------------------
const PALETTE = {
  w: { grain: 0.4, base: '#ecd4a8', dark: '#caa674', cavity: '#8a6a44', roughness: 0.46, clearcoat: 0.5, ccRough: 0.32 },
  b: { grain: 0.5, base: '#2c1f19', dark: '#150e0b', cavity: '#0d0907', roughness: 0.4, clearcoat: 0.75, ccRough: 0.22 },
};

function grain(x, y, z) {
  const warp = noise3(x * 4, y * 1.2, z * 4) * 2 + noise3(x * 16, y * 2.5, z * 16) * 0.8;
  const s = Math.sin((x * 0.83 + z * 0.56) * 120 + warp * 2.4);
  const lines = Math.pow(0.5 + 0.5 * s, 6);
  return clamp(lines * 0.6 + noise3(x * 50, y * 10, z * 50) * 0.4, 0, 1);
}

function colorize(geo, pal) {
  const pos = geo.attributes.position;
  const cav = geo.attributes.cavity;
  const base = new THREE.Color(pal.base), dark = new THREE.Color(pal.dark), cavC = new THREE.Color(pal.cavity);
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const g = grain(pos.getX(i), pos.getY(i), pos.getZ(i));
    c.copy(base).lerp(dark, g * pal.grain);
    if (cav) c.lerp(cavC, cav.getX(i) * 0.7);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function material(pal) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: pal.roughness,
    metalness: 0,
    clearcoat: pal.clearcoat,
    clearcoatRoughness: pal.ccRough,
    specularIntensity: 0.6,
  });
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

/** Stouter than a real set: reads better as a 2D sprite on a small square. */
const WIDEN = 1.12;

const BUILDERS = { K: king, Q: queen, B: bishop, R: rook, P: pawn, N: () => knight().parts };
const RADIUS = { K: 0.25, Q: 0.24, B: 0.22, R: 0.235, P: 0.2, N: 0.235 };

function buildPiece(type, color) {
  const pal = PALETTE[color];
  const group = new THREE.Group();
  group.scale.set(WIDEN, 1, WIDEN);
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
function makeCamera() {
  const el = (24 * Math.PI) / 180, dist = 5.2, yc = 0.46;
  const cam = new THREE.PerspectiveCamera(16, 1, 0.5, 20);
  cam.position.set(0, yc + Math.sin(el) * dist, Math.cos(el) * dist);
  cam.lookAt(0, yc, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

/** Rescales the projection so the king fills `fill` of the frame height with its foot `bottom` above the edge. */
function frameCamera(cam, king, fill = 0.94, bottom = 0.03) {
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

function makeScene(env, blob, color, R) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = color === 'w' ? 0.32 : 0.85;

  const key = new THREE.DirectionalLight(0xfff1e0, color === 'w' ? 2.7 : 2.6);
  key.position.set(-2.4, 3.8, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -0.7, right: 0.7, top: 0.7, bottom: -0.7, near: 1, far: 10 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe4ecff, color === 'w' ? 0.18 : 0.5);
  fill.position.set(3, 1.2, 2.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xfff6ea, color === 'w' ? 1.4 : 3.2);
  rim.position.set(2.6, 2.4, -3.2);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xeaf0ff, color === 'w' ? 0.8 : 2.2);
  rim2.position.set(-3, 1.6, -2.6);
  scene.add(rim2);

  // Soft contact shadow baked under the foot.
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
  scene.add(mk(R * 1.25, 0.75, 0.01, -0.005));
  scene.add(mk(R * 1.9, 0.35, 0.05, -0.05));
  return scene;
}

/**
 * Slightly darkens the piece just inside its silhouette (like a photographed piece's shadowed
 * rim), so light pieces keep a readable outline on light squares at small sizes.
 */
const EDGE_DARKEN = { w: 0.24, b: 0 };
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
      d[i] *= 1 - e;
      d[i + 1] *= 1 - e * 1.08;
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
    const scene = makeScene(env, blob, color, RADIUS[type]);
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
    if (EDGE_DARKEN[color]) darkenEdge(sprite, mask, EDGE_DARKEN[color], Math.max(1, Math.round(out / 128)));
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
