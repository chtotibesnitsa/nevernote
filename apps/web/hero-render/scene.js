import * as THREE from "./node_modules/three/build/three.module.js";

// ---------- palette ----------
const GREY = 0xbfc1c7;
const GREY_DARK = 0x9a9ca3;
const TEACHER = 0xff7a2f;
const STUDENT = 0x3b7bff;
const LOOP = 48; // frames in one ripple / gesture cycle

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.62, metalness: 0.02, ...o });

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f2f0);
scene.fog = new THREE.Fog(0xf3f2f0, 16, 30);

// ---------- light ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
sun.shadow.radius = 4;
sun.shadow.bias = -0.0004;
scene.add(sun);

// ---------- room ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(0xe6e4e0));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 0.2), mat(0xeeece8));
wall.position.set(0, 3, -6.1);
wall.receiveShadow = true;
scene.add(wall);
for (const x of [-9, 9]) {
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 16), mat(0xeeece8));
  side.position.set(x, 3, 1.8);
  side.receiveShadow = true;
  scene.add(side);
}

// Whiteboard with today's lesson, matching what the teacher says on the laptop.
function boardTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 820;
  const g = c.getContext("2d");
  g.fillStyle = "#fbfbfa";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#2b2b30";
  g.font = "600 120px Inter";
  g.fillText("The carbon cycle", 110, 200);
  g.font = "500 64px Inter";
  g.fillStyle = "#55565c";
  g.fillText("air  →  plants  →  soil  →  rock", 110, 340);
  g.fillText("Limestone stores carbon for millions of years", 110, 450);
  g.fillStyle = "#e0561f";
  g.font = "700 70px Inter";
  g.fillText("Lab report due Fri 11:59 PM", 110, 620);
  g.strokeStyle = "#e0561f";
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(560, 600, 520, 80, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#55565c";
  g.font = "500 58px Inter";
  g.fillText("Test: nitrogen cycle too", 110, 750);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const frame = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.3, 0.08), mat(0x8d8f96));
frame.position.set(0, 2.35, -5.95);
scene.add(frame);
const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.08), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.9 }));
board.position.set(0, 2.35, -5.9);
scene.add(board);

// ---------- mannequin ----------
const limb = (r1, r2, len, m) => {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 7), m);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  const end = new THREE.Group();
  end.position.y = -len;
  pivot.add(end);
  const joint = new THREE.Mesh(new THREE.IcosahedronGeometry(r1 * 1.08, 0), m);
  joint.castShadow = true;
  pivot.add(joint);
  return { pivot, end };
};

/** A wooden-style mannequin. Faces -z. `seated` bends the legs onto a chair. */
function mannequin(color, { seated = true } = {}) {
  const m = mat(color);
  const root = new THREE.Group();
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 7), m);
  pelvis.castShadow = true;
  root.add(pelvis);
  const spine = new THREE.Group();
  spine.position.y = 0.08;
  root.add(spine);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.15, 0.52, 7), m);
  torso.position.y = 0.3;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  spine.add(torso);
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.58;
  spine.add(neckPivot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6), m);
  neck.position.y = 0.04;
  neckPivot.add(neck);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), m);
  head.scale.set(0.92, 1.15, 1);
  head.position.y = 0.2;
  head.castShadow = true;
  neckPivot.add(head);

  const arms = [-1, 1].map((side) => {
    const upper = limb(0.055, 0.045, 0.3, m);
    upper.pivot.position.set(0.25 * side, 0.52, 0);
    spine.add(upper.pivot);
    const fore = limb(0.045, 0.035, 0.27, m);
    upper.end.add(fore.pivot);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), m);
    hand.position.y = -0.3;
    hand.scale.set(0.8, 1.2, 0.6);
    fore.pivot.add(hand);
    return { upper: upper.pivot, fore: fore.pivot };
  });
  const legs = [-1, 1].map((side) => {
    const thigh = limb(0.078, 0.06, 0.44, m);
    thigh.pivot.position.set(0.1 * side, -0.05, 0);
    root.add(thigh.pivot);
    const shin = limb(0.06, 0.045, 0.44, m);
    thigh.end.add(shin.pivot);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.2), m);
    foot.position.set(0, -0.46, -0.06);
    foot.castShadow = true;
    shin.pivot.add(foot);
    if (seated) {
      thigh.pivot.rotation.x = Math.PI / 2;
      shin.pivot.rotation.x = -Math.PI / 2;
    }
    return { thigh: thigh.pivot, shin: shin.pivot };
  });
  return { root, spine, neckPivot, arms, legs };
}

// ---------- desks + class ----------
function desk(x, z) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.6), mat(0xdedcd8));
  top.position.y = 0.74;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  for (const [dx, dz] of [[-0.52, -0.25], [0.52, -0.25], [-0.52, 0.25], [0.52, 0.25]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), mat(GREY_DARK));
    leg.position.set(dx, 0.36, dz);
    leg.castShadow = true;
    g.add(leg);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), mat(0xcfcdc9));
  seat.position.set(0, 0.45, 0.62);
  seat.castShadow = seat.receiveShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.04), mat(0xcfcdc9));
  back.position.set(0, 0.7, 0.85);
  back.castShadow = true;
  g.add(back);
  for (const [dx, dz] of [[-0.19, 0.44], [0.19, 0.44], [-0.19, 0.8], [0.19, 0.8]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), mat(GREY_DARK));
    leg.position.set(dx, 0.225, dz);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

const COLS = [-3.6, -1.2, 1.2, 3.6];
const ROWS = [-2.2, -0.2, 1.8];
const HERO = { x: 1.2, z: 1.8 };
const students = [];
let hero;
for (const z of ROWS)
  for (const x of COLS) {
    desk(x, z);
    const isHero = x === HERO.x && z === HERO.z;
    const s = mannequin(isHero ? STUDENT : GREY);
    s.root.position.set(x, 0.6, z + 0.6);
    scene.add(s.root);
    // Everyone sits up, eyes on the teacher; hands resting on the desk.
    for (const a of s.arms) {
      a.upper.rotation.x = 0.35;
      a.fore.rotation.x = 1.25;
    }
    s.arms[0].upper.rotation.z = -0.12;
    s.arms[1].upper.rotation.z = 0.12;
    if (isHero) hero = s;
    else students.push(s);
  }

// The one student who isn't watching: hunched over their laptop.
hero.spine.rotation.x = -0.42;
hero.neckPivot.rotation.x = -0.35;
for (const a of hero.arms) {
  a.upper.rotation.x = 1.15;
  a.fore.rotation.x = 0.55;
}
hero.arms[0].upper.rotation.z = -0.28;
hero.arms[1].upper.rotation.z = 0.28;

// Laptop
const SCREEN_W = 0.36;
const SCREEN_H = 0.225;
const screenImg = await new Promise((res) => {
  const i = new Image();
  i.onload = () => res(i);
  i.src = "./screen.png";
});
const screenTex = new THREE.Texture(screenImg);
screenTex.needsUpdate = true;
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 16;
screenTex.generateMipmaps = true;
screenTex.minFilter = THREE.LinearMipmapLinearFilter;
const laptop = new THREE.Group();
const base = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.02, 0.016, 0.25), mat(0xc4c6cc, { metalness: 0.3, roughness: 0.4 }));
base.position.y = 0.008;
base.castShadow = true;
laptop.add(base);
const hinge = new THREE.Group();
hinge.position.set(0, 0.016, -0.125);
hinge.rotation.x = -0.26; // lid tilted back
laptop.add(hinge);
const lid = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.02, SCREEN_H + 0.02, 0.008), mat(0xc4c6cc, { metalness: 0.3, roughness: 0.4 }));
lid.position.set(0, SCREEN_H / 2 + 0.01, -0.004);
lid.castShadow = true;
hinge.add(lid);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
screen.position.set(0, SCREEN_H / 2 + 0.01, 0.001);
hinge.add(screen);
laptop.position.set(HERO.x, 0.765, HERO.z + 0.08);
scene.add(laptop);
// A soft glow from the screen onto the student.
const glow = new THREE.PointLight(0xbcd2ff, 0.6, 1.6);
glow.position.set(HERO.x, 0.95, HERO.z + 0.25);
scene.add(glow);

// Teacher, standing at the board, one arm out.
const teacher = mannequin(TEACHER, { seated: false });
teacher.root.position.set(-0.6, 1.0, -4.6);
teacher.root.rotation.y = 0.12;
scene.add(teacher.root);
teacher.arms[0].upper.rotation.z = -0.15;
teacher.arms[0].fore.rotation.x = 0.3;

// Sound waves: rings that leave the teacher and roll out over the class.
const rings = [];
for (let k = 0; k < 5; k++) {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.012, 6, 64),
    new THREE.MeshBasicMaterial({ color: TEACHER, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  scene.add(r);
  rings.push(r);
}

// ---------- camera path ----------
const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.02, 60);
const screenCenter = new THREE.Vector3();
const screenNormal = new THREE.Vector3();
function screenPose() {
  scene.updateMatrixWorld(true);
  screen.getWorldPosition(screenCenter);
  screenNormal.set(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));
}

const ease = (t) => t * t * (3 - 2 * t);
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function cameraAt(p, aspect) {
  screenPose();
  // How far from the screen to fill the frame with it.
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  // Portrait: the student sits on the line out of the screen, so stop close and fill the height.
  const viewH = aspect < 1 ? SCREEN_H * 0.98 : Math.max(SCREEN_H, SCREEN_W / aspect);
  const dist = viewH / 2 / Math.tan(vfov / 2);
  const end = screenCenter.clone().addScaledVector(screenNormal, dist);
  const portrait = aspect < 1;
  const keys = [
    { t: 0, pos: new THREE.Vector3(portrait ? 4.2 : 6.2, portrait ? 6.2 : 4.6, portrait ? 12.5 : 9.6), at: new THREE.Vector3(0, 1.1, -1.6) },
    { t: 0.32, pos: new THREE.Vector3(portrait ? 3.6 : 4.6, portrait ? 4.4 : 3.3, portrait ? 9.2 : 7.2), at: new THREE.Vector3(0.4, 1.0, -1.0) },
    { t: 0.6, pos: new THREE.Vector3(2.35, 2.05, 4.3), at: new THREE.Vector3(HERO.x, 0.95, HERO.z) },
    { t: 0.8, pos: new THREE.Vector3(1.95, 1.4, 2.5), at: screenCenter.clone() },
    { t: 0.9, pos: new THREE.Vector3(1.66, 1.12, 1.98), at: screenCenter.clone() },
    { t: 1, pos: end, at: screenCenter.clone() },
  ];
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smoother(THREE.MathUtils.clamp((p - a.t) / (b.t - a.t), 0, 1));
  // Catmull-Rom through the neighbours keeps the motion one smooth curve.
  const P = (k) => keys[Math.max(0, Math.min(keys.length - 1, k))];
  const cr = (f) => {
    const c = new THREE.CatmullRomCurve3([f(P(i - 1)), f(a), f(b), f(P(i + 2))], false, "centripetal");
    return c.getPoint((1 + u) / 3);
  };
  camera.position.copy(cr((k) => k.pos));
  camera.lookAt(cr((k) => k.at));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

// ---------- per-frame animation ----------
function animate(frameNo) {
  const ph = (frameNo % LOOP) / LOOP;
  const w = ph * Math.PI * 2;
  // Teacher talks with their hands.
  teacher.arms[1].upper.rotation.x = -0.9 + Math.sin(w) * 0.25;
  teacher.arms[1].upper.rotation.z = 0.5 + Math.sin(w * 2) * 0.08;
  teacher.arms[1].fore.rotation.x = -0.6 + Math.sin(w + 1) * 0.2;
  teacher.neckPivot.rotation.y = Math.sin(w) * 0.12;
  teacher.spine.rotation.y = Math.sin(w) * 0.05;
  // Students follow along, tiny head bobs out of step with each other.
  students.forEach((s, i) => {
    s.neckPivot.rotation.x = 0.08 + Math.sin(w + i * 1.7) * 0.03;
    s.neckPivot.rotation.y = Math.sin(w + i) * 0.04 - 0.02 * (s.root.position.x / 3);
  });
  // The hero types.
  hero.arms[0].fore.rotation.x = 0.55 + Math.max(0, Math.sin(w * 4)) * 0.08;
  hero.arms[1].fore.rotation.x = 0.55 + Math.max(0, Math.sin(w * 4 + 2)) * 0.08;
  // Ripples.
  rings.forEach((r, k) => {
    const q = (ph + k / rings.length) % 1;
    const z = -4.4 + q * 7.5;
    r.position.set(-0.6 + q * 0.8, 1.65 - q * 0.35, z);
    const s = 0.25 + q * 3.2;
    r.scale.set(s, s * 0.62, s);
    r.material.opacity = Math.sin(q * Math.PI) * 0.55;
  });
}

window.renderFrame = (p, frameNo, w, h, quality = 0.82) => {
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  animate(frameNo);
  cameraAt(p, w / h);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/webp", quality);
};
window.dbg = () => { scene.updateMatrixWorld(true); screenPose(); const v = (o) => o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3)); return { head: v(hero.neckPivot), spine: v(hero.spine), handL: v(hero.arms[0].fore), handR: v(hero.arms[1].fore), sc: screenCenter.toArray().map((x) => +x.toFixed(3)), n: screenNormal.toArray().map((x) => +x.toFixed(3)) }; };
window.ready = true;
