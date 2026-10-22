import * as THREE from "./node_modules/three/build/three.module.js";

// ---------- palette ----------
const GREY_DARK = 0x9a9ca3;
const HOODIE = 0x5b7fc7; // the student with the laptop
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

// ---------- people ----------
// Low-poly but human: a shaped torso with shoulders, a neck that runs into both
// the chest and the head, hair (so you can tell which way someone faces), sleeves,
// trousers and shoes. Faces -z. `seated` bends the legs onto a chair.
const capsuleLimb = (r, len, m) => {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 9), m);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  const end = new THREE.Group();
  end.position.y = -len;
  pivot.add(end);
  return { pivot, end };
};
const TORSO = new THREE.LatheGeometry(
  [[0, -0.07], [0.135, -0.07], [0.15, 0.04], [0.138, 0.17], [0.16, 0.31], [0.19, 0.41], [0.192, 0.47], [0.16, 0.525], [0.08, 0.555], [0, 0.56]].map(([r, y]) => new THREE.Vector2(r, y)),
  14,
);

function person({ shirt, pants, skin, hair, style = "short", shoes = 0x2e2c2b, seated = true }) {
  const top = mat(shirt);
  const legsM = mat(pants);
  const skinM = mat(skin, { roughness: 0.7 });
  const hairM = mat(hair, { roughness: 0.85 });
  const root = new THREE.Group();
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), legsM);
  hips.scale.set(1, 0.62, 0.78);
  hips.castShadow = true;
  root.add(hips);
  const spine = new THREE.Group();
  spine.position.y = 0.06;
  root.add(spine);
  const torso = new THREE.Mesh(TORSO, top);
  torso.scale.z = 0.66;
  torso.castShadow = true;
  spine.add(torso);
  // Neck from inside the chest up into the head, so it's joined whichever way the head turns.
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.53;
  spine.add(neckPivot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.05, 0.17, 10), skinM);
  neck.position.y = 0.055;
  neck.castShadow = true;
  neckPivot.add(neck);
  const headG = new THREE.Group();
  headG.position.set(0, 0.2, -0.008);
  neckPivot.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.104, 14, 10), skinM);
  head.scale.set(0.9, 1.12, 1);
  head.castShadow = true;
  headG.add(head);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 7), skinM);
  jaw.scale.set(1, 0.8, 1);
  jaw.position.set(0, -0.06, -0.022);
  headG.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 5), skinM);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.005, -0.106);
  headG.add(nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), skinM);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(0.094 * sx, -0.005, 0.005);
    headG.add(ear);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM);
  cap.scale.set(0.93, 1.1, 1.04);
  cap.position.set(0, 0.012, 0.01);
  cap.rotation.x = 0.42;
  cap.castShadow = true;
  headG.add(cap);
  if (style === "long") {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 3, 10), hairM);
    back.scale.set(1.08, 1, 0.55);
    back.position.set(0, -0.08, 0.06);
    back.castShadow = true;
    headG.add(back);
  } else if (style === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 9, 7), hairM);
    bun.position.set(0, 0.07, 0.1);
    headG.add(bun);
  }

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.064, 10, 8), top);
    shoulder.position.set(0.168 * side, 0.465, 0);
    shoulder.castShadow = true;
    spine.add(shoulder);
    const upper = capsuleLimb(0.05, 0.25, top);
    upper.pivot.position.set(0.185 * side, 0.47, 0);
    spine.add(upper.pivot);
    const fore = capsuleLimb(0.042, 0.23, top);
    upper.end.add(fore.pivot);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), skinM);
    hand.scale.set(0.75, 1.35, 0.55);
    hand.position.y = -0.27;
    hand.castShadow = true;
    fore.pivot.add(hand);
    return { upper: upper.pivot, fore: fore.pivot };
  });
  const shoeM = mat(shoes, { roughness: 0.5 });
  const legs = [-1, 1].map((side) => {
    const thigh = capsuleLimb(0.07, 0.4, legsM);
    thigh.pivot.position.set(0.085 * side, -0.03, 0);
    root.add(thigh.pivot);
    const shin = capsuleLimb(0.054, 0.42, legsM);
    thigh.end.add(shin.pivot);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.13, 3, 8), shoeM);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1, 1, 0.75);
    foot.position.set(0, -0.47, -0.05);
    foot.castShadow = true;
    shin.pivot.add(foot);
    if (seated) {
      thigh.pivot.rotation.x = Math.PI / 2;
      shin.pivot.rotation.x = -Math.PI / 2;
    }
    return { thigh: thigh.pivot, shin: shin.pivot };
  });
  return { root, spine, neckPivot, arms, legs, top };
}

const SKIN = [0xe9c6a9, 0xc4946e, 0x8a5a3d, 0xf2d6c1, 0xae7b56, 0x6a4530, 0xd9ad8a];
const HAIR = [0x2a2320, 0x4b3426, 0x1c1a19, 0x86684a, 0x3b2b22, 0xb08a5e];
const SHIRTS = [0x4f5d75, 0xcbbca3, 0x6f7f6c, 0xe7e3dc, 0x8b6f5c, 0x3e4351, 0xa9b4c4, 0x7d5656, 0xd8cfc2, 0x5f6b62, 0x9a8c7b];
const PANTS = [0x3a4457, 0x2e2f33, 0x8d8273, 0x56534e, 0x45505f];
const STYLES = ["short", "long", "short", "bun", "short", "long"];

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
    const k = students.length;
    const s = isHero
      ? person({ shirt: HOODIE, pants: 0x3a4457, skin: SKIN[0], hair: HAIR[1], style: "short", shoes: 0xe9e6e1 })
      : person({ shirt: SHIRTS[(k * 5) % SHIRTS.length], pants: PANTS[(k * 3) % PANTS.length], skin: SKIN[(k * 4 + 1) % SKIN.length], hair: HAIR[(k * 5 + 2) % HAIR.length], style: STYLES[(k * 7) % STYLES.length] });
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

// Teacher, standing in front of the board, facing the class, one hand out.
const teacher = person({ shirt: 0xb48f6e, pants: 0x34363c, skin: SKIN[2], hair: HAIR[2], style: "bun", shoes: 0x3a2c24, seated: false });
teacher.root.position.set(-0.6, 0.97, -4.5);
teacher.root.rotation.y = Math.PI - 0.22;
scene.add(teacher.root);
teacher.arms[0].upper.rotation.z = -0.12;
teacher.arms[0].fore.rotation.x = 0.25;

// Her voice, drawn as a real audio waveform: a ribbon of rounded bars that
// leaves her, arcs over the class and runs into the student's laptop. Loud and
// quiet syllables travel along it, the way a recorder's level meter scrolls.
const WAVE_LOOP = 96; // frames per cycle: twice the gesture loop, so loops line up
const BARS = 170;
const MOUTH = new THREE.Vector3(-0.66, 1.66, -4.32);
const LAPTOP_MIC = new THREE.Vector3(1.2, 1.02, 1.74);
const wavePath = new THREE.CatmullRomCurve3([MOUTH, new THREE.Vector3(0.5, 2.15, -3.9), new THREE.Vector3(2.3, 2.45, -2.8), new THREE.Vector3(3.0, 2.45, -0.8), new THREE.Vector3(2.4, 2.1, 1.0), new THREE.Vector3(1.6, 1.5, 1.6), LAPTOP_MIC], false, "centripetal");
const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16); // scaled per bar below
const barMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15, emissive: 0x6f7bb0, emissiveIntensity: 0.25, transparent: true, opacity: 0.92, depthWrite: false });
const bars = new THREE.InstancedMesh(barGeo, barMat, BARS);
bars.frustumCulled = false;
scene.add(bars);
const C_FROM = new THREE.Color(0x9a9cc0); // soft lavender grey at her end
const C_TO = new THREE.Color(0x5b7fc7); // the student's blue at the laptop
const barDummy = new THREE.Object3D();
const WUP = new THREE.Vector3(0, 1, 0);
/** Speech-like loudness: syllables with pauses between phrases; periodic, so the loop is seamless. */
const loud = (x) => {
  const syl = Math.pow(Math.abs(Math.sin(Math.PI * x * 9)), 0.7);
  const phrase = 0.5 + 0.5 * Math.sin(Math.PI * 2 * x * 2 + 0.8);
  const grain = 0.75 + 0.25 * Math.sin(Math.PI * 2 * x * 23 + 1.3);
  return syl * (0.25 + 0.75 * phrase * phrase) * grain;
};

// The shield: a faceted glass dome on the teacher's side of the student.
const SHIELD_C = new THREE.Vector3(HERO.x, 1.0, HERO.z + 0.45);
const SHIELD_R = 0.95;
const shieldGeo = new THREE.SphereGeometry(SHIELD_R, 14, 9, Math.PI + 0.3, Math.PI - 0.6, 0.3, 1.65);
const shieldMat = new THREE.MeshStandardMaterial({ color: 0xa9c4f0, emissive: 0x5b7fc7, emissiveIntensity: 0.12, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, flatShading: true, roughness: 0.15, metalness: 0.1 });
const shield = new THREE.Mesh(shieldGeo, shieldMat);
shield.position.copy(SHIELD_C);
scene.add(shield);
const shieldEdges = new THREE.LineSegments(new THREE.EdgesGeometry(shieldGeo, 1), new THREE.LineBasicMaterial({ color: 0xb4c8ec, transparent: true, opacity: 0.45, depthWrite: false }));
shieldEdges.position.copy(SHIELD_C);
scene.add(shieldEdges);

function waveFrame(frameNo, fade = 1) {
  const ph = (frameNo % WAVE_LOOP) / WAVE_LOOP;
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  let near = 0;
  for (let i = 0; i < BARS; i++) {
    const u = (i + 0.5) / BARS;
    wavePath.getPointAt(u, p);
    wavePath.getTangentAt(u, tan);
    // Upright bars, like any audio waveform, turned to face along the path.
    side.set(tan.x, 0, tan.z).normalize();
    up.copy(WUP);
    tan.crossVectors(side, up);
    m.makeBasis(tan, up, side);
    const ends = Math.min(1, u / 0.05) * Math.pow(Math.min(1, (1 - u) / 0.22), 1.5);
    // The sound scrolls from her towards the laptop: one loop moves it two syllable groups along.
    const a = loud(u * 2 - ph * 2) * ends;
    const len = (0.03 + 0.5 * a) * (0.7 + 0.3 * (1 - u)) * fade;
    barDummy.position.copy(p);
    barDummy.quaternion.setFromRotationMatrix(m);
    barDummy.scale.set(0.04 * fade + 1e-4, Math.max(1e-4, len), 0.04 * fade + 1e-4);
    barDummy.updateMatrix();
    bars.setMatrixAt(i, barDummy.matrix);
    col.copy(C_FROM).lerp(C_TO, u);
    bars.setColorAt(i, col);
    if (u > 0.82) near = Math.max(near, a);
  }
  bars.instanceMatrix.needsUpdate = true;
  bars.instanceColor.needsUpdate = true;
  bars.visible = fade > 0.01;
  // The shield and the screen glow brighten a little with each loud syllable that arrives.
  shieldMat.emissiveIntensity = 0.12 + near * 0.35;
  shieldMat.opacity = 0.11 + near * 0.06;
  shieldEdges.material.opacity = 0.38 + near * 0.3;
  glow.intensity = 0.5 + near * 0.5;
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

let camPath = null;
let atPath = null;
let pathAspect = 0;
/** Fritsch-Carlson monotone cubic through (xs, ys): smooth, never overshoots, never stalls. */
function monotone(xs, ys, x) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const hh = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / hh;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * m[i + 1];
}

function cameraAt(p, aspect) {
  if (aspect !== pathAspect) {
    camPath = atPath = null;
    pathAspect = aspect;
  }
  screenPose();
  // How far from the screen to fill the frame with it.
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  // Portrait: the student sits on the line out of the screen, so stop close and fill the height.
  // It ends with the screen inside the frame and a little of the lid around it, so
  // the live app on the page can sit right on it: 68% of the height on desktop,
  // 84% of the width in portrait.
  const viewH = aspect < 1 ? SCREEN_W / 0.84 / aspect : SCREEN_H / 0.68;
  const dist = viewH / 2 / Math.tan(vfov / 2);
  const end = screenCenter.clone().addScaledVector(screenNormal, dist);
  const portrait = aspect < 1;
  const keys = [
    { t: 0, pos: new THREE.Vector3(portrait ? 4.2 : 6.2, portrait ? 6.2 : 4.6, portrait ? 12.5 : 9.6), at: new THREE.Vector3(0, 1.1, -1.6) },
    { t: 0.32, pos: new THREE.Vector3(portrait ? 3.6 : 4.6, portrait ? 4.4 : 3.3, portrait ? 9.2 : 7.2), at: new THREE.Vector3(0.4, 1.0, -1.0) },
    { t: 0.6, pos: new THREE.Vector3(2.35, 2.05, 4.3), at: new THREE.Vector3(HERO.x, 0.95, HERO.z) },
    { t: 0.8, pos: new THREE.Vector3(1.95, 1.4, 2.5), at: screenCenter.clone() },
    { t: 0.9, pos: end.clone().lerp(new THREE.Vector3(1.95, 1.4, 2.5), 0.4), at: screenCenter.clone() },
    { t: 1, pos: end, at: screenCenter.clone() },
  ];
  // One continuous move: map the scroll through the key
  // times with a monotone cubic, so the camera never stops at a key (that was the
  // stop-and-go "jutting"). Both paths are single Catmull-Rom curves.
  const n = keys.length - 1;
  const q = monotone(keys.map((k) => k.t), keys.map((_, i) => i / n), THREE.MathUtils.clamp(p, 0, 1));
  camPath ??= new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, "centripetal");
  atPath ??= new THREE.CatmullRomCurve3(keys.map((k) => k.at), false, "centripetal");
  camera.position.copy(camPath.getPoint(q));
  camera.lookAt(atPath.getPoint(q));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

// ---------- per-frame animation ----------
function animate(frameNo) {
  const ph = (frameNo % LOOP) / LOOP;
  const w = ph * Math.PI * 2;
  // Teacher talks with their hands.
  teacher.arms[1].upper.rotation.x = 0.75 + Math.sin(w) * 0.2;
  teacher.arms[1].upper.rotation.z = 0.32 + Math.sin(w * 2) * 0.06;
  teacher.arms[1].fore.rotation.x = 0.7 + Math.sin(w + 1) * 0.18;
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
}

// Every material on the student, so they can melt away as one.
const heroMats = [];
hero.root.traverse((o) => o.material && !heroMats.includes(o.material) && heroMats.push(o.material));

// Where the screen's corners land in the frame, so the page can lay the live
// app exactly over the screen and take over without a seam.
function screenQuad(w, h) {
  const out = [];
  for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const v = new THREE.Vector3((x * SCREEN_W) / 2, (y * SCREEN_H) / 2, 0);
    screen.localToWorld(v);
    v.project(camera);
    out.push(+(((v.x + 1) / 2) * w).toFixed(2), +(((1 - v.y) / 2) * h).toFixed(2));
  }
  return out;
}

window.renderFrame = (p, frameNo, w, h, quality = 0.82) => {
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  animate(frameNo);
  // On the last stretch the camera glides through where the student sits, so they
  // (and their shield and the waveform) melt away instead of sweeping across the lens.
  const fade = 1 - ease(THREE.MathUtils.clamp((p - 0.6) / 0.16, 0, 1));
  for (const m of heroMats) {
    if (m.transparent !== fade < 1) {
      m.transparent = fade < 1;
      m.needsUpdate = true;
    }
    m.opacity = fade;
    m.depthWrite = fade === 1;
  }
  hero.root.visible = fade > 0.01;
  waveFrame(frameNo, fade);
  shieldMat.opacity *= fade;
  shieldEdges.material.opacity *= fade;
  shieldEdges.visible = shield.visible = fade > 0.01;
  cameraAt(p, w / h);
  renderer.render(scene, camera);
  window.lastQuad = screenQuad(w, h);
  return renderer.domElement.toDataURL("image/webp", quality);
};
window.dbg = () => { scene.updateMatrixWorld(true); screenPose(); const v = (o) => o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3)); return { head: v(hero.neckPivot), spine: v(hero.spine), handL: v(hero.arms[0].fore), handR: v(hero.arms[1].fore), sc: screenCenter.toArray().map((x) => +x.toFixed(3)), n: screenNormal.toArray().map((x) => +x.toFixed(3)) }; };
window.ready = true;
