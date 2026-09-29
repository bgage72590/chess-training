// Tempo 3D board prototype: the app's Staunton pieces (baked from scripts/pieces/staunton3d.js) on a
// lacquered wooden board you can walk around, with a computer opponent.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Chess } from 'chess.js';
import { PALETTE, material, colorize, blobTexture } from '../../scripts/pieces/staunton3d.js';
import { chooseMove } from './ai/search.mjs';
import BAKED from './pieces-baked.json';
import walnutUrl from './walnut.webp?inline';
import marbleUrl from './marble.webp?inline';

// ------------------------------------------------------------------------------------------------
// Sizes (one square is 1 unit; the pieces were modelled with the king 1.0 tall)
// ------------------------------------------------------------------------------------------------
const PIECE_SCALE = 1.3; // the king's foot is nearly 0.9 of a square across
const BORDER = 0.62; // frame around the squares
const FRAME_H = 0.34; // board thickness
const TABLE_Y = -FRAME_H;
const LIFT = 0.42; // how high a picked-up piece floats
// The baked knight looks along -z (toward Black) when turned by KNIGHT_BASE. Knights are shown in
// profile, looking the way they last moved (at first, toward the middle of the board), turned a
// little toward their own player so the face shows.
const KNIGHT_BASE = -0.5 - Math.PI / 2 + 0.35;
function knightYaw(color, side) {
  const tilt = 0.35 * (color === 'w' ? 1 : -1);
  const dx = side * Math.cos(tilt), dz = Math.sin(Math.abs(tilt)) * (color === 'w' ? 1 : -1);
  return Math.atan2(-dx, -dz) + KNIGHT_BASE;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOTION = reduceMotion ? 0.3 : 1;

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const statusEl = $('status');

// ------------------------------------------------------------------------------------------------
// Renderer, scene, camera
// ------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.setAttribute('aria-label', 'A 3D chessboard. Tap a piece, then a square. Drag the table to walk around the board.');
renderer.domElement.setAttribute('role', 'img');
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = !reduceMotion;
controls.dampingFactor = 0.09;
controls.rotateSpeed = 0.55;
controls.minPolarAngle = 0.0001;
controls.maxPolarAngle = 1.2;
controls.target.set(0, 0, 0.15);

const DEFAULT_PHI = 0.84; // radians from straight down: about where a seated player's eyes are
let fitRadius = 16;

// ------------------------------------------------------------------------------------------------
// Lights: a studio rig and an evening lamp
// ------------------------------------------------------------------------------------------------
const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
key.position.set(-5.5, 11, 6.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 2, far: 32 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
key.shadow.radius = 4;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
fill.position.set(7, 4, 5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff0e0, 0.9);
rim.position.set(3, 5, -9);
scene.add(rim);

const lamp = new THREE.SpotLight(0xffd6a0, 0, 0, 0.62, 0.85, 0);
lamp.position.set(0.6, 13, 2.2);
lamp.target.position.set(0, 0, 0);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.bias = -0.0003;
lamp.shadow.normalBias = 0.02;
lamp.shadow.radius = 5;
scene.add(lamp, lamp.target);

const LOOKS = {
  studio: { bg: 0x241e19, fog: [20, 44], env: 0.38, key: 2.7, fill: 0.22, rim: 1.1, lamp: 0, table: 0x2f2822 },
  lamp: { bg: 0x100c0a, fog: [13, 30], env: 0.16, key: 0.25, fill: 0.08, rim: 0.35, lamp: 5.2, table: 0x221b16 },
};

// ------------------------------------------------------------------------------------------------
// Table and board
// ------------------------------------------------------------------------------------------------
const blob = blobTexture();
const table = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x2f2822, roughness: 0.95 }));
table.rotation.x = -Math.PI / 2;
table.position.y = TABLE_Y;
table.receiveShadow = true;
scene.add(table);

const boardShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
);
boardShadow.rotation.x = -Math.PI / 2;
boardShadow.position.y = TABLE_Y + 0.002;
boardShadow.scale.setScalar(8 + BORDER * 2 + 3.2);
scene.add(boardShadow);

const W = 8 + BORDER * 2;
const loader = new THREE.TextureLoader();
const aniso = renderer.capabilities.getMaxAnisotropy();
const loadTex = (url) => {
  const t = loader.load(url, () => requestRender());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
};
const TEX = { walnut: loadTex(walnutUrl), marble: loadTex(marbleUrl) };

/** The frame's top: mitred wood (or stone) with brass coordinates and an inlay line. */
function frameTexture(kind) {
  const px = 2048, u = px / W;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d');
  const wood = kind === 'walnut';
  g.fillStyle = wood ? '#3a2416' : '#1f2926';
  g.fillRect(0, 0, px, px);
  // Grain (wood) or veins (stone), running along each side of the frame.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const b = BORDER * u;
  const side = (horizontal) => {
    for (let i = 0; i < 260; i++) {
      const t = rnd() * px, w = 0.6 + rnd() * 2.2, a = wood ? 0.05 + rnd() * 0.1 : 0.03 + rnd() * 0.06;
      g.strokeStyle = wood ? (rnd() < 0.5 ? `rgba(20,10,4,${a})` : `rgba(120,70,36,${a})`) : `rgba(200,210,205,${a})`;
      g.lineWidth = w;
      g.beginPath();
      if (horizontal) {
        g.moveTo(0, t);
        for (let x = 0; x <= px; x += 64) g.lineTo(x, t + Math.sin(x / 190 + i) * 3 + (rnd() - 0.5) * 2);
      } else {
        g.moveTo(t, 0);
        for (let y = 0; y <= px; y += 64) g.lineTo(t + Math.sin(y / 190 + i) * 3 + (rnd() - 0.5) * 2, y);
      }
      g.stroke();
    }
  };
  // Top and bottom rails: grain runs across; left and right rails: along. Clip each to its mitred trapezoid.
  const rail = (poly, horizontal) => {
    g.save();
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    side(horizontal);
    g.restore();
  };
  rail([[0, 0], [px, 0], [px - b, b], [b, b]], true);
  rail([[0, px], [px, px], [px - b, px - b], [b, px - b]], true);
  rail([[0, 0], [b, b], [b, px - b], [0, px]], false);
  rail([[px, 0], [px - b, b], [px - b, px - b], [px, px]], false);
  // Mitre joints.
  g.strokeStyle = wood ? 'rgba(10,5,2,0.55)' : 'rgba(0,0,0,0.45)';
  g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[0, 0, b, b], [px, 0, px - b, b], [0, px, b, px - b], [px, px, px - b, px - b]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  // Brass inlay around the squares.
  g.strokeStyle = '#b8874a';
  g.lineWidth = u * 0.035;
  g.strokeRect(b - u * 0.05, b - u * 0.05, px - 2 * b + u * 0.1, px - 2 * b + u * 0.1);
  // Coordinates.
  g.fillStyle = wood ? '#d9b27a' : '#c7d2cc';
  g.font = `600 ${Math.round(u * 0.3)}px Newsreader, Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const c = b + (i + 0.5) * u;
    const file = 'abcdefgh'[i], rank = String(8 - i);
    g.fillText(file, c, px - b / 2);
    g.fillText(rank, b / 2, c);
    g.save();
    g.translate(c, b / 2);
    g.rotate(Math.PI);
    g.fillText(file, 0, 0);
    g.restore();
    g.save();
    g.translate(px - b / 2, c);
    g.rotate(Math.PI);
    g.fillText(rank, 0, 0);
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

const frameTop = new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.28, envMapIntensity: 0.6 });
const frameSide = new THREE.MeshPhysicalMaterial({ color: 0x24150c, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.5 });
const frameGeo = new RoundedBoxGeometry(W, FRAME_H, W, 6, 0.05);
const frame = new THREE.Mesh(frameGeo, [frameSide, frameSide, frameTop, frameSide, frameSide, frameSide]);
frame.position.y = -FRAME_H / 2;
frame.receiveShadow = true;
frame.castShadow = true;
scene.add(frame);

const squaresMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.28, envMapIntensity: 0.55 });
const squares = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), squaresMat);
squares.rotation.x = -Math.PI / 2;
squares.position.y = 0.004;
squares.receiveShadow = true;
scene.add(squares);

function setBoard(kind) {
  squaresMat.map = TEX[kind];
  Object.assign(squaresMat, kind === 'marble' ? { roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.12 } : { roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.28 });
  squaresMat.needsUpdate = true;
  frameTop.map?.dispose();
  frameTop.map = frameTexture(kind);
  frameTop.needsUpdate = true;
  frameSide.color.set(kind === 'marble' ? 0x18201d : 0x2a190f);
  requestRender();
}

// ------------------------------------------------------------------------------------------------
// Pieces
// ------------------------------------------------------------------------------------------------
function unb64(s, Type) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}
const GEO = {};
for (const [t, d] of Object.entries(BAKED)) {
  const qP = unb64(d.pos, Int16Array), qN = unb64(d.nrm, Int8Array), qC = unb64(d.cav, Uint8Array);
  const n = qC.length;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), cav = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = d.lo[k] + ((qP[i * 3 + k] + 32768) / 65535) * (d.hi[k] - d.lo[k]);
      nrm[i * 3 + k] = qN[i * 3 + k] / 127;
    }
    cav[i] = qC[i] / 255;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('cavity', new THREE.BufferAttribute(cav, 1));
  g.setIndex(new THREE.BufferAttribute(d.idx32 ? unb64(d.idx, Uint32Array) : unb64(d.idx, Uint16Array), 1));
  g.normalizeNormals();
  GEO[t] = g;
}
// One geometry per piece and colour (vertex colours carry the carved hollows), one material per colour.
const MATS = { w: material(PALETTE.w), b: material(PALETTE.b) };
const PGEO = {};
for (const c of ['w', 'b'])
  for (const t of Object.keys(GEO)) {
    const g = GEO[t].clone();
    colorize(g, PALETTE[c]);
    PGEO[c + t] = g;
  }
const FOOT_R = 0.333 * PIECE_SCALE;

const blobMat = new THREE.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });

class Piece {
  constructor(color, type) {
    this.color = color;
    this.type = type;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.mesh = new THREE.Mesh(PGEO[color + type.toUpperCase()], MATS[color]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.scale.setScalar(PIECE_SCALE);
    this.mesh.userData.piece = this;

    this.pivot.add(this.mesh);
    this.root.add(this.pivot);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat.clone());
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.setScalar(FOOT_R * 2.7);
    scene.add(this.root, this.shadow);
    this.square = null;
  }
  setType(type) {
    this.type = type;
    this.mesh.geometry = PGEO[this.color + type.toUpperCase()];
  }
  place(p) {
    this.root.position.copy(p);
    this.syncShadow();
  }
  /** Knights look toward +x (side 1) or -x (side -1). */
  face(side) {
    if (this.type === 'n') this.mesh.rotation.y = knightYaw(this.color, side);
  }
  syncShadow() {
    const p = this.root.position;
    const base = p.y < -0.05 ? TABLE_Y : 0;
    this.shadow.position.set(p.x, base + 0.006, p.z);
    const lift = Math.max(0, p.y - base);
    this.shadow.material.opacity = 0.5 * Math.max(0, 1 - lift / 1.4);
    this.shadow.scale.setScalar(FOOT_R * 2.7 * (1 + lift * 0.5) * this.root.scale.x);
  }
  dispose() {
    scene.remove(this.root, this.shadow);
    this.shadow.material.dispose();
  }
}

const sqPos = (sq, y = 0) => new THREE.Vector3('abcdefgh'.indexOf(sq[0]) - 3.5, y, 3.5 - (Number(sq[1]) - 1));

// ------------------------------------------------------------------------------------------------
// Highlights
// ------------------------------------------------------------------------------------------------
const hlMat = (color, opacity, map = null) => new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, toneMapped: false, map, polygonOffset: true, polygonOffsetFactor: -2 });
const flat = (geo, mat) => {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  scene.add(m);
  return m;
};
const squareGeo = new THREE.PlaneGeometry(1, 1);
const lastFrom = flat(squareGeo, hlMat(0xf2c95c, 0.3));
const lastTo = flat(squareGeo, hlMat(0xf2c95c, 0.38));
const selHl = flat(squareGeo, hlMat(0xffe7a3, 0.5));
const hoverHl = flat(squareGeo, hlMat(0xffffff, 0.22));
const checkHl = flat(new THREE.PlaneGeometry(1.5, 1.5), hlMat(0xff3b2f, 0.95, blob));
const dotGeo = new THREE.CircleGeometry(0.15, 32);
const ringGeo = new THREE.RingGeometry(0.39, 0.47, 48);
const dotMat = hlMat(0x1a120a, 0.4);
const dots = Array.from({ length: 28 }, () => flat(dotGeo, dotMat));
const rings = Array.from({ length: 16 }, () => flat(ringGeo, dotMat));
const put = (m, sq, y = 0.009) => {
  m.position.copy(sqPos(sq, y));
  m.visible = true;
};

// ------------------------------------------------------------------------------------------------
// Animation and on-demand rendering
// ------------------------------------------------------------------------------------------------
const tweens = new Set();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(ms, update, done) {
  return new Promise((resolve) => {
    const tw = { start: performance.now(), ms: Math.max(1, ms * MOTION), update, done: () => (done?.(), resolve()) };
    tweens.add(tw);
    requestRender();
  });
}
let frameReq = 0, idle = 0;
function requestRender() {
  idle = 0;
  if (!frameReq) frameReq = requestAnimationFrame(loop);
}
function loop(now) {
  frameReq = 0;
  let active = false;
  for (const tw of [...tweens]) {
    const t = Math.min(1, (now - tw.start) / tw.ms);
    tw.update(t);
    if (t >= 1) {
      tweens.delete(tw);
      tw.done();
    } else active = true;
  }
  if (controls.update()) active = true;
  renderer.render(scene, camera);
  if (active || tweens.size || idle++ < 2) frameReq = requestAnimationFrame(loop);
}
controls.addEventListener('change', requestRender);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Keep the board and the captured pieces beside it in view, whatever the shape of the screen.
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  // Across: the board and the captured pieces beside it. Front to back: the board, seen at an angle.
  fitRadius = Math.max(6.2 / Math.tan(hfov / 2), 4.35 / Math.tan(vfov / 2));
  controls.minDistance = fitRadius * 0.45;
  controls.maxDistance = fitRadius * 1.5;
  camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(stage);

function setView(phi, theta, radius = fitRadius, ms = 900) {
  const off = camera.position.clone().sub(controls.target);
  const from = new THREE.Spherical().setFromVector3(off);
  const to = new THREE.Spherical(radius, phi, theta);
  // Turn the short way round.
  let dTheta = to.theta - from.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
  if (Math.abs(Math.abs(dTheta) - Math.PI) < 1e-3) dTheta = Math.PI;
  const s = new THREE.Spherical();
  return tween(ms, (t) => {
    const e = ease(t);
    s.set(THREE.MathUtils.lerp(from.radius, to.radius, e), THREE.MathUtils.lerp(from.phi, to.phi, e), from.theta + dTheta * e);
    camera.position.setFromSpherical(s).add(controls.target);
    camera.lookAt(controls.target);
  });
}
const viewTheta = () => new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)).theta;

// ------------------------------------------------------------------------------------------------
// Sound: a wooden tok when a piece lands
// ------------------------------------------------------------------------------------------------
let ac = null, soundOn = true;
function tok(vol = 0.6) {
  if (!soundOn) return;
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.15);
    const buf = ac.createBuffer(1, ac.sampleRate * 0.03, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = buf;
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.9;
    ng.gain.value = 0.12 * vol;
    n.connect(f).connect(ng).connect(ac.destination);
    n.start(t);
  } catch {
    /* no audio */
  }
}

// ------------------------------------------------------------------------------------------------
// The game
// ------------------------------------------------------------------------------------------------
const game = new Chess();
const onBoard = new Map(); // square -> Piece
const taken = { w: [], b: [] }; // pieces each side has captured
let selected = null;
let targets = new Map(); // square -> move
let busy = false;
let computer = true;

function trayPos(side, i) {
  // White's captures stand to the right of the board, Black's to the left, nearest their owner first.
  const col = Math.floor(i / 8), row = i % 8;
  const x = (4 + BORDER + 0.6 + col * 0.72) * (side === 'w' ? 1 : -1);
  const z = side === 'w' ? 3.4 - row * 0.86 : -3.4 + row * 0.86;
  return new THREE.Vector3(x, TABLE_Y, z);
}

function clearPieces() {
  for (const p of onBoard.values()) p.dispose();
  for (const s of ['w', 'b']) for (const p of taken[s]) p.dispose();
  onBoard.clear();
  taken.w = [];
  taken.b = [];
}

/** Rebuilds the pieces from the game: on the board, and beside it for everything captured so far. */
function setupFromGame(drop) {
  clearPieces();
  const all = [];
  for (const row of game.board())
    for (const cell of row) {
      if (!cell) continue;
      const p = new Piece(cell.color, cell.type);
      p.square = cell.square;
      p.face('abcdefgh'.indexOf(cell.square[0]) < 4 ? 1 : -1);
      onBoard.set(cell.square, p);
      all.push(p);
    }
  for (const m of game.history({ verbose: true })) {
    if (!m.captured) continue;
    const side = m.color;
    const p = new Piece(side === 'w' ? 'b' : 'w', m.captured);
    p.face(side === 'w' ? -1 : 1);
    p.root.scale.setScalar(0.82);
    p.place(trayPos(side, taken[side].length));
    taken[side].push(p);
  }
  if (!drop) {
    for (const p of all) p.place(sqPos(p.square));
    return Promise.resolve();
  }
  // New game: the pieces are set down rank by rank.
  all.sort((a, b) => Number(a.square[1]) - Number(b.square[1]));
  return Promise.all(
    all.map((p, i) => {
      const to = sqPos(p.square);
      p.place(to.clone().setY(2.2));
      p.root.visible = false;
      return new Promise((r) => setTimeout(r, i * 26 * MOTION)).then(() => {
        p.root.visible = true;
        return tween(420, (t) => {
          p.root.position.y = 2.2 * (1 - ease(t));
          p.syncShadow();
        });
      });
    }),
  ).then(() => tok(0.5));
}

function showHighlights() {
  for (const m of [...dots, ...rings, selHl]) m.visible = false;
  if (selected) put(selHl, selected, 0.007);
  let di = 0, ri = 0;
  for (const [sq, mv] of targets) {
    if (mv.captured) put(rings[ri++], sq);
    else put(dots[di++], sq);
  }
  const last = game.history({ verbose: true }).at(-1);
  lastFrom.visible = lastTo.visible = !!last;
  if (last) {
    put(lastFrom, last.from, 0.006);
    put(lastTo, last.to, 0.006);
  }
  checkHl.visible = false;
  if (game.inCheck()) {
    const kingSq = game.board().flat().find((c) => c && c.type === 'k' && c.color === game.turn())?.square;
    if (kingSq) put(checkHl, kingSq, 0.008);
  }
  requestRender();
}

function liftPiece(p, up) {
  const y0 = p.root.position.y, y1 = up ? LIFT * 0.45 : 0;
  return tween(170, (t) => {
    p.root.position.y = THREE.MathUtils.lerp(y0, y1, ease(t));
    p.syncShadow();
  });
}

function select(sq) {
  const prev = selected && onBoard.get(selected);
  if (prev && selected !== sq) liftPiece(prev, false);
  selected = sq;
  targets = new Map();
  if (sq) {
    for (const mv of game.moves({ square: sq, verbose: true })) if (!targets.has(mv.to) || mv.promotion === 'q') targets.set(mv.to, mv);
    liftPiece(onBoard.get(sq), true);
  }
  showHighlights();
}

/** Carries a piece to `to` along an arc, like a hand moving it; knights hop higher. */
function carry(p, to, { hop = 0.55, ms } = {}) {
  const from = p.root.position.clone();
  const dist = from.distanceTo(to);
  const dur = ms ?? Math.min(820, 420 + dist * 60);
  return tween(dur, (t) => {
    const e = ease(t);
    p.root.position.lerpVectors(from, to, e);
    p.root.position.y += hop * 4 * e * (1 - e);
    p.syncShadow();
  }).then(() => {
    tok(0.7);
    // A small settle as it lands.
    return tween(150, (t) => p.mesh.scale.set(PIECE_SCALE, PIECE_SCALE * (0.955 + 0.045 * t), PIECE_SCALE));
  });
}

async function play(mv, { dragged = false } = {}) {
  busy = true;
  select(null);
  const p = onBoard.get(mv.from);
  const res = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion ? 'q' : undefined });
  onBoard.delete(mv.from);
  const victimSq = res.isEnPassant() ? res.to[0] + res.from[1] : res.to;
  const victim = res.captured ? onBoard.get(victimSq) : null;
  if (victim) onBoard.delete(victimSq);
  onBoard.set(res.to, p);
  p.square = res.to;
  p.face(Math.sign(res.to.charCodeAt(0) - res.from.charCodeAt(0)) || 1);
  const jobs = [carry(p, sqPos(res.to), { hop: dragged ? 0.1 : p.type === 'n' ? 1.0 : 0.55, ms: dragged ? 220 : undefined })];
  if (victim) {
    const side = res.color;
    const slot = trayPos(side, taken[side].length);
    taken[side].push(victim);
    victim.face(side === 'w' ? -1 : 1);
    jobs.push(
      new Promise((r) => setTimeout(r, 260 * MOTION)).then(() =>
        tween(760, (t) => {
          victim.root.scale.setScalar(THREE.MathUtils.lerp(1, 0.82, t));
          victim.syncShadow();
        }),
      ),
      new Promise((r) => setTimeout(r, 260 * MOTION)).then(() => carry(victim, slot, { hop: 1.3, ms: 760 })),
    );
  }
  if (res.isKingsideCastle() || res.isQueensideCastle()) {
    const [rf, rt] = res.isKingsideCastle() ? ['h', 'f'] : ['a', 'd'];
    const rank = res.from[1];
    const rook = onBoard.get(rf + rank);
    onBoard.delete(rf + rank);
    onBoard.set(rt + rank, rook);
    rook.square = rt + rank;
    jobs.push(new Promise((r) => setTimeout(r, 180 * MOTION)).then(() => carry(rook, sqPos(rt + rank), { hop: 0.5 })));
  }
  await Promise.all(jobs);
  if (res.promotion) p.setType('q');
  showHighlights();
  updateStatus();
  busy = false;
  if (game.isCheckmate()) topple();
  else if (computer && game.turn() === 'b' && !game.isGameOver()) computerMove();
}

function topple() {
  const loser = game.turn();
  const sq = game.board().flat().find((c) => c && c.type === 'k' && c.color === loser)?.square;
  const k = sq && onBoard.get(sq);
  if (!k) return;
  // The king tips over its foot, away from the camera's side.
  const dir = Math.random() < 0.5 ? 1 : -1;
  k.pivot.position.x = FOOT_R * dir;
  k.mesh.position.x = -FOOT_R * dir;
  tween(1100, (t) => {
    const e = t < 0.8 ? ease(t / 0.8) : 1 + Math.sin(((t - 0.8) / 0.2) * Math.PI) * 0.04;
    k.pivot.rotation.z = -dir * 1.36 * e;
  }).then(() => tok(0.9));
}

// ------------------------------------------------------------------------------------------------
// The computer: a small search (ai/search.mjs), about as strong as a keen club beginner
// ------------------------------------------------------------------------------------------------
function computerMove() {
  busy = true;
  updateStatus('Thinking…');
  const pause = (900 + Math.random() * 700) * (reduceMotion ? 0.5 : 1);
  // Let "Thinking…" paint before the search takes the main thread; the search's time comes out of the pause.
  setTimeout(() => {
    const t0 = performance.now();
    const { move } = chooseMove(game.fen(), { ms: 600, maxDepth: 3 });
    setTimeout(() => {
      busy = false;
      if (move) play(move);
    }, Math.max(0, pause - 60 - (performance.now() - t0)));
  }, 60);
}

function updateStatus(text) {
  let s = text;
  if (!s) {
    if (game.isCheckmate()) s = game.turn() === 'b' ? 'Checkmate. White wins!' : 'Checkmate. Black wins!';
    else if (game.isStalemate()) s = 'Stalemate. A draw.';
    else if (game.isDraw()) s = 'A draw.';
    else if (game.inCheck()) s = game.turn() === 'w' ? 'Check! Your move.' : 'Check!';
    else s = game.turn() === 'w' ? (computer ? 'Your move (White)' : 'White to move') : computer ? 'Thinking…' : 'Black to move';
  }
  statusEl.textContent = s;
}

// ------------------------------------------------------------------------------------------------
// Pointer: tap a piece then a square, or drag it; drag elsewhere to walk around the board
// ------------------------------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
function aim(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function squareAt(point) {
  const f = Math.floor(point.x + 4), rk = Math.floor(4 - point.z);
  return f >= 0 && f < 8 && rk >= 0 && rk < 8 ? 'abcdefgh'[f] + (rk + 1) : null;
}
/**
 * What a tap means. Seen at an angle, a tall piece stands in front of the squares behind it, so a
 * tap can land on a piece and a square at once: a legal destination wins (a capture's piece, then
 * the square under the tap), then one of the player's own pieces (the one hit, then the one on the
 * square).
 */
function hitTest(e) {
  aim(e);
  const hits = ray.intersectObjects([...onBoard.values()].map((p) => p.mesh), false).map((h) => h.object.userData.piece);
  const pt = ray.ray.intersectPlane(boardPlane, new THREE.Vector3());
  const ground = pt && squareAt(pt);
  const target = hits.find((p) => targets.has(p.square))?.square ?? (ground && targets.has(ground) ? ground : null);
  const mine = (p) => p && p.color === game.turn();
  const own = hits.find(mine) ?? (ground && mine(onBoard.get(ground)) ? onBoard.get(ground) : null);
  return { target, own, square: target ?? own?.square ?? ground };
}
const myTurn = () => !busy && !game.isGameOver() && (!computer || game.turn() === 'w');

let gesture = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  const h = hitTest(e);
  const target = myTurn() && selected && !!h.target;
  const own = myTurn() && !target && !!h.own;
  gesture = { x: e.clientX, y: e.clientY, h, own, target, dragging: false, id: e.pointerId };
  if (own || target) {
    controls.enabled = false; // this gesture moves a piece, not the camera
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!gesture || e.pointerId !== gesture.id || !gesture.own) {
    if (!gesture && myTurn()) {
      const h = hitTest(e);
      renderer.domElement.style.cursor = h.target ? 'pointer' : h.own ? 'grab' : '';
    }
    return;
  }
  if (!gesture.dragging && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 6) {
    gesture.dragging = true;
    if (selected !== gesture.h.own.square) select(gesture.h.own.square);
    renderer.domElement.style.cursor = 'grabbing';
  }
  if (gesture.dragging) {
    aim(e);
    const pt = ray.ray.intersectPlane(dragPlane, new THREE.Vector3());
    if (!pt) return;
    const p = gesture.h.own;
    for (const tw of tweens) tw.ms = 1; // finish the lift at once
    p.root.position.set(THREE.MathUtils.clamp(pt.x, -4.6, 4.6), LIFT, THREE.MathUtils.clamp(pt.z, -4.6, 4.6));
    p.syncShadow();
    const sq = squareAt(p.root.position);
    hoverHl.visible = !!(sq && targets.has(sq));
    if (hoverHl.visible) put(hoverHl, sq, 0.008);
    requestRender();
  }
});
function endGesture(e) {
  if (!gesture || e.pointerId !== gesture.id) return;
  const g = gesture;
  gesture = null;
  controls.enabled = true;
  hoverHl.visible = false;
  renderer.domElement.style.cursor = '';
  const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6;
  if (g.dragging) {
    const p = g.h.own;
    const sq = squareAt(p.root.position);
    if (sq && targets.has(sq)) play(targets.get(sq), { dragged: true });
    else {
      carry(p, sqPos(p.square, LIFT * 0.45), { hop: 0, ms: 260 });
      requestRender();
    }
    return;
  }
  if (moved) return; // the camera was turned
  if (g.target) return void play(targets.get(g.h.target));
  if (g.own) return void select(selected === g.h.own.square ? null : g.h.own.square);
  if (selected) select(null);
}
renderer.domElement.addEventListener('pointerup', endGesture);
renderer.domElement.addEventListener('pointercancel', endGesture);

// ------------------------------------------------------------------------------------------------
// Controls
// ------------------------------------------------------------------------------------------------
function setLook(name) {
  const L = LOOKS[name];
  scene.background = new THREE.Color(L.bg);
  scene.fog = new THREE.Fog(L.bg, ...L.fog);
  scene.environmentIntensity = L.env;
  key.intensity = L.key;
  key.castShadow = L.key > 1;
  fill.intensity = L.fill;
  rim.intensity = L.rim;
  lamp.intensity = L.lamp;
  table.material.color.set(L.table);
  stage.style.background = '#' + L.bg.toString(16).padStart(6, '0');
  requestRender();
}
function setFinish(name) {
  const gloss = name === 'gloss';
  for (const c of ['w', 'b']) {
    const pal = PALETTE[c];
    MATS[c].clearcoat = gloss ? 1 : pal.clearcoat;
    MATS[c].clearcoatRoughness = gloss ? 0.06 : pal.ccRough;
    MATS[c].roughness = gloss ? pal.roughness * 0.7 : pal.roughness;
  }
  requestRender();
}

function segmented(id, onPick) {
  const el = $(id);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of el.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    onPick(b.dataset.v);
  });
}
segmented('opt-board', setBoard);
segmented('opt-finish', setFinish);
segmented('opt-light', setLook);

$('btn-new').addEventListener('click', () => {
  if (busy) return;
  game.reset();
  selected = null;
  targets = new Map();
  busy = true;
  showHighlights();
  updateStatus();
  setupFromGame(true).then(() => (busy = false));
});
$('btn-undo').addEventListener('click', () => {
  if (busy || !game.history().length) return;
  game.undo();
  if (computer && game.turn() === 'b' && game.history().length) game.undo();
  selected = null;
  targets = new Map();
  setupFromGame(false);
  showHighlights();
  updateStatus();
});
$('btn-computer').addEventListener('click', (e) => {
  computer = !computer;
  e.currentTarget.setAttribute('aria-pressed', String(computer));
  e.currentTarget.querySelector('span').textContent = computer ? 'Computer plays Black' : 'Two players';
  updateStatus();
  if (computer && game.turn() === 'b' && !busy && !game.isGameOver()) computerMove();
});
$('btn-sound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  e.currentTarget.setAttribute('aria-pressed', String(soundOn));
  e.currentTarget.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound off';
});
$('btn-turn').addEventListener('click', () => {
  const off = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  setView(off.phi, viewTheta() + Math.PI, off.radius);
});
$('btn-top').addEventListener('click', () => setView(0.0001, Math.round(viewTheta() / Math.PI) * Math.PI, fitRadius * 1.08));
$('btn-angled').addEventListener('click', () => setView(DEFAULT_PHI, Math.round(viewTheta() / Math.PI) * Math.PI, fitRadius));

// ------------------------------------------------------------------------------------------------
// Start
// ------------------------------------------------------------------------------------------------
resize();
camera.position.setFromSpherical(new THREE.Spherical(fitRadius * 1.25, DEFAULT_PHI - 0.18, 0)).add(controls.target);
camera.lookAt(controls.target);
setLook('studio');
setBoard('walnut');
updateStatus();
busy = true;
(document.fonts?.ready ?? Promise.resolve()).then(() => setBoard('walnut'));
setupFromGame(true).then(() => (busy = false));
setView(DEFAULT_PHI, 0, fitRadius, 1600);
$('loading').hidden = true;
window.__board = { hitAt: (x, y) => { const h = hitTest({ clientX: x, clientY: y }); return { target: h.target, own: h.own?.square ?? null, square: h.square, cam: camera.position.toArray().map((v) => +v.toFixed(2)) }; }, game, camera, controls, setView, requestRender, onBoard, sqPos, renderer, scene, state: () => ({ busy, selected, targets: [...targets.keys()], tweens: tweens.size, status: statusEl.textContent, turn: game.turn() }) };
