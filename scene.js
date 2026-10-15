import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sm = x => x * x * (3 - 2 * x);
const eo = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);

/* ---------- renderer / scene ---------- */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#nogl').style.display = 'block'; canvas.style.display = 'none';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;

const BG = 0x050b14;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 70, 190);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);

const key = new THREE.DirectionalLight(0xfff0dd, 2.3);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
const sc = key.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 160;
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.07; key.shadow.radius = 2.5;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6fa8ff, 1.1);
scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x15110d, 0.35));

/* ---------- materials ---------- */
function noiseTex(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), id = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const v = 150 + Math.random() * 105; id.data.set([v, v, v, 255], i * 4); }
  g.putImageData(id, 0, 0);
  g.globalAlpha = .5; g.filter = 'blur(1.2px)'; g.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.NoColorSpace;
  return t;
}
const bump = noiseTex();
function glassTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.34)'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(240,244,248,1)'; g.fillRect(0, 0, 5, 128); g.fillRect(0, 0, 128, 5); g.fillRect(0, 123, 128, 5);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const M = {
  concrete: new THREE.MeshStandardMaterial({ color: 0xc2bfb8, roughness: .9, bumpMap: bump, bumpScale: .5 }),
  concreteD: new THREE.MeshStandardMaterial({ color: 0xaeaba5, roughness: .92, bumpMap: bump, bumpScale: .5 }),
  panel: new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: .85, bumpMap: bump, bumpScale: .3 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x0c1624, roughness: .95 }),
  edge: new THREE.MeshBasicMaterial({ color: 0x1f7fe0, transparent: true, opacity: .75 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xa8d6ff, map: glassTex(), roughness: .06, metalness: .1, transparent: true, opacity: 1, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: .38, metalness: .9 }),
  pv: new THREE.MeshPhysicalMaterial({ color: 0x14264a, roughness: .22, metalness: .55, clearcoat: 1, clearcoatRoughness: .1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 1, bumpMap: bump, bumpScale: 2 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 1 }),
  ptfe: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .4 }),
  membrane: new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: .35, transparent: true, opacity: .45 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x4da3ff, emissive: 0x2f8cff, emissiveIntensity: 2.2, roughness: .4 }),
  rebar: new THREE.MeshStandardMaterial({ color: 0xb4a79a, roughness: .5, metalness: .6 }),
  xray: new THREE.MeshStandardMaterial({ color: 0xcfcdc7, roughness: .8, transparent: true, opacity: .34, depthWrite: false }),
};

/* ---------- model helper (staggered assembly) ---------- */
class Model {
  constructor(ox, oz = 0) {
    this.g = new THREE.Group(); this.g.position.set(ox, 0, oz); scene.add(this.g);
    this.pieces = []; this.t = REDUCED ? 1 : 0; this.target = 0; this.speed = .5; this.origin = V3(ox, 0, oz);
  }
  add(mesh, delay = 0, from = V3(0, 16, 0), parent = this.g) {
    if (!mesh.userData.ns) mesh.castShadow = mesh.material !== M.glass; mesh.receiveShadow = true;
    parent.add(mesh);
    this.pieces.push({ m: mesh, home: mesh.position.clone(), off: from.clone().add(V3((Math.random() - .5) * 5, 0, (Math.random() - .5) * 5)), delay });
    return mesh;
  }
  still(mesh, parent = this.g) { mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  stage(R, cx = 0, cz = 0) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .5, 96), M.floor); d.position.set(cx, -.3, cz); d.receiveShadow = true; this.g.add(d);
    const r = new THREE.Mesh(new THREE.RingGeometry(R - .35, R, 128), M.edge); r.rotation.x = -Math.PI / 2; r.position.set(cx, .02, cz); this.g.add(r);
  }
  update(dt) {
    const d = this.target - this.t;
    this.t += Math.sign(d) * Math.min(Math.abs(d), dt * this.speed * (d < 0 ? 2.2 : 1));
    for (const p of this.pieces) {
      const k = eo(clamp((this.t * 1.5 - p.delay) / .5, 0, 1));
      p.m.position.copy(p.home).addScaledVector(p.off, 1 - k);
      p.m.visible = k > .002;
    }
  }
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}
// extrude a (u,v) profile along world X, centred, profile u -> world z, v -> world y
function extrudeX(shape, len, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(-Math.PI / 2); g.translate(len / 2, 0, 0);
  return new THREE.Mesh(g, mat);
}
const poly = pts => { const s = new THREE.Shape(); pts.forEach(([a, b], i) => i ? s.lineTo(a, b) : s.moveTo(a, b)); s.closePath(); return s; };

/* ---------- Ondal building (shed or flat) ---------- */
function buildOndal(ox, o = {}) {
  const { rows = [0, 20, 40], nz = 3, pitch = 7.5, colH = 9, walls = true, flat = false, R = 40 } = o;
  const m = new Model(ox);
  const W = rows[rows.length - 1] - rows[0], D = nz * pitch, cx = W / 2, cz = D / 2;
  m.stage(Math.hypot(cx, cz) + 7, cx, cz);
  m.g.userData.center = V3(cx, 0, cz);
  const slab = box(W + 4, .3, D + 4, M.concreteD, cx, -.15, cz); m.still(slab);
  const zs = Array.from({ length: nz + 1 }, (_, j) => j * pitch);
  let n = 0; const nc = rows.length * zs.length;
  for (const x of rows) for (const z of zs) { m.add(box(.8, colH, .8, M.concrete, x, colH / 2, z), (n++ / nc) * .22, V3(0, 20, 0)); }
  n = 0;
  for (const x of rows) for (let j = 0; j < nz; j++) m.add(box(.7, 1.2, pitch - .8, M.concrete, x, colH - .6, zs[j] + pitch / 2), .22 + (n++ / (rows.length * nz)) * .2, V3(0, 20, 0));
  const y0 = colH - .75, H = 2.3, L0 = .55, T = .22;
  const roofs = { pv: [], green: [], tegoli: [] };
  n = 0; const nt = (rows.length - 1) * nz;
  for (let i = 0; i < rows.length - 1; i++) {
    const L = rows[i + 1] - rows[i] - .6, xm = (rows[i] + rows[i + 1]) / 2;
    for (let j = 0; j < nz; j++) {
      const dl = .42 + (n++ / nt) * .4;
      const z0 = zs[j];
      if (!flat) {
        const sh = poly([[0, L0], [pitch, H], [pitch, H - T], [0, L0 - T]]);
        const t = extrudeX(sh, L, M.concrete); t.position.set(xm, y0, z0); m.add(t, dl);
        m.add(box(L, L0 - T, .32, M.concrete, xm, y0 + (L0 - T) / 2, z0 + .18), dl + .02);
        m.add(box(L, H - T, .32, M.concrete, xm, y0 + (H - T) / 2, z0 + pitch - .18), dl + .02);
        const gl = box(L, H - L0, .07, M.glass, xm, y0 + L0 + (H - L0) / 2, z0 + pitch - .02); m.add(gl, dl + .1);
        if (o.pv) {
          const ang = Math.atan((H - L0) / pitch);
          const p = box(L - 1, .05, pitch - 1.2, M.pv, xm, y0 + (H + L0) / 2 + .1, z0 + pitch / 2); p.rotation.x = -ang; m.add(p, dl + .12); roofs.pv.push(p);
        }
      } else {
        // flat Ondal: ribbed slab
        const t = box(L, .5, pitch - .05, M.concrete, xm, y0 + .25, z0 + pitch / 2); m.add(t, dl);
        const par = box(L, .35, .2, M.concrete, xm, y0 + .67, z0 + .1); m.add(par, dl + .02);
        if (o.roofKinds) {
          const kind = o.roofKinds[j % o.roofKinds.length];
          if (kind === 'green') {
            const soil = box(L - .6, .3, pitch - .6, M.soil, xm, y0 + .65, z0 + pitch / 2); m.add(soil, dl + .1);
            const gr = box(L - .6, .12, pitch - .6, M.grass, xm, y0 + .86, z0 + pitch / 2); m.add(gr, dl + .12);
            roofs.green.push(soil, gr);
          } else {
            for (let k = 0; k < 4; k++) {
              const zc = z0 + .9 + k * (pitch - 1.4) / 3.3;
              const p = box(L - 2, .05, 1.35, M.pv, xm, y0 + 1.15, zc); p.rotation.x = -.34; m.add(p, dl + .14); roofs.pv.push(p);
              const f = box(L - 2, .5, .08, M.steel, xm, y0 + .85, zc - .55); m.add(f, dl + .14); roofs.pv.push(f);
            }
          }
        }
      }
    }
  }
  if (walls) {
    const pw = (W) / 8, ph = 2.5; let k = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) m.add(box(pw - .04, ph - .04, .3, M.panel, pw * c + pw / 2, ph * r + ph / 2, -.5), .78 + (k++ / 24) * .2, V3(0, 0, -26));
    const pd = D / 5; k = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) m.add(box(.3, ph - .04, pd - .04, M.panel, W + .5, ph * r + ph / 2, pd * c + pd / 2), .8 + (k++ / 15) * .18, V3(26, 0, 0));
  }
  m.roofs = roofs;
  return m;
}

/* ---------- TAU ---------- */
function buildTau(ox) {
  const m = new Model(ox); m.stage(30);
  const L = 24, colH = 7, zsB = [-7.5, -2.5, 2.5, 7.5], bw = 1.0;
  m.g.userData.center = V3(0, 5, 0);
  m.still(box(L + 6, .3, 24, M.concreteD, 0, -.15, 0));
  const prof = x => .7 + 1.15 * (1 - Math.pow(2 * x / L, 2));
  const shape = new THREE.Shape(); shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0);
  const N = 40; for (let i = 0; i <= N; i++) { const x = L / 2 - (i / N) * L; shape.lineTo(x, prof(x)); } shape.closePath();
  let n = 0;
  for (const z of [-7.5, -2.5, 2.5, 7.5]) {
    for (const x of [-L / 2, L / 2]) m.add(box(1.0, colH, 1.2, M.concrete, x, colH / 2, z), (n++ / 8) * .2, V3(0, 20, 0));
  }
  n = 0;
  for (const z of zsB) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: bw, bevelEnabled: false, curveSegments: 12 }); g.translate(0, 0, -bw / 2);
    const b = new THREE.Mesh(g, M.concrete); b.position.set(0, colH, z); m.add(b, .25 + (n++ / 4) * .3, V3(0, 20, 0));
    m.add(box(1.1, .2, 1.5, M.concreteD, -L / 2, colH - .1, z), .2); m.add(box(1.1, .2, 1.5, M.concreteD, L / 2, colH - .1, z), .2);
  }
  // secondary purlins + roof sheet between beams (light)
  for (let i = 0; i < 3; i++) {
    const z = (zsB[i] + zsB[i + 1]) / 2;
    for (const x of [-9, -3, 3, 9]) m.add(box(.5, .35, 5 - bw, M.concreteD, x, colH + prof(x) - .17, z), .6 + i * .05);
  }
  // rain particles on the parabolic extrados
  const NP = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(NP * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7fc4ff, size: .22, transparent: true, opacity: .95, depthWrite: false }));
  pts.frustumCulled = false; m.g.add(pts);
  const drops = Array.from({ length: NP }, () => ({ b: zsB[(Math.random() * 4) | 0], x: (Math.random() * 2 - 1) * L / 2, s: Math.random() < .5 ? -1 : 1, f: -1, v: 0 }));
  m.rain = dt => {
    drops.forEach((d, i) => {
      if (d.f >= 0) { d.v += 12 * dt; d.f += d.v * dt; if (d.f > colH + .5) { d.x = (Math.random() * 2 - 1) * 2; d.f = -1; d.s = Math.random() < .5 ? -1 : 1; d.b = zsB[(Math.random() * 4) | 0]; } }
      else { d.x += d.s * (1.2 + Math.abs(d.x) * .35) * dt * 2.2; if (Math.abs(d.x) > L / 2) { d.x = d.s * L / 2; d.f = 0; d.v = 0; } }
      const x = d.x, y = d.f >= 0 ? colH + prof(clamp(x, -L / 2, L / 2)) - d.f : colH + prof(x) + .05;
      pos[i * 3] = x; pos[i * 3 + 1] = Math.max(.05, y); pos[i * 3 + 2] = d.b + (Math.random() - .5) * .02 + ((i % 7) - 3) * .06;
    });
    geo.attributes.position.needsUpdate = true;
  };
  return m;
}

/* ---------- Manini Plan ---------- */
function buildPlan(ox) {
  const m = new Model(ox); m.stage(30);
  m.g.userData.center = V3(0, 5, 0);
  m.still(box(26, .3, 18, M.concreteD, 0, -.15, 0));
  const px = 9, pz = 6, H = 8;
  let n = 0;
  for (const x of [-px, px]) for (const z of [-pz, pz]) {
    m.add(box(.9, H, .9, M.concrete, x, H / 2, z), (n++ / 4) * .2, V3(0, 20, 0));
    m.add(box(1.5, .5, 1.1, M.concreteD, x, H + .25, z), .22, V3(0, 20, 0));
  }
  // main prestressed beams along z
  n = 0;
  for (const x of [-px, px]) {
    const b = box(.8, 1.2, pz * 2 - .5, M.concrete, x, H + .5 + .6, 0); m.add(b, .34 + (n++) * .05, V3(0, 20, 0));
    // prestress strands glowing under the beam
    const s = box(.1, .1, pz * 2 - 1, M.glow, x, H + .65, 0); s.userData.ns = true; m.add(s, .4, V3(0, 20, 0));
  }
  // secondary T beams along x
  const T = poly([[-.12, 0], [.12, 0], [.12, .55], [.5, .55], [.5, .8], [-.5, .8], [-.5, .55], [-.12, .55]]);
  const top = H + .5 + 1.2;
  [-4.8, -2.4, 0, 2.4, 4.8].forEach((z, i) => {
    const t = extrudeX(T, px * 2 - .6, M.concrete); t.position.set(0, top, z); m.add(t, .55 + i * .04, V3(0, 20, 0));
  });
  const mem = box(px * 2 + 1.8, .14, pz * 2 + 1.2, M.membrane, 0, top + .87, 0); m.add(mem, .86, V3(0, 16, 0));
  return m;
}

/* ---------- Solai ---------- */
function buildSolai(ox) {
  const m = new Model(ox); m.stage(24);
  m.g.userData.center = V3(0, 1.5, 0);
  m.still(box(22, .3, 16, M.concreteD, 0, -.15, 0));
  const len = 10, y0 = 1.1;
  for (const x of [-len / 2 + 1, len / 2 - 1]) { m.add(box(.9, y0, 15, M.concrete, x, y0 / 2, 0), 0, V3(0, 16, 0)); }
  const poker = (th, w, z, d) => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, th); s.lineTo(0, th); s.closePath();
    const nH = 5, r = th * .31;
    for (let i = 0; i < nH; i++) { const p = new THREE.Path(); p.absarc(w / (nH * 2) + i * w / nH, th / 2, r, 0, Math.PI * 2, true); s.holes.push(p); }
    const e = extrudeX(s, len, M.concrete); e.position.set(0, y0, z); m.add(e, d, V3(0, 18, 0));
  };
  poker(.2, 1.2, -6.8, .2); poker(.32, 1.2, -5.5, .3); poker(.5, 1.2, -4.2, .4);
  const pg = poly([[0, .5], [2.5, .5], [2.5, .6], [2.3, .6], [2.3, 0], [2.1, 0], [2.1, .6], [.4, .6], [.4, 0], [.2, 0], [.2, .6], [0, .6]]);
  // PI-Greco: thin top slab with two downstand ribs
  const pi = poly([[0, .6], [2.5, .6], [2.5, .75], [0, .75]]);
  const pie = extrudeX(pi, len, M.concrete); pie.position.set(0, y0 - .0, .8); m.add(pie, .5, V3(0, 18, 0));
  for (const dz of [.35, 2.15]) m.add(box(len, .6, .22, M.concrete, 0, y0 + .3, .8 + dz), .55, V3(0, 18, 0));
  // Pluriman style: slab + metal deck
  m.add(box(len, .1, 2.5, M.steel, 0, y0 + .05, 4.3 + 1.25 + 0), .65, V3(0, 18, 0));
  m.add(box(len, .5, 2.5, M.concrete, 0, y0 + .4, 5.55 + 0), .7, V3(0, 18, 0));
  return m;
}

/* ---------- Seismic demo ---------- */
function buildSeismic(ox) {
  const m = new Model(ox); m.stage(24);
  m.g.userData.center = V3(0, 4, 0);
  const H = 6, X = 6;
  const ground = box(24, .6, 9, M.concreteD, 0, -.3, 0); m.still(ground);
  const mk = (w, d, x, z) => { const g = new THREE.BoxGeometry(w, H, d); g.translate(0, H / 2, 0); const c = new THREE.Mesh(g, M.concrete); c.castShadow = c.receiveShadow = true; c.matrixAutoUpdate = false; m.g.add(c); return { c, x, z }; };
  const cols = { L: [mk(.7, .7, -X, -2.5), mk(.7, .7, -X, 2.5)], R: [mk(1.3, 1.1, X, -2.5), mk(1.3, 1.1, X, 2.5)] };
  const pivot = new THREE.Group(); m.g.add(pivot);
  const beam = box(12.6, .9, 5.8, M.concrete, 6.3, 0, 0); beam.castShadow = true; pivot.add(beam);
  const slab = box(12.6, .25, 6.6, M.concreteD, 6.3, .55, 0); slab.castShadow = true; pivot.add(slab);
  const seatR = new THREE.Group(); m.g.add(seatR);
  const rigid = box(1.1, .12, 4.8, M.steel, 0, 0, 0); const bolt = [-1.8, 1.8].map(z => { const b = box(.18, .5, .18, M.steel, 0, .2, z); seatR.add(b); return b; });
  const slide = box(1.3, .28, 4.8, M.ptfe, 0, 0, 0);
  const rail = [-2.55, 2.55].map(z => { const r = box(1.7, .4, .12, M.steel, 0, .1, z); seatR.add(r); return r; });
  seatR.add(rigid, slide);
  // static head caps for left side
  const capL = [-2.5, 2.5].map(z => { const c = box(1.3, .25, 1.2, M.concreteD, 0, 0, z); m.g.add(c); return c; });
  const capR = [-2.5, 2.5].map(z => { const c = box(1.8, .25, 1.4, M.concreteD, 0, 0, z); m.g.add(c); return c; });
  const S = {
    t: -1, mode: 'rigid', I: 5, xg: 0, vg: 0, uL: 0, vL: 0, uR: 0, vR: 0, failed: false, fall: 0, fv: 0, peak: 0, running: false, d: 0,
  };
  const VX = 5, CAP = { rigid: .10, alldrift: .34 };
  const ag = t => {
    if (t < 0) return 0;
    const env = Math.min(1, t / .6) * Math.exp(-Math.max(0, t - 3.4) / 1.1);
    return env * (.6 * Math.sin(2 * Math.PI * .95 * t) + .5 * Math.sin(2 * Math.PI * 1.8 * t + 1.3) + .4 * Math.sin(2 * Math.PI * 3.1 * t + 2.1) + .3 * Math.sin(2 * Math.PI * 4.6 * t + .4));
  };
  const reset = () => { Object.assign(S, { t: -1, xg: 0, vg: 0, uL: 0, vL: 0, uR: 0, vR: 0, failed: false, fall: 0, fv: 0, peak: 0, running: false, d: 0 }); beam.material = M.concrete; };
  S.reset = reset; S.start = () => { reset(); S.t = 0; S.running = true; };
  const wL = 2 * Math.PI * 1.0, wR = 2 * Math.PI * 2.4, z = .07;
  S.step = dt => {
    const sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (S.t >= 0 && S.running) S.t += h;
      const a = S.I * .45 * ag(S.t);
      S.vg += (a - 2 * .7 * 1.57 * S.vg - 1.57 * 1.57 * S.xg) * h; S.xg += S.vg * h;
      S.vL += (-a - 2 * z * wL * S.vL - wL * wL * S.uL) * h; S.uL += S.vL * h;
      S.vR += (-a - 2 * z * wR * S.vR - wR * wR * S.uR) * h; S.uR += S.vR * h;
      if (!S.failed) {
        const d = Math.abs(S.uL - S.uR); S.peak = Math.max(S.peak, d); S.d = d;
        if (d > CAP[S.mode]) { S.failed = true; S.fv = 0; beam.material = new THREE.MeshStandardMaterial({ color: 0xd3d0c9, roughness: .9, emissive: 0xff2200, emissiveIntensity: .8 }); }
      }
    }
    if (S.t > 9) S.running = false;
    if (S.failed) { S.fv += 9.8 * .35 * dt; S.fall = Math.min(.55, S.fall + S.fv * dt); }
  };
  S.apply = () => {
    const xg = S.xg, uL = S.uL * VX, uR = S.uR * VX;
    ground.position.x = xg;
    for (const { c, x, z } of cols.L) { c.matrix.set(1, uL / H, 0, x + xg, 0, 1, 0, 0, 0, 0, 1, z, 0, 0, 0, 1); c.matrixWorldNeedsUpdate = true; }
    for (const { c, x, z } of cols.R) { c.matrix.set(1, uR / H, 0, x + xg, 0, 1, 0, 0, 0, 0, 1, z, 0, 0, 0, 1); c.matrixWorldNeedsUpdate = true; }
    const hy = H + .25;
    capL.forEach((c, i) => c.position.set(-X + xg + uL, hy, i ? 2.5 : -2.5));
    capR.forEach((c, i) => c.position.set(X + xg + uR, hy, i ? 2.5 : -2.5));
    pivot.position.set(-X + xg + uL - .4, hy + .5 + .12, 0);
    pivot.rotation.z = -S.fall;
    seatR.position.set(X + xg + uR, hy + .17, 0);
    const rg = S.mode === 'rigid';
    rigid.visible = rg; bolt.forEach(b => b.visible = rg); slide.visible = !rg; rail.forEach(r => r.visible = !rg);
  };
  S.cap = () => CAP[S.mode];
  m.seis = S;
  return m;
}

/* ---------- Manini Connect ---------- */
function buildConnect(ox) {
  const m = new Model(ox); m.stage(30, 7, 0);
  m.g.userData.center = V3(7, 6, 0);
  m.still(box(34, .3, 20, M.concreteD, 6, -.15, 0));
  const H = 9;
  const pill = box(1.2, H, 1.2, M.xray, 0, H / 2, 0); pill.userData.ns = true; pill.renderOrder = 2; m.add(pill, 0, V3(0, 16, 0));
  for (const [x, z] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) m.add(box(.07, H - .1, .07, M.rebar, x, H / 2, z), .1, V3(0, 16, 0));
  m.add(box(5.5, .9, 1.0, M.concrete, 2.7, H + .45, 0), .3, V3(0, 14, 0));
  m.add(box(8, .3, 8, M.concreteD, 3.2, H + 1.05, 0), .4, V3(0, 14, 0));
  const tbox = box(1.1, .8, .8, M.steel, 1.2, H + 1.6, 0); m.add(tbox, .55, V3(0, 14, 0));
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 8), M.steel); ant.position.set(1.2, H + 2.7, 0); m.add(ant, .6, V3(0, 14, 0));
  const sensors = [1.2, 3.2, 5.2, 7.2, 8.6].map((y, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), M.glow.clone()); s.position.set(0, y, 0); s.userData.ns = true; m.add(s, .2 + i * .02, V3(0, 14, 0)); return s; });
  // cloud + control room
  const cloud = new THREE.Group(); cloud.position.set(9, 15, -3);
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, transparent: true, opacity: .85 });
  [[0, 0, 0, 1.6], [1.5, -.2, .2, 1.2], [-1.4, -.3, 0, 1.1], [.4, .5, .3, 1.1]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), cm); s.position.set(x, y, z); s.castShadow = false; cloud.add(s); });
  m.g.add(cloud);
  const room = box(10, 5, 6, M.concrete, 18, 2.5, 4); m.add(room, .7, V3(30, 0, 0));
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const cg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.725), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(18, 2.6, 7.03); m.g.add(screen);
  // path for packets
  const path = [V3(0, 1.2, 0), V3(0, H + .3, 0), V3(1.2, H + 1.7, 0), V3(5, 12.5, -1.5), V3(9, 15, -3), V3(14, 9, 0), V3(18, 3.8, 7)];
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', .4);
  const NPk = 30, packets = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fc0ff }), NPk);
  packets.frustumCulled = false; m.g.add(packets);
  const C = { ev: null, t0: 0, lvl: 0, hist: new Array(160).fill(0), flash: 0, alarm: false, ph: 0 };
  C.trigger = e => { C.ev = e; C.t0 = time; C.alarm = false; };
  const dummy = new THREE.Object3D();
  C.update = (dt, time) => {
    const el = C.ev ? time - C.t0 : 99;
    let sig = 0;
    if (C.ev && el < 7) {
      const env = Math.min(1, el / .8) * Math.exp(-Math.max(0, el - 3.5) / 1.4);
      if (C.ev === 'rain') sig = env * (.55 + .1 * Math.sin(el * 3)) ;
      if (C.ev === 'quake') sig = env * (.9 * Math.sin(el * 38) * Math.sin(el * 5.1) + .2);
      if (C.ev === 'wind') sig = env * (.5 + .35 * Math.sin(el * 2.2) * Math.sin(el * 9));
    }
    const noise = (Math.random() - .5) * .08;
    C.lvl = lerp(C.lvl, Math.abs(sig), Math.min(1, dt * 8));
    C.hist.push(sig + noise); C.hist.shift();
    const over = Math.abs(sig) > .45;
    if (over && !C.alarm) C.alarm = true;
    // sensors
    sensors.forEach((s, i) => { s.material.emissiveIntensity = 1.5 + 4.5 * C.lvl * (.6 + .4 * Math.sin(time * 14 + i)) + .6 * Math.sin(time * 3 + i); s.scale.setScalar(1 + .6 * C.lvl); });
    // packets
    const speed = .12 + C.lvl * .35;
    C.ph = (C.ph + dt * speed) % 1;
    for (let i = 0; i < NPk; i++) { const u = ((C.ph + i / NPk) % 1 + 1) % 1; dummy.position.copy(curve.getPoint(u)); dummy.scale.setScalar(.8 + C.lvl * .8); dummy.updateMatrix(); packets.setMatrixAt(i, dummy.matrix); }
    packets.instanceMatrix.needsUpdate = true;
    // screen
    cg.fillStyle = '#0a0b0e'; cg.fillRect(0, 0, 640, 360);
    cg.strokeStyle = 'rgba(255,255,255,.07)'; cg.lineWidth = 1;
    for (let i = 1; i < 6; i++) { cg.beginPath(); cg.moveTo(0, i * 60); cg.lineTo(640, i * 60); cg.stroke(); }
    cg.fillStyle = '#9a9aa0'; cg.font = '500 17px monospace'; cg.fillText('MANINI CONNECT · CONTROL ROOM', 24, 34);
    cg.fillStyle = over || C.alarm ? '#ff4d4d' : '#34d399'; cg.fillText(over ? 'ALLARME' : C.alarm ? 'ANOMALIA RILEVATA' : 'NEI PARAMETRI', 24, 62);
    cg.strokeStyle = 'rgba(77,163,255,.6)'; cg.setLineDash([6, 6]); cg.beginPath(); cg.moveTo(0, 150); cg.lineTo(640, 150); cg.moveTo(0, 270); cg.lineTo(640, 270); cg.stroke(); cg.setLineDash([]);
    cg.strokeStyle = over ? '#ff6a4d' : '#6db4ff'; cg.lineWidth = 3; cg.beginPath();
    C.hist.forEach((v, i) => { const x = i * 4, y = 210 - v * 150; i ? cg.lineTo(x, y) : cg.moveTo(x, y); }); cg.stroke(); cg.lineWidth = 1;
    tex.needsUpdate = true;
  };
  m.conn = C;
  return m;
}

/* ---------- build everything ---------- */
const STEP = 140;
const mOndal = buildOndal(0, { rows: [0, 20, 40], nz: 3, colH: 9, R: 44 });
const mOndalP = buildOndal(STEP, { rows: [0, 32], nz: 2, colH: 10.5, walls: false, R: 38 });
const mTau = buildTau(STEP * 2);
const mPlan = buildPlan(STEP * 3);
const mSolai = buildSolai(STEP * 4);
const mSeis = buildSeismic(STEP * 5);
const mConn = buildConnect(STEP * 6);
const mGreen = buildOndal(STEP * 7, { rows: [0, 18, 36], nz: 4, colH: 8, walls: false, flat: true, roofKinds: ['pv', 'green'], R: 40 });
const models = [mOndal, mOndalP, mTau, mPlan, mSolai, mSeis, mConn, mGreen];
// a small orange Ondal+ slab label model needs the centre of mOndalP
mOndalP.g.userData.center = V3(16, 0, 7.5);
mOndal.g.userData.center = V3(20, 0, 11);
mGreen.g.userData.center = V3(18, 0, 15);

/* ---------- beats (camera + labels) ---------- */
const O = m => m.origin;
const B = (m, c, d, az, el, labels = [], mi = m) => ({ m: mi, c: O(m).clone().add(c), d, az, el, labels: labels.map(([p, t]) => ({ p: O(m).clone().add(V3(...p)), t })) });
const beats = [
  B(mOndal, V3(18, 4.5, 11), 92, -36, 21),
  B(mOndal, V3(24, 8.5, 9), 58, -62, 11, [[[12, 10.3, 15], 'Shed vetrato · luce naturale'], [[30, 9.2, 7.5], 'Tegoli · interasse 5,00–7,50 m'], [[0, 5, 22.5], 'Pilastri prefabbricati']]),
  B(mOndalP, V3(16, 6, 7.5), 74, -34, 18, [[[16, 11.6, 0], 'Luce fino a 32 m'], [[32, 5, 15], 'Maglia 25 × 25 m e oltre']]),
  B(mTau, V3(0, 6.5, 0), 54, -30, 14, [[[0, 8.9, -7.5], 'Estradosso parabolico'], [[0, 7.0, 7.5], 'Intradosso piano'], [[12, 9, 2.5], 'Deflusso dell’acqua']]),
  B(mPlan, V3(0, 7.5, 0), 48, -42, 22, [[[-9, 4, 6], 'Pilastro'], [[9, 9.6, 0], 'Trave principale precompressa'], [[0, 11.2, -2.4], 'Trave secondaria a T'], [[-5, 11.2, 6], 'Manto isolante continuo']]),
  B(mSolai, V3(5, 1.6, -2.4), 15, 76, 6, [[[5, 1.3, -6.3], 'Poker · 20–50 cm'], [[5, 2.0, 2.0], 'PI-Greco · 40–80 cm']]),
  B(mSeis, V3(0, 4.5, 0), 40, 0, 8, []),
  B(mConn, V3(8, 6.5, 2), 48, -26, 12, [[[0, 9.4, 0], 'Sensori nel pilastro'], [[1.2, 11.9, 0], 'Trasmettitore sul tetto'], [[9, 16.8, -3], 'Cloud'], [[18, 5.7, 7], 'Control Room']]),
  B(mGreen, V3(18, 4, 15), 64, -40, 24, [[[9, 9.8, 4], 'Fotovoltaico senza forare il manto'], [[27, 9.2, 11], 'Tetto verde · deflusso −70%']]),
];
beats.forEach((b, i) => b.m.beat = i);
const beatModel = beats.map(b => b.m);

/* ---------- labels ---------- */
const labelHost = $('#labels');
beats.forEach(b => b.labels.forEach(l => { l.el = document.createElement('div'); l.el.className = 'tag'; l.el.textContent = l.t; labelHost.appendChild(l.el); }));

/* ---------- scroll mapping ---------- */
let anchors = [], vw = innerWidth, vh = innerHeight;
function measure() {
  vw = innerWidth; vh = innerHeight;
  anchors = [...document.querySelectorAll('[data-beat]')].map(el => ({ i: +el.dataset.beat, y: el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 })).sort((a, b) => a.i - b.i);
  ranges = [...document.querySelectorAll('.s3d')].map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; });
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix(); layoutView();
}
let offX = 0, offY = 0;
function layoutView() {
  const wide = vw > 900;
  offX = wide ? vw * .15 : 0; offY = wide ? 0 : -vh * .2;
  camera.setViewOffset(vw, vh, -offX, -offY, vw, vh);
}
function frac() {
  const sy = scrollY + vh / 2;
  if (!anchors.length) return 0;
  if (sy <= anchors[0].y) return 0;
  for (let k = 0; k < anchors.length - 1; k++) {
    const a = anchors[k], b = anchors[k + 1];
    if (sy < b.y) return a.i + sm(clamp((sy - a.y) / (b.y - a.y), 0, 1)) * (b.i - a.i);
  }
  return anchors[anchors.length - 1].i;
}
addEventListener('resize', measure);
addEventListener('load', () => { measure(); setTimeout(measure, 600); });
document.fonts && document.fonts.ready.then(measure);

let ranges = [];
const inView = () => ranges.some(r => r[1] > scrollY - vh * .1 && r[0] < scrollY + vh * 1.1);
let mx = 0, my = 0;
addEventListener('pointermove', e => { mx = (e.clientX / vw - .5) * 2; my = (e.clientY / vh - .5) * 2; });

/* ---------- UI: seismic ---------- */
const S = mSeis.seis;
const seMode = $('#seMode'), seI = $('#seI');
seMode.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seMode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); S.mode = b.dataset.m; S.reset(); });
seI.addEventListener('input', () => { S.I = +seI.value; $('#seIo').textContent = '≈ ' + (S.I * .05).toFixed(2).replace('.', ',') + ' g'; });
$('#seGo').addEventListener('click', () => S.start());
const fm = v => v.toFixed(3).replace('.', ',') + ' m';
function seUI() {
  const cap = S.cap();
  $('#seC').textContent = cap.toFixed(2).replace('.', ',') + ' m';
  $('#seD').textContent = fm(S.running || S.failed || S.peak ? S.peak : 0);
  const r = S.peak / cap, mt = $('#seM'); mt.style.width = clamp(r, 0, 1) * 100 + '%'; mt.className = r >= 1 ? 'bad' : r > .6 ? 'warn' : '';
  const st = $('#seS');
  if (S.failed) { st.textContent = 'Collasso: la trave perde l’appoggio.'; st.className = 'status bad'; }
  else if (S.t > 4.5 && !S.running || S.t > 9) { st.textContent = 'Struttura integra. La trave ha scorso e resta in appoggio.'; st.className = 'status ok'; }
  else if (S.running) { st.textContent = 'Scossa in corso…'; st.className = 'status warn'; }
  else if (S.t < 0) { st.textContent = 'Premi “Scuoti”.'; st.className = 'status'; }
}
/* ---------- UI: connect ---------- */
const cnEv = $('#cnEv');
cnEv.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  cnEv.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  mConn.conn.trigger(b.dataset.e);
  const msg = { rain: 'Carico anomalo sulla copertura. Avviso inviato alla Control Room.', quake: 'Vibrazioni sismiche rilevate. Allarme alla Control Room.', wind: 'Sollecitazioni da vento eccezionale. Avviso inviato.' }[b.dataset.e];
  const s = $('#cnS'); s.textContent = msg; s.className = 'status warn';
  clearTimeout(cnEv._t); cnEv._t = setTimeout(() => { s.textContent = 'Struttura nei parametri di progetto.'; s.className = 'status ok'; cnEv.querySelectorAll('button').forEach(x => x.classList.remove('on')); }, 6500);
});
/* ---------- UI: green ---------- */
$('#gnT').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on');
  const on = b.classList.contains('on'); mGreen.roofs[b.dataset.t].forEach(o => o.userData.hide = !on);
});

/* ---------- loop ---------- */
let fS = 0, last = performance.now(), time = 0;
const camPos = V3(), camTgt = V3(), tmp = V3();
let intro = REDUCED ? 1 : 0;
function sph(t, d, az, el, out) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  return out.set(t.x + d * Math.cos(e) * Math.sin(a), t.y + d * Math.sin(e), t.z + d * Math.cos(e) * Math.cos(a));
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt = clamp((now - last) / 1000, 0, .05); last = now; time += dt;
  if (!anchors.length) measure();
  const f = frac();
  fS += (f - fS) * (1 - Math.exp(-dt * 4.5));
  const i = clamp(Math.floor(fS), 0, beats.length - 1), j = Math.min(i + 1, beats.length - 1), k = sm(clamp(fS - i, 0, 1));
  const A = beats[i], Bt = beats[j];
  camTgt.lerpVectors(A.c, Bt.c, k);
  const d = lerp(A.d, Bt.d, k) * (vw < 900 ? 1.4 : 1), az = lerp(A.az, Bt.az, k) + mx * 6 + (REDUCED ? 0 : Math.sin(time * .15) * 4), el = lerp(A.el, Bt.el, k) - my * 2;
  const introK = eo(clamp(intro, 0, 1));
  sph(camTgt, d * (1 + (1 - introK) * .35), az + (1 - introK) * 30, el + (1 - introK) * 6, camPos);
  camera.position.copy(camPos); camera.lookAt(camTgt);
  // assemble models near the current beat
  models.forEach(m => { m.target = m.beat !== undefined && Math.abs(fS - m.beat) < 1.15 ? 1 : 0; });
  mOndal.target = Math.abs(fS - 0) < 2.2 ? 1 : 0;
  if (!REDUCED && intro < 1) { intro += dt * .35; }
  // lights follow
  key.position.set(camTgt.x - 26, camTgt.y + 44, camTgt.z + 30); key.target.position.copy(camTgt);
  rim.position.set(camTgt.x + 30, camTgt.y + 20, camTgt.z - 34); rim.target.position.copy(camTgt);
  const run = inView() || Math.abs(fS - Math.round(fS)) > .02;
  if (run) {
    models.forEach(m => m.update(dt));
    mTau.rain(dt);
    mGreen.roofs.pv.concat(mGreen.roofs.green).forEach(o => { if (o.userData.hide) o.visible = false; });
    S.step(dt); S.apply(); seUI();
    mConn.conn.update(dt, time);
    // labels
    beats.forEach((b, bi) => {
      const show = Math.abs(fS - bi) < .22 && b.m.t > .97;
      b.labels.forEach(l => {
        tmp.copy(l.p).project(camera);
        const x = (tmp.x * .5 + .5) * vw, y = (-tmp.y * .5 + .5) * vh;
        l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-12px,-50%)`;
        l.el.classList.toggle('on', show && tmp.z < 1);
      });
    });
    renderer.render(scene, camera);
  }
}
measure();
requestAnimationFrame(tick);
window.__manini = { models, beats, S, mConn, go(i) { const a = anchors.find(a => a.i === i); scrollTo({ top: a.y - vh / 2, behavior: 'instant' }); fS = i; models.forEach(m => m.t = 1); }, get f() { return fS; } };
