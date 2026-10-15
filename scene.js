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
  cap: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: .42, metalness: .55 }),
  lam: new THREE.MeshStandardMaterial({ color: 0xaab2ba, roughness: .35, metalness: .85, map: (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#c8ced4'; g.fillRect(0, 0, 128, 16); for (let i = 0; i < 128; i += 8) { g.fillStyle = '#7f8993'; g.fillRect(i, 0, 3, 16); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace; return t; })() }),
  deck: new THREE.MeshStandardMaterial({ color: 0xdfe2e3, roughness: .5, bumpMap: bump, bumpScale: .2 }),
  membrane: new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: .35, transparent: true, opacity: .45 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x4da3ff, emissive: 0x2f8cff, emissiveIntensity: 2.2, roughness: .4 }),
  rebar: new THREE.MeshStandardMaterial({ color: 0xb4a79a, roughness: .5, metalness: .6 }),
  xray: new THREE.MeshStandardMaterial({ color: 0xcfcdc7, roughness: .8, transparent: true, opacity: .34, depthWrite: false }),
};

/* ---------- model helper (staggered assembly) ---------- */
class Model {
  constructor(ox, oz = 0) {
    this.g = new THREE.Group(); this.g.position.set(ox, 0, oz); scene.add(this.g);
    this.pieces = []; this.ex = 0; this.exT = 0; this.ex2 = 0; this.ex2T = 0; this.det = false; this.hidden = new Set(); this.t = REDUCED ? 1 : 0; this.target = 0; this.speed = .5; this.origin = V3(ox, 0, oz);
  }
  add(mesh, delay = 0, from = V3(0, 16, 0), parent = this.g, exp = null, grp = '') {
    if (!mesh.userData.ns) mesh.castShadow = mesh.material !== M.glass; mesh.receiveShadow = true;
    parent.add(mesh);
    this.pieces.push({ m: mesh, home: mesh.position.clone(), off: from.clone().add(V3((Math.random() - .5) * 5, 0, (Math.random() - .5) * 5)), delay, exp, grp });
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
    this.ex += (this.exT - this.ex) * Math.min(1, dt * 4); this.ex2 += (this.ex2T - this.ex2) * Math.min(1, dt * 4);
    for (const p of this.pieces) {
      const k = eo(clamp((this.t * 1.5 - p.delay) / .5, 0, 1));
      p.m.position.copy(p.home).addScaledVector(p.off, 1 - k);
      if (p.exp) p.m.position.addScaledVector(p.exp, this.ex);
      if (p.exp2) p.m.position.addScaledVector(p.exp2, this.ex2);
      p.m.visible = k > .002 && !(p.hideDet && this.det) && !(p.grp && this.hidden.has(p.grp));
    }
  }
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}
// extrude a (u,v) profile along world X, centred, profile u -> world z, v -> world y
function extrudeXGeo(shape, len) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(-Math.PI / 2); g.translate(len / 2, 0, 0);
  return g;
}
function extrudeX(shape, len, mat) { return new THREE.Mesh(extrudeXGeo(shape, len), mat); }
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
  m.dyn = { right: [], span: [], slab, L0: rows[1] - rows[0] - .6, W }; m.glassStrips = [];
  const xr = rows[rows.length - 1];
  for (const x of rows) for (const z of zs) { const c = m.add(box(.8, colH, .8, M.concrete, x, colH / 2, z), (n++ / nc) * .22, V3(0, 20, 0)); if (x === xr) m.dyn.right.push(c); }
  n = 0;
  if (o.omega) {
    // Super-Omega: trave a sezione a omega con appoggi bassi per i tegoli
    const om = poly([[-1, 0], [1, 0], [1, .32], [.46, .32], [.46, 1.55], [-.46, 1.55], [-.46, .32], [-1, .32]]);
    for (const x of rows) { const g = new THREE.ExtrudeGeometry(om, { depth: D, bevelEnabled: false }); const bm = new THREE.Mesh(g, M.concrete); bm.position.set(x, colH, 0); m.add(bm, .22 + (n++ / rows.length) * .2, V3(0, 20, 0)); if (x === xr) m.dyn.right.push(bm); }
  } else {
    for (const x of rows) for (let j = 0; j < nz; j++) { const b = m.add(box(.7, 1.2, pitch - .8, M.concrete, x, colH - .6, zs[j] + pitch / 2), .22 + (n++ / (rows.length * nz)) * .2, V3(0, 20, 0)); if (x === xr) m.dyn.right.push(b); }
  }
  n = 0;
  const y0 = o.omega ? colH + .3 : colH - .75, H = 2.3, L0 = .55, T = .22;
  const cap = o.cap || 'shed', WING = 1.6, WRISE = .72, HG = 1.5, SAG = .8; m.cappelle = [];
  const roofs = { pv: [], green: [], tegoli: [] };
  n = 0; const nt = (rows.length - 1) * nz;
  for (let i = 0; i < rows.length - 1; i++) {
    const L = rows[i + 1] - rows[i] - (o.omega ? 1.8 : .6), xm = (rows[i] + rows[i + 1]) / 2; if (i === 0) m.dyn.L0 = L;
    if (o.roof === 'tau' || o.roof === 'plan') {
      if (o.roof === 'tau') {
        const nT = Math.max(2, Math.round(D / 5)), sp = D / nT, FW = 1.0, GAPT = sp - FW - .06, SAGT = .5, NX = 36;
        const prof = x => .75 + 1.1 * (1 - Math.pow(2 * x / L, 2));
        const stemS = new THREE.Shape(); stemS.moveTo(-L / 2, 0); stemS.lineTo(L / 2, 0);
        for (let q = 0; q <= NX; q++) { const x = L / 2 - (q / NX) * L; stemS.lineTo(x, prof(x) - .16); } stemS.closePath();
        const flS = new THREE.Shape(); for (let q = 0; q <= NX; q++) { const x = -L / 2 + q * L / NX; q ? flS.lineTo(x, prof(x)) : flS.moveTo(x, prof(x)); } for (let q = NX; q >= 0; q--) { const x = -L / 2 + q * L / NX; flS.lineTo(x, prof(x) - .16); } flS.closePath();
        const archH = zz => { const r = zz / (GAPT / 2); return Math.abs(r) >= 1 ? 0 : SAGT * (1 - r * r); };
        for (let q = 0; q <= nT; q++) {
          const z = q * sp, dl2 = .42 + (q / (nT + 1)) * .4;
          const gS = new THREE.ExtrudeGeometry(stemS, { depth: .26, bevelEnabled: false }); gS.translate(0, 0, -.13);
          const st = new THREE.Mesh(gS, M.concrete); st.position.set(xm, colH, z); m.add(st, dl2);
          const gF = new THREE.ExtrudeGeometry(flS, { depth: FW, bevelEnabled: false, curveSegments: 1 }); gF.translate(0, 0, -FW / 2);
          const fl = new THREE.Mesh(gF, M.concrete); fl.position.set(xm, colH, z); m.add(fl, dl2 + .01);
          m.add(box(L, .26, .56, M.concrete, xm, colH - .13, z), dl2 + .01);
          if (q < nT) {
            const g = new THREE.PlaneGeometry(L - .4, GAPT, 20, 10); g.rotateX(-Math.PI / 2);
            const P = g.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), zz = P.getZ(k); P.setY(k, prof(clamp(x, -L / 2, L / 2)) - .08 + archH(zz)); }
            g.computeVertexNormals(); const cm = M.cap.clone(); cm.side = THREE.DoubleSide;
            const arc = new THREE.Mesh(g, cm); arc.position.set(xm, colH, z + sp / 2); m.add(arc, dl2 + .06); m.cappelle.push(arc);
            const gg = new THREE.PlaneGeometry(4.2, GAPT, 4, 10); gg.rotateX(-Math.PI / 2);
            const Q = gg.attributes.position; for (let k = 0; k < Q.count; k++) { const x = Q.getX(k), zz = Q.getZ(k); Q.setY(k, prof(clamp(x, -L / 2, L / 2)) - .05 + archH(zz)); }
            gg.computeVertexNormals(); const gl2 = new THREE.Mesh(gg, M.glass); gl2.position.set(xm, colH, z + sp / 2); gl2.castShadow = false; m.add(gl2, dl2 + .1);
          }
        }
        m.stat = { name: 'Travi TAU', n: (rows.length - 1) * (nT + 1) };
      } else {
        const cnt = Math.max(3, Math.floor(D / 2.4) + 1);
        const Tp = poly([[-.12, 0], [.12, 0], [.12, .55], [.5, .55], [.5, .8], [-.5, .8], [-.5, .55], [-.12, .55]]);
        for (let q = 0; q < cnt; q++) { const t = extrudeX(Tp, L, M.concrete); t.position.set(xm, colH, q * D / (cnt - 1)); m.add(t, .42 + (q / cnt) * .4); }
        const mb = box(L + .6, .14, D + 1.2, M.membrane.clone(), xm, colH + .87, D / 2); m.add(mb, .88, V3(0, 16, 0)); m.cappelle.push(mb);
        m.stat = { name: 'Travi a T', n: (rows.length - 1) * cnt };
      }
      continue;
    }
    for (let j = 0; j < nz; j++) {
      const dl = .42 + (n++ / nt) * .4;
      const z0 = zs[j];
      if (!flat) {
        const gp = pitch - 2 * WING, ty = y0 + WRISE + .15;
        // tegolo alare a V sulla linea dei pilastri (primo giro di j)
        if (j === 0) for (let q = 0; q <= nz; q++) {
          const V = poly([[-WING, WRISE], [0, 0], [WING, WRISE], [WING, WRISE + .15], [0, .15], [-WING, WRISE + .15]]);
          const t = extrudeX(V, L, M.concrete); t.position.set(xm, y0, zs[q]); m.add(t, dl - .02 + q * .01); m.dyn.span.push(t);
        }
        const zA = z0 + WING;
        if (cap === 'shed' || cap === 'both') {
          const sp = poly([[0, 0], [gp, HG], [gp, HG - .1], [0, -.1]]);
          const c1 = extrudeX(sp, L, M.cap); c1.position.set(xm, ty, zA); m.add(c1, dl + .04, V3(0, 16, 0), m.g, null, 'shed'); m.dyn.span.push(c1); m.cappelle.push(c1);
          const gl = box(L, HG, .07, M.glass, xm, ty + HG / 2, zA + gp); m.add(gl, dl + .1, V3(0, 16, 0), m.g, null, 'shed'); m.dyn.span.push(gl);
          m.glassStrips.push({ x0: xm - L / 2, x1: xm + L / 2, z: zA + gp, yb: ty, yt: ty + HG });
          if (o.pv) { const ang = Math.atan(HG / gp), p = box(L - 1, .05, Math.hypot(gp, HG) - .8, M.pv, xm, ty + HG / 2 + .12, zA + gp / 2); p.rotation.x = -ang; m.add(p, dl + .12); roofs.pv.push(p); }
        }
        if (cap === 'curve' || cap === 'both') {
          const R = (gp * gp / 4 + SAG * SAG) / (2 * SAG), a0 = Math.asin(gp / 2 / R), pts = [], pts2 = [];
          for (let q = 0; q <= 18; q++) { const a = -a0 + 2 * a0 * q / 18, zz = R * Math.sin(a) + gp / 2, yy = R * Math.cos(a) - (R - SAG); pts.push([zz, yy]); pts2.push([R * .0 + (R - .09) * Math.sin(a) + gp / 2, (R - .09) * Math.cos(a) - (R - SAG)]); }
          const cs = new THREE.Shape(); pts.forEach((p, k) => k ? cs.lineTo(p[0], p[1]) : cs.moveTo(p[0], p[1])); pts2.reverse().forEach(p => cs.lineTo(p[0], p[1])); cs.closePath();
          const c2 = extrudeX(cs, L, M.cap); c2.position.set(xm, ty, zA); m.add(c2, dl + .04, V3(0, 16, 0), m.g, null, 'curve'); m.dyn.span.push(c2); m.cappelle.push(c2);
          for (let q = 0; q < 3; q++) { const lx = box(L * .2, .05, gp * .42, M.glass, xm + (q - 1) * L * .3, ty + SAG + .02, zA + gp / 2); m.add(lx, dl + .1, V3(0, 16, 0), m.g, null, 'curve'); (m.skyH = m.skyH || []).push({ x0: xm + (q - 1) * L * .3 - L * .1, x1: xm + (q - 1) * L * .3 + L * .1, z0: zA + gp / 2 - gp * .21, z1: zA + gp / 2 + gp * .21, y: ty + SAG + .02 }); }
        }
        if (o.pv && 0) { /* riservato */ }
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
    const ph = 2.5, nR = Math.max(2, Math.floor((colH - .5) / ph)), nW = Math.max(3, Math.round(W / 5)), pw = W / nW; let k = 0;
    for (let r = 0; r < nR; r++) for (let c = 0; c < nW; c++) m.add(box(pw - .04, ph - .04, .3, M.panel, pw * c + pw / 2, ph * r + ph / 2, -.5), .78 + (k++ / (nR * nW)) * .2, V3(0, 0, -26));
    const nD = Math.max(3, Math.round(D / 5)), pd = D / nD; k = 0;
    for (let r = 0; r < nR; r++) for (let c = 0; c < nD; c++) m.add(box(.3, ph - .04, pd - .04, M.panel, W + .5, ph * r + ph / 2, pd * c + pd / 2), .8 + (k++ / (nR * nD)) * .18, V3(26, 0, 0));
  }
  m.setSpan = S => {
    const ph = mesh => m.pieces.find(p => p.m === mesh);
    m.dyn.right.forEach(c => { ph(c).home.x = S; });
    m.dyn.span.forEach(c => { ph(c).home.x = S / 2; c.scale.x = (S - .6) / m.dyn.L0; });
    m.dyn.slab.scale.x = (S + 4) / (m.dyn.W + 4); m.dyn.slab.position.x = S / 2;
  };
  if (!m.stat) m.stat = { name: 'Tegoli', n: (rows.length - 1) * (flat ? nz : nz + 1) };
  if (cap === 'both') m.hidden.add('curve');
  m.roofs = roofs;
  return m;
}

/* ---------- TAU ---------- */
function buildTau(ox) {
  const m = new Model(ox); m.stage(30);
  const L = 24, colH = 7, zsB = [-7.5, -2.5, 2.5, 7.5], FW = 1.0, GAP = 5 - FW - .06, SAG = .5;
  m.g.userData.center = V3(0, 5, 0);
  m.still(box(L + 6, .3, 24, M.concreteD, 0, -.15, 0));
  const prof = x => .75 + 1.1 * (1 - Math.pow(2 * x / L, 2));
  const dprof = x => -1.1 * 2 * (2 * x / L) * (2 / L);
  const N = 40;
  const stemS = new THREE.Shape(); stemS.moveTo(-L / 2, 0); stemS.lineTo(L / 2, 0);
  for (let i = 0; i <= N; i++) { const x = L / 2 - (i / N) * L; stemS.lineTo(x, prof(x) - .16); } stemS.closePath();
  const flS = new THREE.Shape(); for (let q = 0; q <= N; q++) { const x = -L / 2 + q * L / N; q ? flS.lineTo(x, prof(x)) : flS.moveTo(x, prof(x)); } for (let q = N; q >= 0; q--) { const x = -L / 2 + q * L / N; flS.lineTo(x, prof(x) - .16); } flS.closePath();
  let n = 0;
  for (const z of zsB) for (const x of [-L / 2, L / 2]) m.add(box(1.0, colH, 1.2, M.concrete, x, colH / 2, z), (n++ / 8) * .2, V3(0, 20, 0));
  n = 0;
  for (const z of zsB) {
    // trave TAU: anima sottile, piattabanda superiore larga 1 m, bulbo inferiore
    const gS = new THREE.ExtrudeGeometry(stemS, { depth: .26, bevelEnabled: false }); gS.translate(0, 0, -.13);
    const st = new THREE.Mesh(gS, M.concrete); st.position.set(0, colH, z); m.add(st, .25 + (n++ / 4) * .3, V3(0, 20, 0));
    const gF = new THREE.ExtrudeGeometry(flS, { depth: FW, bevelEnabled: false, curveSegments: 1 }); gF.translate(0, 0, -FW / 2);
    const fl = new THREE.Mesh(gF, M.concrete); fl.position.set(0, colH, z); m.add(fl, .27 + (n) * .02, V3(0, 20, 0));
    m.add(box(L, .26, .56, M.concrete, 0, colH - .13, z), .26 + n * .02, V3(0, 20, 0));
    m.add(box(1.1, .2, 1.5, M.concreteD, -L / 2, colH - .1, z), .2); m.add(box(1.1, .2, 1.5, M.concreteD, L / 2, colH - .1, z), .2);
  }
  // cappella curva fra le travi (segue la parabola); lucernari a raso in vetro
  const archH = zz => { const r = (zz / (GAP / 2)); return Math.abs(r) >= 1 ? 0 : SAG * (1 - r * r); };
  const arch = (xc, w, zc, mat, lift) => {
    const g = new THREE.PlaneGeometry(w, GAP, Math.max(2, Math.round(w / L * N)), 12); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i) + xc, zz = P.getZ(i); P.setY(i, prof(clamp(x, -L / 2, L / 2)) - .08 + archH(zz) + lift); }
    g.computeVertexNormals(); const mesh = new THREE.Mesh(g, mat); mesh.position.set(xc, colH, zc); mesh.userData.ns = false; return mesh;
  };
  for (let i = 0; i < 3; i++) {
    const zc = (zsB[i] + zsB[i + 1]) / 2;
    const c = arch(0, L - 1.2, zc, M.cap, 0); c.material = M.cap.clone(); c.material.side = THREE.DoubleSide; m.add(c, .62 + i * .05, V3(0, 20, 0), m.g, null, 'tauroof');
    if (i === 1) for (const xk of [-8, 0, 8]) { const gm = arch(xk, 4.2, zc, M.glass, .03); m.add(gm, .8, V3(0, 20, 0), m.g, null, 'tauroof'); gm.castShadow = false; }
  }
  // pioggia: cade, tocca la copertura curva, scorre lungo la parabola, scende
  const NP = 320, geo = new THREE.BufferGeometry(), pos = new Float32Array(NP * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: .9 }));
  pts.frustumCulled = false; m.g.add(pts);
  // confronto: tetto piano. L'acqua non ha pendenza e ristagna
  const flatDeck = box(L - .4, .3, 15 - .2, M.deck, 0, colH + .85, 0); flatDeck.visible = false; m.g.add(flatDeck);
  const poolM = new THREE.MeshStandardMaterial({ color: 0x4aa8ff, roughness: .1, metalness: .2, transparent: true, opacity: .75 });
  const pool = new THREE.Mesh(new THREE.BoxGeometry(L - .6, 1, 14.6), poolM); pool.visible = false; m.g.add(pool);
  m.flat = false; m.pool = 0; m.shed = 0; m.shedT = 0;
  m.setFlat = f => { m.flat = f; if (f) m.hidden.add('tauroof'); else m.hidden.delete('tauroof'); flatDeck.visible = f; };
  const surf = (x, z) => { if (m.flat) return colH + 1.05; const dz = (((z + 7.5) % 5) + 5) % 5 - 2.5; return colH + prof(clamp(x, -L / 2, L / 2)) + archH(dz) + .02; };
  const resp = d => { d.x = (Math.random() * 2 - 1) * L / 2; d.z = zsB[0] + Math.random() * (zsB[3] - zsB[0]); d.y = colH + prof(d.x) + 3 + Math.random() * 22; d.v = 0; d.s = 0; d.dir = d.x < 0 ? -1 : 1; };
  const drops = Array.from({ length: NP }, () => { const d = {}; resp(d); return d; });
  m.rainN = NP;
  m.rain = dt => {
    drops.forEach((d, i) => {
      let len = 1.1;
      if (d.s === 0) { d.v += 16 * dt; d.y -= d.v * dt; const sf = surf(d.x, d.z); len = 1.1 + Math.min(d.v * .05, .8); if (d.y <= sf) { d.y = sf; d.v = 0; if (m.flat) { d.s = 3; d.life = .25 + Math.random() * .5; m.pool = Math.min(1, m.pool + .0035); m.shedT++; } else { d.s = 1; m.shed++; } } }
      else if (d.s === 3) { d.life -= dt; len = .08; if (d.life <= 0) resp(d); }
      else if (d.s === 1) { d.x += d.dir * (1.8 + Math.abs(d.x) * .45) * dt * 2.2; d.y = surf(d.x, d.z); len = .35; if (Math.abs(d.x) >= L / 2) { d.s = 2; d.v = 0; } }
      else { d.v += 14 * dt; d.y -= d.v * dt; len = 1 + Math.min(d.v * .05, .8); if (d.y < 0) resp(d); }
      const y = i >= m.rainN ? -80 : d.y, dx = d.s === 1 ? -d.dir * len : 0, dy = d.s === 1 ? 0 : len;
      pos.set([d.x, y, d.z, d.x + dx, y + dy, d.z], i * 6);
    });
    geo.attributes.position.needsUpdate = true;
    m.pool = clamp(m.pool - dt * (m.flat ? .012 : .5), 0, 1);
    const hh = .04 + m.pool * .6; pool.visible = m.flat && m.pool > .005; pool.scale.y = hh; pool.position.set(0, colH + 1 + hh / 2, 0);
  };
  // fotovoltaico: telaio fissato senza forare il manto
  const pvM = new THREE.MeshPhysicalMaterial({ color: 0x14264a, roughness: .22, metalness: .55, clearcoat: 1, clearcoatRoughness: .1, emissive: 0x1f5fd0, emissiveIntensity: .2 });
  const pvList = [];
  for (let i = 0; i < 3; i++) for (const kx of [-8, -4, 0, 4, 8]) for (const dz of [-.95, .95]) {
    const zc = (zsB[i] + zsB[i + 1]) / 2 + dz, p = box(2.1, .06, 1.5, pvM, kx, 0, zc);
    p.rotation.set(dz < 0 ? .22 : -.22, 0, Math.atan(dprof(kx))); p.castShadow = true; p.visible = false; m.g.add(p);
    pvList.push({ m: p, y: surf(kx, zc) + .22 });
  }
  m.pv = { n: pvList.length, area: pvList.length * 2.1 * 1.5, t: 0, target: 0 };
  m.pvUpdate = (dt, time) => {
    const q = m.pv, d = q.target - q.t; q.t += Math.sign(d) * Math.min(Math.abs(d), dt * .7);
    pvList.forEach((p, i) => { const k = eo(clamp((q.t * 1.7 - i / pvList.length * .7) / .3, 0, 1)); p.m.visible = k > .01; p.m.scale.setScalar(Math.max(k, .001)); p.m.position.y = p.y + (1 - k) * 5; });
    pvM.emissiveIntensity = .18 + .12 * Math.sin(time * 2.2);
  };
  return m;
}

/* ---------- Manini Plan ---------- */
function buildPlan(ox) {
  const m = new Model(ox); m.stage(30);
  m.g.userData.center = V3(0, 5, 0);
  m.still(box(26, .3, 18, M.concreteD, 0, -.15, 0));
  const px = 9, pz = 6, H = 8, up = V3(0, 20, 0), E = h => V3(0, h, 0);
  let n = 0;
  for (const x of [-px, px]) for (const z of [-pz, pz]) {
    m.add(box(.9, H, .9, M.concrete, x, H / 2, z), (n++ / 4) * .2, up);
    // testa del pilastro a forcella: due ali che accolgono l'anima della trave
    m.add(box(1.5, .3, 1.1, M.concreteD, x, H + .15, z), .22, up, m.g, E(2));
    for (const sx of [-1, 1]) m.add(box(.5, .9, 1.1, M.concrete, x + sx * .5, H + .75, z), .23, up, m.g, E(2));
  }
  n = 0;
  for (const x of [-px, px]) {
    // trave principale precompressa a doppio T: bulbo, anima sottile, piattabanda superiore
    const I = poly([[-.3, 0], [.3, 0], [.3, .3], [.13, .5], [.13, 1.2], [.5, 1.3], [.5, 1.4], [-.5, 1.4], [-.5, 1.3], [-.13, 1.2], [-.13, .5], [-.3, .3]]);
    const gI = new THREE.ExtrudeGeometry(I, { depth: pz * 2 - .5, bevelEnabled: false }); gI.translate(0, 0, -(pz * 2 - .5) / 2);
    const bI = new THREE.Mesh(gI, M.concrete); bI.position.set(x, H + .3, 0); m.add(bI, .34 + (n++) * .05, up, m.g, E(5));
    const s = box(.1, .1, pz * 2 - 1, M.glow, x, H + .65, 0); s.userData.ns = true; m.add(s, .4, up, m.g, E(5));
  }
  const T = poly([[-.12, 0], [.12, 0], [.12, .55], [.5, .55], [.5, .8], [-.5, .8], [-.5, .55], [-.12, .55]]);
  const top = H + .5 + 1.2;
  [-4.8, -2.4, 0, 2.4, 4.8].forEach((z, i) => {
    const t = extrudeX(T, px * 2, M.concrete); t.position.set(0, top, z); m.add(t, .55 + i * .04, up, m.g, E(9)); if (i === 2) m.pieces[m.pieces.length - 1].exp2 = V3(0, 1.5, 0);
  });
  m.add(box(px * 2 + 1.8, .14, pz * 2 + 1.2, M.membrane, 0, top + .87, 0), .86, V3(0, 16, 0), m.g, E(13)); m.pieces[m.pieces.length - 1].hideDet = true;
  // schematic bearing detail of the secondary T beam on the main beam (shown in 'detail' mode)
  const det = new THREE.Group(); det.visible = false; m.g.add(det); m.detGroup = det;
  const padM = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: .9 }), groutM = new THREE.MeshStandardMaterial({ color: 0xe8e3d6, roughness: .95 });
  for (const sx of [-1, 1]) {
    const x = sx * (px - .25);
    for (const o of [box(.5, .02, .3, M.steel, x, top + .01, 0), box(.46, .045, .26, padM, x, top + .045, 0), box(.5, .1, .1, groutM, x, top + .05, .2), box(.5, .1, .1, groutM, x, top + .05, -.2)]) { o.receiveShadow = true; o.castShadow = true; det.add(o); }
    for (const dz of [-.065, .065]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .7, 14), M.steel); d.position.set(x, top + .05, dz); d.castShadow = true; det.add(d); }
  }
  return m;
}

/* ---------- Solai ---------- */
const rrPath = (cx, cy, w, h, r) => { const p = new THREE.Path(), x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2; r = Math.min(r, w / 2, h / 2);
  p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false); p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false); p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false); p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false); return p; };
const pokerShape = (th, w = 1.2) => {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, 0); sh.lineTo(w, th); sh.lineTo(0, th); sh.closePath();
  if (th <= .34) { const nH = th <= .26 ? 6 : 5, r = th * (nH === 6 ? .28 : .3); for (let i = 0; i < nH; i++) { const p = new THREE.Path(); p.absarc(w / (nH * 2) + i * w / nH, th / 2, r, 0, Math.PI * 2, true); sh.holes.push(p); } }
  else { const nH = 4, hw = th <= .42 ? .2 : .17, hh = th - (th <= .42 ? .13 : .12); for (let i = 0; i < nH; i++) sh.holes.push(rrPath(w / (nH * 2) + i * w / nH, th / 2, hw, hh, hw * (th <= .42 ? .45 : .5))); }
  return sh;
};
const piShape = th => poly([[0, th], [2.5, th], [2.5, th - .12], [2.3, th - .12], [2.3, 0], [2.1, 0], [2.1, th - .12], [.4, th - .12], [.4, 0], [.2, 0], [.2, th - .12], [0, th - .12]]);
// Solman / Pluriman: piastre con nervature scatolari cave; fra le piastre lamiera grecata collaborante
function boxRibGeoms(th, ribs, wBox, wFl, len) {
  const fl = .1, hb = th - fl, out = [];
  ribs.forEach(cz => {
    const sh = new THREE.Shape(); sh.moveTo(cz - wBox / 2, 0); sh.lineTo(cz + wBox / 2, 0); sh.lineTo(cz + wBox / 2, hb); sh.lineTo(cz - wBox / 2, hb); sh.closePath();
    sh.holes.push(rrPath(cz, hb / 2, wBox - .2, hb - .18, .04)); out.push([extrudeXGeo(sh, len), 0]);
    const f = new THREE.BoxGeometry(len, fl, wFl); f.translate(0, hb + fl / 2, cz); out.push([f, 1]);
  });
  return out;
}
function buildSolai(ox) {
  const m = new Model(ox); m.stage(24);
  m.g.userData.center = V3(0, 1.5, 0);
  m.still(box(22, .3, 17, M.concreteD, 0, -.15, 0));
  const len = 10, y0 = 1.1, up = V3(0, 18, 0), Z = { pk: -6.4, pi: -3.1, so: -.2, pl: 2.9 };
  for (const x of [-len / 2 + 1, len / 2 - 1]) m.add(box(.9, y0, 17, M.concrete, x, y0 / 2, 0), 0, V3(0, 16, 0));
  const shade = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
  // Poker: due lastre affiancate larghe 1,20 m (2,40 m in tutto, per confronto con gli elementi da 2,50 m)
  const pk = [0].map(k => { const e = extrudeX(pokerShape(.32), len, M.concrete); e.position.set(0, y0, Z.pk + k * 1.2); m.add(e, .2 + k * .05, up); return e; });
  const pi = extrudeX(piShape(.6), len, M.concrete); pi.position.set(0, y0, Z.pi); m.add(pi, .45, up);
  const mkBox = (zc, ribs, wBox, wFl) => { const g = new THREE.Group(); g.position.set(0, y0, zc); m.add(g, .6, up); const lam = []; g.userData = { ribs, wBox, wFl }; return g; };
  const so = mkBox(Z.so, [.42, 2.08], .62, .84), pl = mkBox(Z.pl, [.38, 1.25, 2.12], .42, .76);
  const fill = (g, th) => {
    while (g.children.length) { const c = g.children.pop(); c.geometry && c.geometry.dispose(); }
    const { ribs, wBox, wFl } = g.userData, parts = boxRibGeoms(th, ribs, wBox, wFl, len);
    parts.forEach(([geo]) => { const mesh = new THREE.Mesh(geo, M.concrete); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); });
    // lamiera grecata fra le piastre
    const hb = th - .1, edges = [0, ...ribs.flatMap(c => [c - wFl / 2, c + wFl / 2]), 2.5];
    for (let k = 0; k < edges.length; k += 2) { const a = edges[k], b2 = edges[k + 1]; if (b2 - a > .06) { const l = new THREE.Mesh(new THREE.BoxGeometry(len - .1, .035, b2 - a - .02), M.lam); l.position.set(0, hb + .05, (a + b2) / 2); l.receiveShadow = true; g.add(l); } }
  };
  fill(so, .75); fill(pl, .75);
  m.setPoker = th => { pk.forEach(e => { e.geometry.dispose(); e.geometry = extrudeXGeo(pokerShape(th), len); }); };
  m.setPi = th => { pi.geometry.dispose(); pi.geometry = extrudeXGeo(piShape(th), len); };
  m.setSolman = th => fill(so, th); m.setPluriman = th => fill(pl, th);
  m.widths = () => { const w = o => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); return Math.round((b.max.z - b.min.z) * 100); }; return [w(pk[0]), w(pi), w(so), w(pl)]; };
  // profilo in sezione dell'elemento, in alto nello spazio, mostrato in un riquadro a parte
  const prof = new THREE.Group(); prof.position.set(0, 120, 0); m.g.add(prof); m.prof = prof;
  m.setProfile = (idx, th) => {
    while (prof.children.length) { const c = prof.children.pop(); c.traverse(o => o.geometry && o.geometry.dispose()); }
    const grp = new THREE.Group(), LEN = 1.2;
    const add = (geo, mat) => { const me = new THREE.Mesh(geo, mat || M.concrete); me.castShadow = me.receiveShadow = true; grp.add(me); return me; };
    if (idx === 0) add(extrudeXGeo(pokerShape(th), LEN));
    else if (idx === 1) add(extrudeXGeo(piShape(th), LEN));
    else {
      const cfg = idx === 2 ? { ribs: [.42, 2.08], wBox: .62, wFl: .84 } : { ribs: [.38, 1.25, 2.12], wBox: .42, wFl: .76 };
      boxRibGeoms(th, cfg.ribs, cfg.wBox, cfg.wFl, LEN).forEach(([g]) => add(g));
      const hb = th - .1, edges = [0, ...cfg.ribs.flatMap(c => [c - cfg.wFl / 2, c + cfg.wFl / 2]), 2.5];
      for (let k = 0; k < edges.length; k += 2) { const a = edges[k], b2 = edges[k + 1]; if (b2 - a > .06) { const l = add(new THREE.BoxGeometry(LEN - .06, .035, b2 - a - .02), M.lam); l.position.set(0, hb + .05, (a + b2) / 2); } }
    }
    const bb = new THREE.Box3().setFromObject(grp), c = bb.getCenter(V3()); grp.position.set(-c.x, -c.y, -c.z); prof.add(grp);
    prof.userData.r = bb.getSize(V3()).length() / 2;
  };
  m.Z = Z;
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
  const beam = box(15.6, .9, 5.8, M.concrete, 7.8, 0, 0); beam.castShadow = true; pivot.add(beam);
  const slab = box(15.6, .25, 6.6, M.concreteD, 7.8, .55, 0); slab.castShadow = true; pivot.add(slab);
  const seatR = new THREE.Group(); m.g.add(seatR);
  const rigid = box(1.1, .12, 4.8, M.steel, 0, 0, 0); const bolt = [-1.8, 1.8].map(z => { const b = box(.18, .5, .18, M.steel, 0, .2, z); seatR.add(b); return b; });
  // Jawfix: dissipatori assiali rossi, due coppie per lato del pilastro; i capi seguono trave e pilastro
  const RED = new THREE.MeshStandardMaterial({ color: 0xd14a40, roughness: .45, metalness: .25 }), TEAL = new THREE.MeshStandardMaterial({ color: 0x86bfc3, roughness: .5, metalness: .4 }), CLAMP = new THREE.MeshStandardMaterial({ color: 0x8c9fb4, roughness: .4, metalness: .7 });
  const jawStruts = [];
  for (const zc of [-2.5, 2.5]) for (const sx of [-1, 1]) for (const dz of [-.22, .22]) {
    const g = new THREE.Group(); const bar = box(.15, 1, .1, RED, 0, 0, 0); g.add(bar);
    const c1 = box(.26, .36, .16, CLAMP, 0, 0, 0), c2 = box(.26, .36, .16, CLAMP, 0, 0, 0); g.add(c1, c2);
    const tb = box(.6, .09, .34, TEAL, 0, 0, 0), bb = box(.1, .55, .34, TEAL, 0, 0, 0);
    m.g.add(g, tb, bb); g.traverse(o => o.isMesh && (o.castShadow = true));
    jawStruts.push({ g, bar, c1, c2, tb, bb, sx, zz: zc + dz });
  }
  seatR.add(rigid);
  // pannello di tamponamento sotto la trave, nel filare dei pilastri; AllDrift tra trave e pannello (staffe a triangolo, asta, cerniera rossa, piastra asolata)
  const panelG = new THREE.Group(); m.g.add(panelG);
  const PH = 5.0, PW = 5.2, PX = 3.0, ZP = 2.5, panelMat = new THREE.MeshStandardMaterial({ color: 0xdcdad4, roughness: .85, bumpMap: bump, bumpScale: .4 });
  const pg = new THREE.BoxGeometry(PW, PH, .26); pg.translate(PX, PH / 2, 0);
  const panel = new THREE.Mesh(pg, panelMat); panel.castShadow = panel.receiveShadow = true; panel.matrixAutoUpdate = false; panelG.add(panel);
  const structG = new THREE.Group(); pivot.add(structG);          // solidale alla trave: cade con lei
  const YB = -.45, DX = PX + .4, STEEL = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: .3, metalness: .55 });
  const hexG = new THREE.CylinderGeometry(.075, .075, .07, 6), pinG = new THREE.CylinderGeometry(.06, .06, .1, 14);
  const addBolt = (par, x, y, z, rot) => { const g = new THREE.Group(); g.position.set(x, y, z); if (rot) g.rotation.set(...rot); const h = new THREE.Mesh(hexG, STEEL); const st = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .14, 10), STEEL); st.position.y = -.05; g.add(h, st); par.add(g); g.traverse(o => o.isMesh && (o.castShadow = true)); return g; };
  // due supporti a cuneo sotto la trave: piastra di base e due fianchi triangolari che reggono l'asta
  for (const sx of [-1, 1]) {
    const bx = DX + sx * .95, br = new THREE.Group(); br.position.set(bx, YB, ZP); structG.add(br);
    br.add(box(.7, .05, .62, STEEL, 0, -.025, 0));
    const tri = new THREE.Shape(); tri.moveTo(-.31, 0); tri.lineTo(.31, 0); tri.lineTo(.1, -.55); tri.lineTo(-.1, -.55); tri.closePath();
    for (const dx of [-.2, .2]) { const gp = new THREE.ExtrudeGeometry(tri, { depth: .05, bevelEnabled: false }); gp.rotateY(Math.PI / 2); gp.translate(dx - .025, 0, 0); const fm = new THREE.Mesh(gp, STEEL); fm.castShadow = true; br.add(fm); }
    addBolt(br, sx * .26, -.5, 0, [0, 0, -sx * Math.PI / 2]);
    for (const dz of [-.22, .22]) addBolt(br, dx0(sx), -.06, dz, [Math.PI, 0, 0]);
  }
  function dx0(sx) { return sx * .0; }
  const swing = new THREE.Group(); swing.position.set(DX - .1, 0, ZP); structG.add(swing);   
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 2.5, 20), STEEL); rod.rotation.z = Math.PI / 2; rod.position.set(.1, YB - .5, 0); rod.castShadow = true; swing.add(rod);
  // carrello sul bordo del pannello: piastra a osso con asole e bulloni
  const plateG = new THREE.Group(); m.g.add(plateG);
  // cuscinetto a occhiello rosso: fisso sul bordo del pannello; l'asta d'acciaio scorre al suo interno
  const PYW = H + .87, ryw = PYW + YB - .5;
  const brg = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .34, 24), STEEL); brg.rotation.z = Math.PI / 2; brg.position.set(0, ryw, ZP); plateG.add(brg);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(.24, .07, 12, 28), RED); eye.position.set(0, ryw, ZP); eye.rotation.y = Math.PI / 2; plateG.add(eye);   // occhiello rosso attorno all'asta
  plateG.add(box(.34, .5, .5, RED, 0, ryw - .3, ZP));
  for (const dz of [-.26, .26]) plateG.add(box(.44, .12, .06, RED, 0, ryw + .02, ZP + dz));
  addBolt(plateG, .22, ryw - .36, ZP + .26, [Math.PI / 2, 0, 0]); addBolt(plateG, -.2, ryw - .2, ZP - .26, [-Math.PI / 2, 0, 0]);
  const pinS = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .5, 14), STEEL); pinS.position.set(0, ryw - .75, ZP); plateG.add(pinS);

  const slotM = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: .9 });
  const pl1 = box(3.0, .06, .5, STEEL, 0, PH + .03, ZP); plateG.add(pl1);
  const pl2 = box(2.7, .06, .3, STEEL, 0, PH + .09, ZP); plateG.add(pl2);
  for (const sx of [-.8, .8]) plateG.add(box(1.0, .062, .1, slotM, sx, PH + .121, ZP));
  for (const sx of [-1.3, -.45, .45, 1.3]) for (const dz of [-.17, .17]) { const bb = addBolt(plateG, sx, PH + .17, ZP + dz, null); bb.scale.setScalar(.8); }
  plateG.traverse(o => o.isMesh && (o.castShadow = true));
  const padRigid = box(.3, .5, .3, STEEL, 0, PH + .25, ZP); padRigid.visible = false; m.g.add(padRigid);
  const capL = [-2.5, 2.5].map(z => { const c = box(1.3, .25, 1.2, M.concreteD, 0, 0, z); m.g.add(c); return c; });
  const capR = [-2.5, 2.5].map(z => { const c = box(1.8, .25, 1.4, M.concreteD, 0, 0, z); m.g.add(c); return c; });
  const S = {
    t: -1, jaw: false, all: false, pfail: false, pfall: 0, pfv: 0, ppeak: 0, pd: 0, I: 5.5, xg: 0, vg: 0, uL: 0, vL: 0, uR: 0, vR: 0, failed: false, fall: 0, fv: 0, peak: 0, running: false, d: 0,
  };
  const VX = 5, capB = () => S.jaw ? .38 : .10, capP = () => S.all ? .38 : .10;
  const ag = t => {
    if (t < 0) return 0;
    const env = Math.min(1, t / .6) * Math.exp(-Math.max(0, t - 3.4) / 1.1);
    return env * (.6 * Math.sin(2 * Math.PI * .95 * t) + .5 * Math.sin(2 * Math.PI * 1.8 * t + 1.3) + .4 * Math.sin(2 * Math.PI * 3.1 * t + 2.1) + .3 * Math.sin(2 * Math.PI * 4.6 * t + .4));
  };
  const reset = () => { Object.assign(S, { t: -1, xg: 0, vg: 0, uL: 0, vL: 0, uR: 0, vR: 0, failed: false, fall: 0, fv: 0, peak: 0, running: false, d: 0, pfail: false, pfall: 0, pfv: 0, ppeak: 0, pd: 0 }); beam.material = M.concrete; panelMat.emissive.setHex(0); panelMat.emissiveIntensity = 0; };
  S.reset = reset; S.start = () => { reset(); S.t = 0; S.running = true; };
  const wL = 2 * Math.PI * 1.0, wR = 2 * Math.PI * 2.4, z = .07;
  S.demo = false; S.dt = 0;
  S.step = dt => {
    if (S.demo) { S.dt += dt; S.xg = 0; S.uL = .1 * Math.sin(S.dt * 1.6); S.uR = -.03 * Math.sin(S.dt * 1.6); S.failed = false; S.pfail = false; S.fall = 0; S.pfall = 0; S.peak = 0; S.ppeak = 0; return; }
    const sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (S.t >= 0 && S.running) S.t += h;
      const a = S.I * .45 * ag(S.t);
      S.vg += (a - 2 * .7 * 1.57 * S.vg - 1.57 * 1.57 * S.xg) * h; S.xg += S.vg * h;
      S.vL += (-a - 2 * z * wL * S.vL - wL * wL * S.uL) * h; S.uL += S.vL * h;
      S.vR += (-a - 2 * z * wR * S.vR - wR * wR * S.uR) * h; S.uR += S.vR * h;
      if (!S.pfail) { const pd = Math.abs(S.uL); S.ppeak = Math.max(S.ppeak, pd); S.pd = pd; if (pd > capP()) { S.pfail = true; S.pfv = 0; panelMat.emissive.setHex(0xff2200); panelMat.emissiveIntensity = .6; } }
      if (!S.failed) {
        const d = Math.abs(S.uL - S.uR); S.peak = Math.max(S.peak, d); S.d = d;
        if (d > capB()) { S.failed = true; S.fv = 0; beam.material = new THREE.MeshStandardMaterial({ color: 0xd3d0c9, roughness: .9, emissive: 0xff2200, emissiveIntensity: .8 }); }
      }
    }
    if (S.t > 9) S.running = false;
    if (S.failed) { S.fv += 9.8 * .35 * dt; S.fall = Math.min(.55, S.fall + S.fv * dt); }
    if (S.pfail) { S.pfv += 9.8 * .3 * dt; S.pfall = Math.min(1.1, S.pfall + S.pfv * dt); }
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
    const rg = !S.jaw;
    rigid.visible = false; bolt.forEach(b => b.visible = false);
    const th = pivot.rotation.z, cth = Math.cos(th), sth = Math.sin(th);
    jawStruts.forEach(o => {
      o.g.visible = o.tb.visible = o.bb.visible = S.jaw; if (!S.jaw) return;
      const lx = 12.4 + o.sx * 1.5, ly = -.45;                                    // attacco alla trave (riferimento della trave)
      const tx = pivot.position.x + lx * cth - ly * sth, ty = pivot.position.y + lx * sth + ly * cth;
      const bx = seatR.position.x + o.sx * .72, by = seatR.position.y - 1.55;       // attacco alla faccia del pilastro
      const dx = bx - tx, dy = by - ty, L = Math.hypot(dx, dy), ang = Math.atan2(dx, -dy);
      o.g.position.set((tx + bx) / 2, (ty + by) / 2, o.zz); o.g.rotation.z = ang;
      o.bar.scale.y = Math.max(.1, L - .5); o.c1.position.y = L / 2 - .3; o.c2.position.y = -L / 2 + .3;
      o.tb.position.set(tx, ty - .04, o.zz); o.tb.rotation.z = pivot.rotation.z; o.bb.position.set(bx - o.sx * .05, by + .02, o.zz);
    });
    // pannello: ancorato in basso al terreno; in testa segue la struttura (rigido) o scorre (AllDrift)
    panelG.position.set(-X + xg, 0, ZP); panelG.rotation.x = S.pfall;
    const k = S.all ? 0 : uL / H;
    panel.matrix.set(1, k, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); panel.matrixWorldNeedsUpdate = true;
    const topX = -X + xg + PX + (S.all ? 0 : k * PH);
    plateG.position.set(topX, 0, 0); padRigid.position.set(topX, 0, 0);
    plateG.visible = !S.pfail && S.all; padRigid.visible = false; structG.visible = S.all;
  };
  S.cap = () => capB(); S.capP = () => capP();
  m.seis = S;
  return m;
}

/* ---------- Manini Connect ---------- */
function buildConnect(ox) {
  const m = new Model(ox); m.stage(30, 7, 0);
  m.g.userData.center = V3(7, 6, 0);
  m.still(box(34, .3, 20, M.concreteD, 6, -.15, 0));
  const H = 9;
  const sway = new THREE.Group(); m.g.add(sway);
  const pill = box(1.2, H, 1.2, M.xray, 0, H / 2, 0); pill.userData.ns = true; pill.renderOrder = 2; m.add(pill, 0, V3(0, 16, 0), sway);
  for (const [x, z] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) m.add(box(.07, H - .1, .07, M.rebar, x, H / 2, z), .1, V3(0, 16, 0), sway);
  m.add(box(5.5, .9, 1.0, M.concrete, 2.7, H + .45, 0), .3, V3(0, 14, 0), sway);
  m.add(box(8, .3, 8, M.concreteD, 3.2, H + 1.05, 0), .4, V3(0, 14, 0), sway);
  const tbox = box(1.1, .8, .8, M.steel, 1.2, H + 1.6, 0); m.add(tbox, .55, V3(0, 14, 0), sway);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 8), M.steel); ant.position.set(1.2, H + 2.7, 0); m.add(ant, .6, V3(0, 14, 0), sway);
  const sensors = [1.2, 3.2, 5.2, 7.2, 8.6].map((y, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), M.glow.clone()); s.position.set(0, y, 0); s.userData.ns = true; m.add(s, .2 + i * .02, V3(0, 14, 0), sway); return s; });
  // cloud + control room
  const cloud = new THREE.Group(); cloud.position.set(9, 15, -3);
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, transparent: true, opacity: .85 });
  [[0, 0, 0, 1.6], [1.5, -.2, .2, 1.2], [-1.4, -.3, 0, 1.1], [.4, .5, .3, 1.1]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), cm); s.position.set(x, y, z); s.castShadow = false; cloud.add(s); });
  m.g.add(cloud);
  const room = box(10, 5, 6, M.concrete, 13, 2.5, 4); m.add(room, .7, V3(30, 0, 0));
  // logo Manini in rilievo sul lato verticale (faccia verso -x)
  {
    const bands = [[0, 75, 47, 32], [84, 159, 32, 32], [168, 243, 32, 32], [252, 327, 32, 16]], shp = [];
    for (const [yt, yb, dt, db] of bands) {
      const x0 = 17, x1 = 383, xl = 140, xr = 260, xm = 200, P = [[x0, yt], [xl, yt], [xm, yt + dt], [xr, yt], [x1, yt], [x1, yb], [xr, yb], [xm, yb + db], [xl, yb], [x0, yb]];
      const sh = new THREE.Shape(); P.forEach(([x, y], i) => i ? sh.lineTo(x, -y) : sh.moveTo(x, -y)); sh.closePath(); shp.push(sh);
    }
    const lg = new THREE.ExtrudeGeometry(shp, { depth: .16, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 1 });
    lg.center(); lg.scale(.0092, .0092, 1); lg.rotateY(-Math.PI / 2);
    const mark = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: .75, bumpMap: bump, bumpScale: .3 }));
    mark.position.set(13 - 5 - .08, 2.6, 4); m.add(mark, .85, V3(30, 0, 0));
  }
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const cg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.725), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(13, 2.6, 7.03); m.g.add(screen);
  // path for packets
  const path = [V3(0, 1.2, 0), V3(0, H + .3, 0), V3(1.2, H + 1.7, 0), V3(5, 12.5, -1.5), V3(9, 15, -3), V3(11, 9, 0), V3(13, 3.8, 7)];
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', .4);
  const NPk = 30, packets = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fc0ff }), NPk);
  packets.frustumCulled = false; m.g.add(packets);
  // weather + quake effects
  const NR = 360, rainPos = new Float32Array(NR * 6), rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainPts = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0 }));
  rainPts.frustumCulled = false; m.g.add(rainPts);
  const rs = Array.from({ length: NR }, () => ({ x: -7 + Math.random() * 26, z: -9 + Math.random() * 18, y: Math.random() * 24, v: 14 + Math.random() * 8 }));
  const NW = 70, windPos = new Float32Array(NW * 6), windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
  const windL = new THREE.LineSegments(windGeo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0 }));
  windL.frustumCulled = false; m.g.add(windL);
  const ws = Array.from({ length: NW }, () => ({ x: -12 + Math.random() * 44, y: 1 + Math.random() * 17, z: -9 + Math.random() * 18, l: 2 + Math.random() * 4, v: 26 + Math.random() * 14 }));
  const flashL = new THREE.PointLight(0x9fc4ff, 0, 70, 1.2); flashL.position.set(9, 14, -3); m.g.add(flashL);
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
    // physical effects of the event
    const fx = C.ev && el < 7 ? Math.min(1, el / .8) * Math.exp(-Math.max(0, el - 3.5) / 1.4) : 0;
    const isRain = C.ev === 'rain', isWind = C.ev === 'wind', isQuake = C.ev === 'quake';
    sway.rotation.z = isWind ? fx * .03 * (Math.sin(el * 2.4) + .6 * Math.sin(el * 5.3)) : isQuake ? fx * .022 * Math.sin(el * 19) : 0;
    const shk = isQuake ? fx * .22 * Math.sin(el * 33) : 0;
    m.g.position.set(m.origin.x + shk, 0, m.origin.z + (isQuake ? fx * .12 * Math.cos(el * 27) : 0));
    rainPts.material.opacity = isRain ? Math.min(1, fx * 1.4) : 0; rainPts.visible = isRain && fx > .01;
    if (rainPts.visible) { rs.forEach((r, i) => { r.y -= r.v * dt; if (r.y < 0) { r.y = 22 + Math.random() * 4; r.x = -7 + Math.random() * 26; r.z = -9 + Math.random() * 18; } rainPos.set([r.x, r.y, r.z, r.x, r.y + 1.3, r.z], i * 6); }); rainGeo.attributes.position.needsUpdate = true; }
    C.flash = Math.max(0, C.flash - dt * 5); if (isRain && fx > .3 && Math.random() < dt * 1.1) C.flash = 1;
    flashL.intensity = C.flash * 6000; cm.emissive.setHex(0xbfd8ff); cm.emissiveIntensity = C.flash * 1.4;
    cm.color.setRGB(1 - (isRain ? .55 * Math.min(1, fx * 1.5) : 0), 1 - (isRain ? .5 * Math.min(1, fx * 1.5) : 0), 1 - (isRain ? .35 * Math.min(1, fx * 1.5) : 0));
    windL.material.opacity = isWind ? .55 * Math.min(1, fx * 1.5) : 0; windL.visible = isWind && fx > .01;
    if (windL.visible) { ws.forEach((w, i) => { w.x += w.v * dt * (.4 + fx); if (w.x > 32) { w.x = -12; w.y = 1 + Math.random() * 17; w.z = -9 + Math.random() * 18; } windPos.set([w.x, w.y, w.z, w.x - w.l, w.y, w.z], i * 6); }); windGeo.attributes.position.needsUpdate = true; }
    cloud.position.x = 9 + (isWind ? fx * 2 : 0);
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
const CF = { x: 2, z: 3, h: 9, roof: 'shed' };
const cfgOpts = () => {
  const o = { rows: Array.from({ length: CF.x + 1 }, (_, i) => i * 20), nz: CF.z, colH: CF.h, walls: true };
  if (CF.roof === 'pv') o.pv = true;
  if (CF.roof === 'curve') o.cap = 'curve';
  if (CF.roof === 'new') { o.omega = true; o.rows = Array.from({ length: CF.x + 1 }, (_, i) => i * 26); }
  if (CF.roof === 'flat') { o.flat = true; o.roofKinds = ['pv', 'green']; }
  if (CF.roof === 'tau' || CF.roof === 'plan') o.roof = CF.roof;
  return o;
};
const mOndal = buildOndal(0, { rows: [0, 20, 40], nz: 3, colH: 9, R: 44, cap: 'both' });
const mOndalP = buildOndal(0, { rows: [0, 32], nz: 2, colH: 10.5, walls: false, R: 38 });
const mOndalN = buildOndal(0, { rows: [0, 26], nz: 3, colH: 8.5, omega: true, walls: false, R: 40, cap: 'shed' });
const mTau = buildTau(0);
const mPlan = buildPlan(0);
const mSolai = buildSolai(0);
let mCfg = buildOndal(STEP * 1, cfgOpts());
const mSeis = buildSeismic(STEP * 2);
const mConn = buildConnect(STEP * 3);
const mGreen = buildOndal(STEP * 4, { rows: [0, 18, 36], nz: 4, colH: 8, walls: false, flat: true, roofKinds: ['pv', 'green'], R: 40 });
const models = [mOndal, mOndalP, mOndalN, mTau, mPlan, mSolai, mCfg, mSeis, mConn, mGreen];

/* ---------- label texts (click to expand) ---------- */
const INFO = {
  'Shed vetrato · luce naturale': 'Il vetro dello shed porta luce naturale dentro il capannone, con meno illuminazione artificiale. Lo shed e il tetto piano possono convivere sullo stesso tetto.',
  'Tegoli · interasse 5,00–7,50 m': 'Il tegolo alare, a V, è l’elemento di base: poggia sui pilastri e la cappella, curva o shed, copre lo spazio tra due tegoli. Ondal è la prima copertura con tegoli alari in cemento armato.',
  'Pilastri prefabbricati': 'Pilastri in c.a. prodotti in stabilimento e montati in cantiere. Possono integrare già in produzione i sensori di Manini Connect.',
  'Luce fino a 32 m': 'Ondal+ porta il tegolo fino a 32 m tra i pilastri: meno pilastri, meno plinti, più superficie utile in pianta.',
  'Maglia 25 × 25 m e oltre': 'Maglie di pilastri di 25 × 25 m, anche maggiori nei casi speciali, con ancoraggi sismici pensati per le grandi maglie.',
  'Estradosso parabolico': 'La parte superiore curva, larga 80–120 cm, favorisce il deflusso dell’acqua e un’impermeabilizzazione ottimale.',
  'Intradosso piano': 'Il lato inferiore è rettilineo: permette controsoffitti piani, finiture interne varie e impianti sopra il controsoffitto.',
  'Deflusso dell’acqua': 'Luci da 12 a 32 m. TAU unisce i vantaggi di una copertura piana e di una a doppia pendenza.',
  'Incastro trave a T': 'La trave secondaria a T si appoggia sulla trave principale precompressa. Dettaglio schematico di un collegamento tipico: appoggio, spinotti e sigillatura.',
  'Appoggio in neoprene': 'Un cuscinetto elastomerico distribuisce il carico e lascia piccoli movimenti dovuti a dilatazioni e deformazioni. Dettaglio tipico, non un disegno esecutivo Manini.',
  'Spinotti in acciaio': 'Barre in acciaio attraversano l’appoggio e collegano le travi, impedendo lo scorrimento. Dettaglio schematico.',
  'Trave Super-Omega': 'Progettata per realizzare grandi maglie strutturali, ha una sezione che permette di installare carroponti, eliminando le vie di corsa e riducendo l’ingombro degli impianti. Prevede fissaggi antisismici particolari.',
  'Tegoli su appoggi bassi': 'I tegoli si appoggiano alla base della trave Super-Omega, non sopra: si ottimizza l’altezza interna. Ondal New si fornisce con lucernari a raso o con infissi shed.',
  'Fondazioni più piccole': 'Il peso più contenuto della copertura Ondal New riduce le dimensioni delle fondazioni.',
  'Pilastro': 'Pilastro prefabbricato in c.a.: la base di Manini Plan per edifici industriali, espositivi e commerciali.',
  'Trave principale precompressa': 'Trave principale in cemento armato precompresso: i trefoli tesi in fabbrica la rendono più snella e resistente a parità di sezione.',
  'Trave secondaria a T': 'Travi secondarie a sezione a T, anch’esse precompresse, appoggiate sulle travi principali.',
  'Manto isolante continuo': 'Un manto continuo di coibentazione e impermeabilizzazione, personalizzabile in base al livello di isolamento richiesto.',
  'Poker': 'Alveolare estruso, largo 120 cm, in 10 spessori da 20 a 50 cm: rigidità, resistenza al fuoco anche R120–R180, minimo spessore d’impalcato, intradosso piano. Possibili forature sulle lastre e mensole a scomparsa con il “Sistema Certificato Manini”.',
  'PI-Greco': 'Largo 250 cm, spessori da 40 a 80 cm. Forature grandi, lucernari a raso o shed. R120. Gli impianti passano tra le nervature e sono possibili travi porta-solaio di varie forme.',
  'Solman': 'Per grandi luci e forti sovraccarichi, con canale per gli impianti nell’intradosso. Altezze 60, 75 e 90 cm, larghezza 250 cm. Lamiera grecata sotto la soletta armata.',
  'Pluriman': 'Intradosso piano con meno giunti e, in alcuni casi, resistenza al fuoco superiore a R180. Altezze 60, 75 e 90 cm, larghezza 250 cm. Lamiera grecata sotto la soletta armata.',
  'Jawfix®': 'Dissipatore assiale brevettato sulla connessione trave-pilastro: evita il ribaltamento fuori piano e lo sfilamento della trave. Certificato UNI EN 15129 (2022), validato dal laboratorio Eucentre di Pavia. Ancoranti Hilti.',
  'AllDrift®': 'Connessione scorrevole tra pannello di tamponamento e struttura: blocchi in PTFE, snodi a cerniera, ganasce e molle a tazza. Struttura e pannelli si muovono in modo indipendente. Nei test Manini con la Vibrodina ha disaccoppiato spostamenti differenziali oltre 20 cm.',
  'Sensori nel pilastro': 'Sensori di ultima generazione integrati nei pilastri durante la produzione: rilevano anomalie statiche e dinamiche dei carichi.',
  'Trasmettitore sul tetto': 'Una scatola di trasmissione sul tetto raccoglie i dati dei sensori e li invia al cloud.',
  'Cloud': 'I dati arrivano in tempo reale. Gli algoritmi segnalano subito le anomalie e inviano avvisi o allarmi dopo sisma, bombe d’acqua o vento eccezionale.',
  'Control Room': 'La Control Room Manini riceve segnali e anomalie. Il sistema è brevettato e ha vinto il premio IoT ai Digital360 Awards 2018.',
  'Fotovoltaico senza forare il manto': 'Il telaio dei pannelli si fissa senza forare l’impermeabilizzazione. Con Ondal Powershed® il fotovoltaico è integrato in gusci in cemento.',
  'Ondal Powershed®': 'Guscio in cemento con pannelli fotovoltaici su un telaio metallico intermedio. I collegamenti elettrici tra gusci si fanno in opera, senza lavorare in quota.',
  'Tetto verde · deflusso −70%': 'Un tetto verde può ridurre fino al 70% il deflusso delle acque piovane, abbassa i costi di riscaldamento e raffrescamento, filtra le polveri sottili e riduce l’isola di calore.',
};
const labelHost = $('#labels');
const closeTags = () => labelHost.querySelectorAll('.tag.open').forEach(x => x.classList.remove('open'));
document.addEventListener('click', closeTags);
function mkLabel(p, t) {
  const info = INFO[t], el = document.createElement('div'); el.className = 'tag';
  el.innerHTML = `<b>${t}</b>` + (info ? `<i>+</i><div class="body">${info}</div>` : '');
  labelHost.appendChild(el);
  if (info) el.addEventListener('click', e => { e.stopPropagation(); const was = el.classList.contains('open'); closeTags(); if (!was) el.classList.add('open'); });
  return { p, t, el };
}

/* ---------- beats (camera + labels) ---------- */
const O = m => m.origin;
const B = (m, c, d, az, el, labels = []) => ({ m, c: O(m).clone().add(c), d, az, el, labels: labels.map(([p, t]) => mkLabel(O(m).clone().add(V3(...p)), t)) });
const SYS = {
  ondal: B(mOndal, V3(24, 8.5, 9), 58, -62, 11, [[[12, 10.3, 15], 'Shed vetrato · luce naturale'], [[30, 9.2, 7.5], 'Tegoli · interasse 5,00–7,50 m'], [[0, 5, 22.5], 'Pilastri prefabbricati']]),
  ondalp: B(mOndalP, V3(16, 6, 7.5), 74, -34, 18, [[[16, 11.6, 0], 'Luce fino a 32 m'], [[32, 5, 15], 'Maglia 25 × 25 m e oltre']]),
  ondaln: B(mOndalN, V3(12, 9.5, 11), 66, -40, 16, [[[0, 11.4, 11], 'Trave Super-Omega'], [[12, 10.4, 7.5], 'Tegoli su appoggi bassi'], [[24, 6, 0], 'Fondazioni più piccole']]),
  tau: B(mTau, V3(0, 6.5, 0), 54, -30, 14, [[[0, 8.9, -7.5], 'Estradosso parabolico'], [[0, 7.0, 7.5], 'Intradosso piano'], [[12, 9, 2.5], 'Deflusso dell’acqua']]),
  plan: B(mPlan, V3(0, 7.5, 0), 48, -42, 22, [[[-9, 4, 6], 'Pilastro'], [[9, 9.6, 0], 'Trave principale precompressa'], [[0, 11.2, -2.4], 'Trave secondaria a T'], [[-5, 11.2, 6], 'Manto isolante continuo']]),
  solai: B(mSolai, V3(5, 1.6, -5.8), 17, 70, 16, [[[5, 1.5, -5.8], 'Poker'], [[5, 1.8, -1.9], 'PI-Greco'], [[5, 1.9, 1.1], 'Solman'], [[5, 1.9, 4.2], 'Pluriman']]),
};
const SYSM = { ondal: mOndal, ondalp: mOndalP, ondaln: mOndalN, tau: mTau, plan: mPlan, solai: mSolai };
let sysSel = 'ondal';
const beats = [
  B(mOndal, V3(14, 4.5, 11), 108, -36, 21),
  SYS.ondal,
  B(mCfg, V3(20, 5, 11), 80, -36, 22),
  B(mSeis, V3(0, 4.5, 0), 44, -14, 10, [[[5.0, 3.9, 2.8], 'Jawfix®'], [[-3, 3.6, 2.9], 'AllDrift®']]),
  B(mConn, V3(10.5, 6.5, 2), 50, -26, 12, [[[0, 9.4, 0], 'Sensori nel pilastro'], [[1.2, 11.9, 0], 'Trasmettitore sul tetto'], [[8, 16.8, -3], 'Cloud'], [[8.5, 8.6, 7], 'Control Room']]),
  B(mGreen, V3(18, 4, 15), 64, -40, 24, [[[9, 9.8, 4], 'Fotovoltaico senza forare il manto'], [[27, 9.2, 11], 'Tetto verde · deflusso −70%']]),
];
beats.forEach((b, i) => b.m.beat = i);
function selectSystem(k, instant) {
  if (!SYS[k]) return;
  Object.values(SYS).forEach(o => o.labels.forEach(l => l.el.classList.remove('on')));
  closeTags();
  const old = SYSM[sysSel]; sysSel = k; beats[1] = SYS[k];
  if (old !== SYSM[k]) { old.t = 0; old.target = 0; old.g.visible = false; SYSM[k].t = REDUCED ? 1 : 0; }
  document.querySelectorAll('#sysnav button').forEach(b => b.classList.toggle('on', b.dataset.sys === k));
  const nb = document.querySelector(`#sysnav button[data-sys="${k}"]`), nv = $('#sysnav'); if (nb && nv) nv.scrollTo({ left: nb.offsetLeft - nv.clientWidth / 2 + nb.clientWidth / 2, behavior: 'smooth' });
  document.querySelectorAll('.sysv').forEach(v => v.hidden = v.dataset.sys !== k);
  document.body.dataset.sys = k;
}
window.__selectSystem = selectSystem;

/* ---------- scroll mapping ---------- */
let anchors = [], vw = innerWidth, vh = innerHeight, ranges = [], secR = {};
function measure() {
  vw = innerWidth; vh = innerHeight;
  anchors = [...document.querySelectorAll('[data-beat]')].map(el => { const r = el.getBoundingClientRect(), top = r.top + scrollY, bot = r.bottom + scrollY; return el.classList.contains('tall') ? { i: +el.dataset.beat, y0: top + vh / 2, y1: Math.max(top + vh / 2, bot - vh / 2) } : { i: +el.dataset.beat, y0: top + r.height / 2, y1: top + r.height / 2 }; }).sort((a, b) => a.i - b.i);
  secR = {}; document.querySelectorAll('[data-beat]').forEach(el => { const r = el.getBoundingClientRect(); secR[+el.dataset.beat] = [r.top + scrollY, r.bottom + scrollY]; });
  ranges = [...document.querySelectorAll('.s3d')].map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; });
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix(); layoutView();
}
let offX = 0, offY = 0;
function layoutView() {
  const wide = vw > 900;
  offX = wide ? vw * .19 : 0; offY = wide ? 0 : -vh * .22;
  camera.setViewOffset(vw, vh, -offX, -offY, vw, vh);
}
function frac() {
  const sy = scrollY + vh / 2;
  if (!anchors.length) return 0;
  if (sy <= anchors[0].y0) return 0;
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k];
    if (sy <= a.y1) return a.i;
    const nx = anchors[k + 1]; if (!nx) return a.i;
    if (sy < nx.y0) return a.i + sm(clamp((sy - a.y1) / (nx.y0 - a.y1), 0, 1)) * (nx.i - a.i);
  }
  return anchors[anchors.length - 1].i;
}
addEventListener('resize', measure);
addEventListener('load', () => { measure(); setTimeout(measure, 600); });
document.fonts && document.fonts.ready.then(measure);
const inView = () => ranges.some(r => r[1] > scrollY - vh * .1 && r[0] < scrollY + vh * 1.1);
let mx = 0, my = 0;
addEventListener('pointermove', e => { mx = (e.clientX / vw - .5) * 2; my = (e.clientY / vh - .5) * 2; });
const fmt = (n, d = 0) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- UI: system selector + replay ---------- */
$('#sysnav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) selectSystem(b.dataset.sys); });
document.querySelectorAll('.replay').forEach(b => b.addEventListener('click', () => { SYSM[b.dataset.sys || sysSel].t = 0; }));

/* ---------- UI: Ondal sun (animated) + light shafts ---------- */
const sun = { play: true, h: 8 };
const sunVec = h => { const k = clamp((h - 7) / 12, 0, 1), az = lerp(-75, 75, k) * Math.PI / 180, el = (10 + 52 * Math.sin(Math.PI * k)) * Math.PI / 180; return { v: V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)), deg: el * 180 / Math.PI }; };
const fmtH = h => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${hh}:${String(mm).padStart(2, '0')}`; };
const snTs = [$('#snT'), $('#snT2')], snPs = [$('#snP'), $('#snP2')];
snTs.forEach(t => t.addEventListener('input', () => { sun.play = false; sun.h = +t.value; snPs.forEach(b => b.textContent = '▶'); }));
snPs.forEach(b => b.addEventListener('click', () => { sun.play = !sun.play; snPs.forEach(x => x.textContent = sun.play ? '⏸' : '▶'); }));
function sunUI(sv) {
  const curved = mOndal.hidden.has('shed');
  const direct = sv.deg > 14 ? (curved ? clamp(sv.v.y / .7, 0, 1) : clamp(sv.v.z / .5, 0, 1)) : 0, pct = Math.round(direct * 100);
  const txt = curved ? (direct > .05 ? `Sole a ${Math.round(sv.deg)}°: la luce entra dai lucernari a raso della cappella curva (${pct}%).` : `Sole a ${Math.round(sv.deg)}°: luce solo diffusa.`) : direct > .05 ? `Sole a ${Math.round(sv.deg)}°: la luce entra dalle vetrate dello shed (${pct}%).` : `Sole a ${Math.round(sv.deg)}°: luce solo diffusa dallo shed.`;
  for (const k of ['', '2']) { $('#snO' + k).textContent = fmtH(sun.h); $('#snM' + k).style.width = pct + '%'; $('#snS' + k).textContent = txt; }
}
// visible sun + arc
const sunTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(.18, 'rgba(255,225,150,.95)'); gr.addColorStop(.5, 'rgba(255,190,90,.25)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
sunSprite.scale.setScalar(34); scene.add(sunSprite);
const arcPts = []; for (let h = 7; h <= 19.01; h += .5) arcPts.push(sunVec(h).v.clone().multiplyScalar(100));
const sunArc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), new THREE.LineDashedMaterial({ color: 0xffd9a0, dashSize: 2.5, gapSize: 3, transparent: true, opacity: .35, fog: false }));
sunArc.computeLineDistances(); scene.add(sunArc);
// light shafts through the shed glazing
const makeShafts = m => m.glassStrips.map(g => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
  const col = new Float32Array(36); for (let q = 0; q < 3; q++) { const o = q * 12, a1 = .5, a2 = .08; [a1, a1, a2, a2].forEach((a, vi) => { col[o + vi * 3] = a; col[o + vi * 3 + 1] = a * .85; col[o + vi * 3 + 2] = a * .5; }); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false; mesh.visible = false; m.g.add(mesh); return { g, mesh };
});
const shaftsA = makeShafts(mOndal), shaftsB = makeShafts(mOndalP);
// raggi dai lucernari a raso della cappella curva: volumi dal rettangolo vetrato fino al pavimento
const shaftsC = (mOndal.skyH || []).map(r => {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
  const col = new Float32Array(24); for (let i = 0; i < 8; i++) { const a = i < 4 ? .55 : .08; col[i * 3] = a; col[i * 3 + 1] = a * .85; col[i * 3 + 2] = a * .5; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false; mesh.visible = false; mOndal.g.add(mesh); return { r, mesh };
});
function shaftsCUpdate(sv, w) {
  const on = w > .3 && sv.deg > 14;
  shaftsC.forEach(({ r, mesh }) => {
    mesh.visible = on; if (!on) return;
    const v = sv.v, t = r.y / v.y, dx = -v.x * t, dz = -v.z * t, P = mesh.geometry.attributes.position.array;
    const c = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
    c.forEach(([x, z], i) => { P.set([x, r.y, z], i * 3); P.set([x + dx, 0, z + dz], (i + 4) * 3); });
    mesh.geometry.attributes.position.needsUpdate = true; mesh.material.opacity = .22 * w;
  });
}
function shaftsUpdate(list, sv, w, x1) {
  const on = w > .3 && sv.deg > 14 && sv.v.z > .12;
  list.forEach(({ g, mesh }) => {
    mesh.visible = on; if (!on) return;
    const pos = mesh.geometry.attributes.position.array, v = sv.v, xa = g.x0, xb = x1 === undefined ? g.x1 : x1;
    const ys = [g.yb, (g.yb + g.yt) / 2, g.yt];
    ys.forEach((y, q) => {
      const t = Math.min(y / v.y, g.z / v.z), fz = g.z - v.z * t, fy = y - v.y * t;
      pos.set([xa, y, g.z, xb, y, g.z, xb, fy, fz, xa, fy, fz], q * 12);
    });
    mesh.geometry.attributes.position.needsUpdate = true; mesh.material.opacity = .2 * w;
  });
}
const F = { on: false, t: 0, R: 0 }, FN = 160;
const firePos = new Float32Array(FN * 3), fireGeo = new THREE.BufferGeometry();
fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
const firePts = new THREE.Points(fireGeo, new THREE.PointsMaterial({ color: 0xff7a1a, size: 1, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
firePts.frustumCulled = false; firePts.visible = false; mOndal.g.add(firePts);
const fireLight = new THREE.PointLight(0xff5a1a, 0, 45, 1.4); fireLight.position.set(20, 3, 11); mOndal.g.add(fireLight);
const fireSeed = Array.from({ length: FN }, () => ({ x: 8 + Math.random() * 24, z: 3 + Math.random() * 16, p: Math.random() }));
$('#fire').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('#fire').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  F.on = true; F.t = 0; F.R = +b.dataset.r;
});
function fireUpdate(dt) {
  const st = $('#fireS');
  if (F.on) {
    F.t += dt; const pr = clamp(F.t / 6, 0, 1);
    st.textContent = `Minuto ${Math.round(pr * F.R)} di ${F.R}: la copertura regge.`; st.className = 'status warn';
    if (pr >= 1) { F.on = false; st.textContent = `Prova superata: resistenza al fuoco R${F.R} (${F.R} minuti).`; st.className = 'status ok'; }
  }
  firePts.visible = F.on;
  fireLight.intensity = F.on ? 500 * (.75 + .25 * Math.random()) : 0;
  if (F.on) {
    fireSeed.forEach((f, i) => { const u = (f.p + time * .7) % 1; firePos[i * 3] = f.x + Math.sin(time * 5 + i) * .5; firePos[i * 3 + 1] = .3 + u * 6.5; firePos[i * 3 + 2] = f.z + Math.cos(time * 4 + i) * .5; });
    fireGeo.attributes.position.needsUpdate = true;
  }
}

/* ---------- UI: Ondal+ span ---------- */
$('#capT').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; $('#capT').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  const curve = b.dataset.c === 'curve'; mOndal.hidden[curve ? 'add' : 'delete']('shed'); mOndal.hidden[curve ? 'delete' : 'add']('curve');
  const lb = SYS.ondal.labels[0].el.querySelector('b'); lb.textContent = curve ? 'Cappella curva · lucernari a raso' : 'Shed vetrato · luce naturale';
});
const mgS = $('#mgS');
function mgUpdate() {
  const S2 = +mgS.value; mOndalP.setSpan(S2); $('#mgO').textContent = S2 + ' m';
  const cols = g => (Math.ceil(96 / g) + 1) * (Math.ceil(48 / 7.5) + 1), c = cols(S2), c0 = cols(12);
  $('#mgC').textContent = c; $('#mgD').textContent = c === c0 ? '0%' : '−' + Math.round((1 - c / c0) * 100) + '%';
  const nx = Math.ceil(96 / S2), nz = Math.ceil(48 / 7.5);
  $('#mgN').textContent = `Il modello mostra una campata. Capannone esempio 96 × 48 m: ${nx} ${nx === 1 ? 'campata' : 'campate'} da ${S2} m × ${nz} moduli da 7,5 m = ${nx + 1} × ${nz + 1} = ${c} pilastri. Conteggio geometrico.`;
  const ox = mOndalP.origin.x; SYS.ondalp.c.x = ox + S2 / 2; SYS.ondalp.labels[0].p.x = ox + S2 / 2; SYS.ondalp.labels[1].p.x = ox + S2; SYS.ondalp.labels[0].el.querySelector('b').textContent = S2 >= 32 ? 'Luce fino a 32 m' : `Luce ${S2} m`;
}
mgS.addEventListener('input', mgUpdate); mgUpdate();

/* ---------- UI: TAU rain ---------- */
const tuR = $('#tuR');
tuR.addEventListener('input', () => { const i = +tuR.value; mTau.rainN = Math.round(300 * i / 200) + 10; $('#tuO').textContent = i + ' mm/h'; $('#tuQ').textContent = fmt(i * 480 / 3600, 1) + ' L/s'; });
tuR.dispatchEvent(new Event('input'));
$('#tuCmp').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#tuCmp').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); const flat = b.dataset.f === '1'; mTau.setFlat(flat); mTau.pool = 0; $('#tuWhy').innerHTML = flat ? '<b>Tetto piano.</b> Nessuna pendenza: la pioggia si ferma, forma una pozza e carica la copertura. L’acqua ferma cerca ogni minima fessura.' : '<b>TAU.</b> L’estradosso parabolico, largo 80–120 cm, è una pendenza continua: ogni goccia scorre verso le due gronde. Nessun ristagno e impermeabilizzazione ottimale.'; });
setInterval(() => { const e = $('#tuPool'); if (e) e.textContent = mTau.flat ? Math.round(mTau.pool * 6 * 10) / 10 + ' cm' : '0 cm'; }, 250);
$('#tuPv').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on'); const on = b.classList.contains('on'); mTau.pv.target = on ? 1 : 0; $('#tuP').textContent = on ? `${mTau.pv.n} pannelli · ${fmt(mTau.pv.area * .2)} kWp` : '—'; });

/* ---------- UI: Plan explode + joint detail ---------- */
const plLabMain = SYS.plan.labels, PO = mPlan.origin;
const plLabDet = [[V3(-8.8, 10.7, 0), 'Incastro trave a T'], [V3(-8.6, 9.8, 0), 'Appoggio in neoprene'], [V3(-8.85, 9.35, 0), 'Spinotti in acciaio']].map(([p, t]) => mkLabel(PO.clone().add(p), t));
$('#plEx').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; $('#plEx').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  const x = +b.dataset.x, bt = SYS.plan;
  mPlan.exT = x === 1 ? 1 : 0; mPlan.ex2T = x === 2 ? 1 : 0; mPlan.det = x === 2; mPlan.detGroup.visible = x === 2;
  if (x === 0) { bt.d = 48; bt.az = -42; bt.el = 22; bt.c.copy(PO).add(V3(0, 7.5, 0)); }
  if (x === 1) { bt.d = 66; bt.az = -42; bt.el = 22; bt.c.copy(PO).add(V3(0, 13, 0)); }
  if (x === 2) { bt.d = 8.5; bt.az = -38; bt.el = 22; bt.c.copy(PO).add(V3(-8.8, 10, 0)); }
  bt.labelsOff = x === 1; bt.labels = x === 2 ? plLabDet : plLabMain;
  (x === 2 ? plLabMain : plLabDet).forEach(l => l.el.classList.remove('on'));
});

/* ---------- UI: Solai selector + thickness ---------- */
const SO = [
  { z: -5.8, t: '<b>Poker.</b> Alveolare estruso, largo 120 cm, in 10 spessori da 20 a 50 cm. Rigido, resistente al fuoco, con il minimo spessore d’impalcato e intradosso perfettamente piano. Il più usato nei pluripiano: commerciale, parcheggi, sociale, terziario avanzato.' },
  { z: -1.9, t: '<b>PI-Greco.</b> Uno dei solai industriali più classici: largo 250 cm, spessori da 40 a 80 cm. Facile fare forature di grandi dimensioni e prevedere lucernari a raso o shed. Si fornisce con resistenza al fuoco R120 e gli impianti passano tra le nervature.' },
  { z: 1.1, t: '<b>Solman.</b> Per grandi luci e forti sovraccarichi, largo 250 cm, con altezze di 60, 75 e 90 cm. L’intradosso è finito e un canale ospita gli impianti. Lastre metalliche reggono il getto della soletta armata. In genere R120.' },
  { z: 4.2, t: '<b>Pluriman.</b> Per carichi molto impegnativi, largo 250 cm, con altezze di 60, 75 e 90 cm. L’intradosso piano, con meno giunti, in alcune situazioni arriva a una resistenza al fuoco superiore a R180. È una delle ultime innovazioni della prefabbricazione.' },
];
const SOC = [
  { w: 120, min: 1, max: 10, step: 1, val: 4, th: v => .2 + (v - 1) * .3 / 9, txt: v => '≈ ' + Math.round((.2 + (v - 1) * .3 / 9) * 100) + ' cm', fn: 'setPoker', lab: 'Poker' },
  { w: 250, min: 40, max: 80, step: 5, val: 60, th: v => v / 100, txt: v => v + ' cm', fn: 'setPi', lab: 'PI-Greco' },
  { w: 250, min: 0, max: 2, step: 1, val: 1, th: v => [.6, .75, .9][v], txt: v => [60, 75, 90][v] + ' cm', fn: 'setSolman', lab: 'Solman' },
  { w: 250, min: 0, max: 2, step: 1, val: 1, th: v => [.6, .75, .9][v], txt: v => [60, 75, 90][v] + ' cm', fn: 'setPluriman', lab: 'Pluriman' },
];
const soT = $('#soT'); let soCur = 0;
const soLab = (i, th) => { const c = SOC[i], lb = SYS.solai.labels[i]; lb.el.querySelector('b').textContent = `${c.lab} · ${c.txt(c.val)} · largo ${c.w}`; lb.p.y = 1.1 + th + .35; };
function soApply() { const c = SOC[soCur], v = +soT.value; c.val = v; const th = c.th(v); mSolai[c.fn](th); mSolai.setProfile(soCur, th); $('#pvT').textContent = 'Profilo · ' + c.lab; $('#pvW').textContent = 'largo ' + c.w + ' cm'; $('#pvH').textContent = 'spessore ' + c.txt(v).replace('≈ ', ''); $('#soTo').textContent = c.txt(v); $('#soW').textContent = c.w + ' cm'; $('#soM').textContent = mSolai.widths()[soCur] + ' cm, 1 elemento'; soLab(soCur, th); }
function soSet(i) {
  soCur = i; const c = SOC[i];
  soT.min = c.min; soT.max = c.max; soT.step = c.step; soT.value = c.val;
  SYS.solai.c.z = mSolai.origin.z + SO[i].z; $('#soI').innerHTML = SO[i].t; soApply();
}
soT.addEventListener('input', soApply);
$('#soSel').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#soSel').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); soSet(+b.dataset.s); });
SOC.forEach((c, i) => { const th = c.th(c.val); mSolai[c.fn](th); soLab(i, th); });
soSet(0);

/* ---------- UI: configurator ---------- */
const ROOFINFO = {
  shed: '<b>Ondal shed.</b> Vetri verso l’alto: luce naturale dentro il capannone. Tegoli a interasse 5,00–7,50 m.',
  pv: '<b>Ondal Powershed®.</b> Lo shed con fotovoltaico integrato su telaio metallico: energia dal tetto, collegamenti in opera senza lavorare in quota.',
  flat: '<b>Ondal piano.</b> Qui con tetto verde e fotovoltaico a file alterne: acqua trattenuta, meno caldo, energia.',
  curve: '<b>Ondal cappella curva.</b> Lo stesso tegolo alare con cappella a volta e lucernari a raso: luce dall’alto, senza vetrate verticali.',
  new: '<b>Ondal New.</b> Trave Super-Omega con tegoli sugli appoggi bassi, per grandi maglie e fondazioni più piccole.',
  tau: '<b>TAU.</b> Travi con estradosso parabolico e intradosso piano, luci da 12 a 32 m.',
  plan: '<b>Manini Plan.</b> Travi principali precompresse, travi secondarie a T e manto isolante continuo.',
};
const ROOFLAB = {
  shed: ['Shed vetrato · luce naturale', 'Tegoli · interasse 5,00–7,50 m'],
  pv: ['Ondal Powershed®', 'Fotovoltaico senza forare il manto'],
  flat: ['Tetto verde · deflusso −70%', 'Fotovoltaico senza forare il manto'],
  curve: ['Cappella curva · lucernari a raso', 'Tegolo alare a V'],
  new: ['Trave Super-Omega', 'Tegoli su appoggi bassi'],
  tau: ['Estradosso parabolico', 'Intradosso piano'],
  plan: ['Manto isolante continuo', 'Trave secondaria a T'],
};
function cfgLabels() {
  const SPN = CF.roof === 'new' ? 26 : 20, W = CF.x * SPN, D = CF.z * 7.5, c = mCfg.origin, P = (x, y, z) => c.clone().add(V3(x, y, z)), r = ROOFLAB[CF.roof], y = CF.h + 2.6;
  beats[2].labels.forEach(l => l.el.remove());
  beats[2].labels = [mkLabel(P(W * .45, y, D * .5), r[0]), mkLabel(P(W * .85, y - .6, D * .15), r[1]), mkLabel(P(0, CF.h * .55, D), 'Pilastri prefabbricati')];
}
window.__cfgText = () => { const v = cuVals(), SPN = v.SPN, nm = { shed: 'Ondal shed', curve: 'Ondal cappella curva', new: 'Ondal New', pv: 'Ondal Powershed', flat: 'Ondal piano con verde e fotovoltaico', tau: 'TAU', plan: 'Manini Plan' }[CF.roof]; return `Configurazione scelta sul sito: ${nm}${manto && CF.roof !== 'flat' ? ', manto ' + manto : ''}. Misure richieste: larghezza ${fmt(v.W)} m × profondità ${fmt(v.D)} m, altezza ${fmt(v.H)} m (circa ${fmt(v.W * v.D)} m²).${(v.W > 4 * SPN || v.D > 60 || v.H > 12) ? ' Le misure superano il massimo mostrato dal modello 3D.' : ''}`; };
const CU = { W: 0, D: 0, H: 0 };
const cuOn = () => CU.W > 0 || CU.D > 0 || CU.H > 0;
const cuVals = () => { const SPN = CF.roof === 'new' ? 26 : 20; return { W: CU.W || CF.x * SPN, D: CU.D || CF.z * 7.5, H: CU.H || CF.h, SPN }; };
function cuCount(v) {
  const bays = Math.ceil(v.W / v.SPN), rowsN = Math.ceil(v.D / 7.5);
  const n = { shed: bays * (rowsN + 1), pv: bays * (rowsN + 1), curve: bays * (rowsN + 1), new: bays * (rowsN + 1), flat: bays * rowsN, tau: bays * (Math.round(v.D / 5) + 1), plan: bays * Math.max(3, Math.floor(v.D / 2.4) + 1) }[CF.roof];
  return { col: (bays + 1) * (rowsN + 1), n };
}
window.__cfgArea = () => { const a = cuVals().W * cuVals().D; return a < 1000 ? '<1000 mq' : a <= 3000 ? '1000<3000 mq' : '>3000 mq'; };
function cfgUI() {
  const v = cuVals(), SPN = v.SPN, W = v.W, D = v.D, cc = cuCount(v);
  $('#cfXo').textContent = `${CF.x} × ${SPN} m`; $('#cfZo').textContent = `${CF.z} × 7,5 m`; $('#cfHo').textContent = CF.h + ' m';
  $('#cfA').textContent = fmt(W * D) + ' m²'; $('#cfC').textContent = cuOn() ? cc.col : (CF.x + 1) * (CF.z + 1);
  $('#cfNl').textContent = mCfg.stat.name; $('#cfN').textContent = cuOn() ? cc.n : mCfg.stat.n; $('#cfHh').textContent = fmt(v.H - 1.2, 1) + ' m';
  const over = W > 4 * SPN + 1e-6 || D > 8 * 7.5 + 1e-6 || v.H > 12 || W < SPN * .99 && cuOn() && 0;
  const note = $('#cuN'); if (note) note.textContent = !cuOn() ? '' : over ? `Il modello 3D mostra al massimo ${4 * SPN} × 60 m, altezza 12 m. Nella richiesta inserisco le tue misure: ${fmt(W)} × ${fmt(D)} m, altezza ${fmt(v.H)} m.` : `Misure inserite nella richiesta: ${fmt(W)} × ${fmt(D)} m, altezza ${fmt(v.H)} m.`;
  $('#cfInfo').innerHTML = ROOFINFO[CF.roof];
}
function cfgRebuild() {
  const old = mCfg; scene.remove(old.g); old.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  const nm = buildOndal(STEP * 1, cfgOpts()); nm.t = REDUCED ? 1 : 0; nm.beat = 2; nm.target = 1;
  models[models.indexOf(old)] = nm; beats[2].m = nm; mCfg = nm;
  const SPN = CF.roof === 'new' ? 26 : 20, W = CF.x * SPN, D = CF.z * 7.5;
  beats[2].c.copy(nm.origin).add(V3(W / 2, CF.h * .55, D / 2)); beats[2].d = 40 + (W + D) * .85;
  cfgLabels(); cfgUI(); mantoApply();
}
const MANTI = { lamiera: { c: 0xaab6c2, m: .95, r: .32, t: '<b>Lamiera.</b> Lastre curve in lamiera zincata preverniciata, con fissaggi meccanici e giunti che seguono la dilatazione. Coibentazione con materassino in lana di vetro o di roccia, o pannelli rigidi di polistirene.' }, inox: { c: 0xf4f7fa, m: 1, r: .12, t: '<b>Acciaio inox.</b> Lastre sagomate in acciaio inox con fissaggi e giunti idonei, per un’impermeabilizzazione che dura.' }, guaina: { c: 0x3b3e43, m: 0, r: .95, t: '<b>Guaina.</b> Membrane elastomeriche protette da scaglie di ardesia, colorabili. I colori chiari riflettono i raggi solari e riducono l’isola di calore.' }, tpo: { c: 0xffffff, m: 0, r: .6, t: '<b>TPO.</b> Membrana sintetica in poliolefina termoplastica, resistente ai raggi UV, con prestazioni energetiche alte e lunga durata.' } };
let manto = 'lamiera';
function mantoApply() {
  const k = MANTI[manto], has = (mCfg.cappelle || []).length > 0, flat = CF.roof === 'flat';
  (mCfg.cappelle || []).forEach(c => { if (!c.userData.own) { c.material = c.material.clone(); c.userData.own = true; } const mt = c.material; mt.color.setHex(k.c); mt.metalness = k.m; mt.roughness = k.r; mt.envMapIntensity = k.m > .5 ? 2.2 : 1; mt.transparent = false; mt.opacity = 1; mt.needsUpdate = true; });
  $('#mnT').style.opacity = has ? 1 : .4; $('#mnT').style.pointerEvents = has ? '' : 'none';
  $('#mnI').innerHTML = has ? k.t : (flat ? 'Con il tetto verde e il fotovoltaico il manto è già scelto: il tetto è coperto da terra e vegetazione e da pannelli.' : 'Questo sistema ha già il suo manto: guaina e isolamento continui.');
}
$('#mnT').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#mnT').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); manto = b.dataset.k; mantoApply(); });
let cfT = 0; const cfgSoon = () => { clearTimeout(cfT); cfT = setTimeout(cfgRebuild, 160); };
$('#cfRoof').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#cfRoof').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); CF.roof = b.dataset.r; cfgRebuild(); });
function cuSync() { const v = cuVals(); $('#cuW').value = ''; $('#cuD').value = ''; $('#cuH').value = ''; $('#cuW').placeholder = fmt(v.W); $('#cuD').placeholder = fmt(v.D); $('#cuH').placeholder = fmt(v.H); }
for (const [id, k] of [['#cfX', 'x'], ['#cfZ', 'z'], ['#cfH', 'h']]) $(id).addEventListener('input', e => { CF[k] = +e.target.value; CU.W = CU.D = CU.H = 0; cfgUI(); cfgSoon(); cuSync(); });
for (const [id, k] of [['#cuW', 'W'], ['#cuD', 'D'], ['#cuH', 'H']]) $(id).addEventListener('input', e => {
  const x = parseFloat(String(e.target.value).replace(',', '.')); CU[k] = x > 0 && x <= 5000 ? x : 0;
  const v = cuVals(), SPN = v.SPN;
  CF.x = clamp(Math.round(v.W / SPN), 1, 4); CF.z = clamp(Math.round(v.D / 7.5), 2, 8); CF.h = clamp(Math.round(v.H), 6, 12);
  $('#cfX').value = CF.x; $('#cfZ').value = CF.z; $('#cfH').value = CF.h; cfgUI(); cfgSoon();
});
cfgRebuild(); mCfg.t = REDUCED ? 1 : 0; cuSync();

/* ---------- UI: seismic (magnitude) ---------- */
const S = mSeis.seis;
const seI = $('#seI');
const magText = M => 'M ' + M.toFixed(1).replace('.', ',');
const magWord = M => M < 5 ? 'avvertito' : M < 6 ? 'danni lievi' : M < 7 ? 'forte' : 'molto forte';
$('#swJ').addEventListener('change', e => { S.jaw = e.target.checked; S.reset(); if (e.target.checked) seView('jaw'); });
$('#swA').addEventListener('change', e => { S.all = e.target.checked; S.reset(); if (e.target.checked) seView('alld'); });
seI.addEventListener('input', () => { const M = +seI.value; S.I = 1 + (M - 4) * 2.25; $('#seIo').textContent = magText(M); });
seI.dispatchEvent(new Event('input'));
$('#seGo').addEventListener('click', () => { S.demo = false; $('#seMov').classList.remove('on'); S.start(); });
const so8 = mSeis.origin, bt8 = beats[3], VIEWS = { all: [0, 4.5, 0, 44, -14, 10], jaw: [5.4, 5.6, 2.5, 12, -20, -6], alld: [-3.2, 5.9, 2.5, 9, -22, -12] };
function seView(k) { const v = VIEWS[k]; bt8.c.copy(so8).add(V3(v[0], v[1], v[2])); bt8.d = v[3]; bt8.az = v[4]; bt8.el = v[5]; document.querySelectorAll('#seView button').forEach(b => b.classList.toggle('on', b.dataset.v === k)); }
$('#seView').addEventListener('click', e => { const b = e.target.closest('button'); if (b) seView(b.dataset.v); });
$('#seMov').addEventListener('click', e => { S.demo = !S.demo; e.currentTarget.classList.toggle('on', S.demo); S.reset(); if (!S.demo) S.dt = 0; });
const fm = v => v.toFixed(2).replace('.', ',');
function seUI() {
  const M = +seI.value, cb = S.cap(), cp = S.capP();
  $('#seD').textContent = `${fm(S.peak)} / ${fm(cb)} m`; $('#seC').textContent = `${fm(S.ppeak)} / ${fm(cp)} m`;
  $('#seD').parentElement.classList.toggle('bad', S.failed); $('#seC').parentElement.classList.toggle('bad', S.pfail);
  const r = Math.max(S.peak / cb, S.ppeak / cp), mt = $('#seM'); mt.style.width = clamp(r, 0, 1) * 100 + '%'; mt.className = r >= 1 ? 'bad' : r > .6 ? 'warn' : '';
  const st = $('#seS');
  if (S.failed || S.pfail) {
    const bits = [S.failed ? 'la trave perde l’appoggio' : '', S.pfail ? 'il pannello si stacca' : ''].filter(Boolean).join(' e ');
    st.textContent = (S.jaw || S.all ? 'Oltre la capacità di progetto: ' : 'Senza dispositivi: ') + bits + '.'; st.className = 'status bad';
  }
  else if (S.t > 4.5 && !S.running || S.t > 9) { st.textContent = 'Struttura integra: la trave resta sul pilastro e il pannello è intatto.'; st.className = 'status ok'; }
  else if (S.running) { st.textContent = 'Scossa in corso…'; st.className = 'status warn'; }
  else if (S.t < 0) { st.textContent = `Premi “Scuoti”. ${magText(M)}: ${magWord(M)}.`; st.className = 'status'; }
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
/* ---------- UI: green roof + rain ---------- */
$('#gnT').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on');
  const on = b.classList.contains('on'); mGreen.roofs[b.dataset.t].forEach(o => o.userData.hide = !on); if (typeof GR !== 'undefined') GR.ct = ZERO();
});
const ZERO = () => ({ sl: 0, sr: 0, gl: 0, gr: 0, tl: 0, tr: 0 });
const GR = { on: false, N: 260, drops: [], ct: ZERO(), tx: 0 };
const grPos = new Float32Array(GR.N * 3), grGeo = new THREE.BufferGeometry();
grGeo.setAttribute('position', new THREE.BufferAttribute(grPos, 3));
const grPts = new THREE.Points(grGeo, new THREE.PointsMaterial({ color: 0x7fc4ff, size: .28, transparent: true, opacity: .95, depthWrite: false }));
grPts.frustumCulled = false; grPts.visible = false; mGreen.g.add(grPts);
const respawn = d => { d.x = 1 + Math.random() * 34; d.z = .5 + Math.random() * 29; d.y = 14 + Math.random() * 22; d.v = 0; d.s = 0; };
for (let i = 0; i < GR.N; i++) { const d = {}; respawn(d); GR.drops.push(d); }
$('#gnRain').addEventListener('click', e => {
  GR.on = !GR.on; e.target.textContent = GR.on ? 'Ferma la pioggia' : 'Fai piovere'; GR.ct = ZERO(); grPts.visible = GR.on;
  GR.drops.forEach(respawn);
});
function grUpdate(dt) {
  if (!GR.on) return;
  const greenOn = !(mGreen.roofs.green[0] && mGreen.roofs.green[0].userData.hide), c = GR.ct;
  GR.drops.forEach((d, i) => {
    if (d.s === 0) {
      d.v += 14 * dt; d.y -= d.v * dt;
      if (d.y <= 8.4) {
        const bay = clamp(Math.floor(d.z / 7.5), 0, 3), green = bay % 2 === 1 && greenOn;
        c.tl++;
        if (green) { c.gl++; if (Math.random() < .7) { respawn(d); } else { c.gr++; c.tr++; d.s = 1; d.y = 8.4; } }
        else { c.sl++; c.sr++; c.tr++; d.s = 1; d.y = 8.4; }
      }
    } else if (d.s === 1) {
      const dir = d.x < 18 ? -1 : 1; d.x += dir * 8 * dt; if (d.x < 0 || d.x > 36) { d.s = 2; d.v = 0; }
    } else { d.v += 14 * dt; d.y -= d.v * dt; if (d.y < 0) respawn(d); }
    grPos[i * 3] = d.x; grPos[i * 3 + 1] = d.y; grPos[i * 3 + 2] = d.z;
  });
  grGeo.attributes.position.needsUpdate = true;
  GR.tx += dt; if (GR.tx > .25) { GR.tx = 0; $('#gnA').textContent = c.sl ? Math.round(100 * c.sr / c.sl) + '%' : '—'; $('#gnB').textContent = greenOn ? (c.gl ? Math.round(100 * c.gr / c.gl) + '%' : '—') : 'spento'; $('#gnC').textContent = c.tl ? Math.round(100 * c.tr / c.tl) + '%' : '—'; }
}

/* ---------- loop ---------- */
const pvEl = $('#profview'), cam2 = new THREE.PerspectiveCamera(32, 1.3, .05, 100), PVBG = new THREE.Color(0x0b1626);
let fS = 0, last = performance.now(), time = 0, activeBeat = 0, labelsShown = false, camInit = false;
const camSm = { c: V3(), d: 50, az: 0, el: 10 };
let gate = !!window.__splashDone || !document.getElementById('splash');
document.addEventListener('splashdone', () => { gate = true; });
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
  tmp.lerpVectors(A.c, Bt.c, k);
  const dT = lerp(A.d, Bt.d, k) * (vw < 900 ? 1.55 : 1), azT = lerp(A.az, Bt.az, k), elT = lerp(A.el, Bt.el, k);
  if (!camInit) { camSm.c.copy(tmp); camSm.d = dT; camSm.az = azT; camSm.el = elT; camInit = true; }
  const cs = 1 - Math.exp(-dt * 5.5);
  camSm.c.lerp(tmp, cs); camSm.d += (dT - camSm.d) * cs; camSm.az += (azT - camSm.az) * cs; camSm.el += (elT - camSm.el) * cs;
  camTgt.copy(camSm.c);
  const d = camSm.d, az = camSm.az + mx * 6 + (REDUCED ? 0 : Math.sin(time * .15) * 4), el = camSm.el - my * 2;
  const introK = eo(clamp(intro, 0, 1));
  sph(camTgt, d * (1 + (1 - introK) * .35), az + (1 - introK) * 30, el + (1 - introK) * 6, camPos);
  camera.position.copy(camPos); camera.lookAt(camTgt);
  const sysModels = Object.values(SYSM);
  models.forEach(m => { if (!sysModels.includes(m)) m.target = m.beat !== undefined && Math.abs(fS - m.beat) < 1.15 ? 1 : 0; });
  mOndal.target = gate && (fS < .5 || (sysSel === 'ondal' && fS < 2.2)) ? 1 : 0;
  Object.entries(SYSM).forEach(([k, m]) => { if (m !== mOndal) m.target = sysSel === k && fS >= .5 && fS < 2.2 ? 1 : 0; });
  models.forEach(m => { m.g.visible = m.t > .004 || m.target > 0; });
  if (!REDUCED && gate && intro < 1) { intro += dt * .35; }
  // lights follow (the sun slider drives the key light on the Ondal step)
  if (sun.play) { sun.h += dt * (12 / 16); if (sun.h > 19) sun.h = 7; snTs.forEach(t => t.value = sun.h); }
  const sw1 = sysSel === 'ondal' ? clamp(1 - Math.abs(fS - 1) * 1.6, 0, 1) : 0, sw2 = sysSel === 'ondalp' ? clamp(1 - Math.abs(fS - 1) * 1.6, 0, 1) : 0, sw = Math.max(sw1, sw2), sv = sunVec(sun.h), sm0 = sw2 > sw1 ? mOndalP : mOndal;
  key.position.set(camTgt.x - 26, camTgt.y + 44, camTgt.z + 30).lerp(tmp.copy(camTgt).addScaledVector(sv.v, 60), sw);
  key.intensity = lerp(2.3, .9 + 2.6 * Math.sin(sv.deg * Math.PI / 180), sw);
  key.color.setHex(0xfff0dd).lerp(new THREE.Color(0xffc48a), sw * (1 - clamp((sv.deg - 10) / 30, 0, 1)));
  key.target.position.copy(camTgt);
  sunSprite.position.copy(sm0.origin).addScaledVector(sv.v, 100); sunSprite.material.opacity = sw; sunSprite.visible = sw > .02;
  sunArc.position.copy(sm0.origin); sunArc.material.opacity = .35 * sw; sunArc.visible = sw > .02;
  const curvedNow = mOndal.hidden.has('shed');
  shaftsUpdate(shaftsA, sv, curvedNow ? 0 : sw1); shaftsCUpdate(sv, curvedNow ? sw1 : 0); shaftsUpdate(shaftsB, sv, sw2, +mgS.value - .3);
  if (sw > .02) sunUI(sv);
  rim.position.set(camTgt.x + 30, camTgt.y + 20, camTgt.z - 34); rim.target.position.copy(camTgt);
  const ab = Math.round(fS); if (ab !== activeBeat) { activeBeat = ab; closeTags(); }
  const run = inView() || Math.abs(fS - Math.round(fS)) > .02;
  if (run) {
    models.forEach(m => m.update(dt));
    mTau.rain(dt); mTau.pvUpdate(dt, time);
    mGreen.roofs.pv.concat(mGreen.roofs.green).forEach(o => { if (o.userData.hide) o.visible = false; });
    S.step(dt); S.apply(); seUI();
    mConn.conn.update(dt, time);
    fireUpdate(dt); grUpdate(dt);
    beats.forEach((b, bi) => {
      const sr = secR[bi], cy = scrollY + vh / 2, inSec = sr && cy > sr[0] - vh * .1 && cy < sr[1] + vh * .1;
      const show = inSec && Math.abs(fS - bi) < .22 && b.m.t > .97 && !b.labelsOff;
      b.labels.forEach(l => {
        tmp.copy(l.p).project(camera);
        const x = (tmp.x * .5 + .5) * vw, y = (-tmp.y * .5 + .5) * vh;
        const ox2 = l.el.classList.contains('open') ? Math.min(x, vw - 310) : x;
        l.el.style.transform = `translate(${ox2.toFixed(1)}px,${y.toFixed(1)}px) translate(-12px,-50%)`;
        const covered = vw > 900 ? x < Math.min(560, vw * .4) : y > vh * .5;
        l.el.classList.toggle('on', show && tmp.z < 1 && !covered);
      });
    });
    labelsShown = true;
    renderer.render(scene, camera);
    // riquadro del profilo (solo con Solai selezionato)
    const profOn = sysSel === 'solai' && Math.abs(fS - 1) < .5 && mSolai.t > .6;
    pvEl.classList.toggle('on', profOn);
    if (profOn) {
      if (vw > 900) { pvEl.style.cssText = `right:28px;bottom:28px;width:${Math.min(380, vw * .27)}px;height:${Math.min(290, vh * .34)}px`; } else { pvEl.style.cssText = `right:10px;top:64px;width:${Math.min(190, vw * .5)}px;height:${Math.min(140, vh * .17)}px`; }
      const r = pvEl.getBoundingClientRect(), rr = mSolai.prof.userData.r || 1.5;
      cam2.aspect = r.width / r.height; cam2.updateProjectionMatrix();
      mSolai.prof.getWorldPosition(tmp);
      const dd = rr / Math.sin(cam2.fov * Math.PI / 360) * 1.05, a2 = (35 + Math.sin(time * .35) * 28) * Math.PI / 180, e2 = 20 * Math.PI / 180;
      cam2.position.set(tmp.x + dd * Math.cos(e2) * Math.sin(a2 + 1.2), tmp.y + dd * Math.sin(e2), tmp.z + dd * Math.cos(e2) * Math.cos(a2 + 1.2)); cam2.lookAt(tmp);
      const bg0 = scene.background, fog0 = scene.fog; scene.background = PVBG; scene.fog = null;
      renderer.setScissorTest(true); renderer.setViewport(r.left, vh - r.bottom, r.width, r.height); renderer.setScissor(r.left, vh - r.bottom, r.width, r.height);
      renderer.render(scene, cam2);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, vw, vh); scene.background = bg0; scene.fog = fog0;
    }
  } else if (labelsShown) { labelHost.querySelectorAll('.tag.on').forEach(x => x.classList.remove('on')); closeTags(); labelsShown = false; }
}
measure();
requestAnimationFrame(tick);
window.__manini = { models, beats, S, mConn, go(i) { const a = anchors.find(a => a.i === i); scrollTo({ top: a.y0 - vh / 2, behavior: 'instant' }); fS = i; models.forEach(m => m.t = 1); }, get f() { return fS; } };
