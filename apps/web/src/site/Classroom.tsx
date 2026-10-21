// The hero: a low-poly classroom. The teacher talks (color-coded, the same
// color as her lines in the transcript), the class drifts off, and the camera
// pushes in on one student doing real work while Nevernote listens on the
// laptop: the transcript panel and the waveform pill at the bottom of the screen.
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Anchors = { panel?: { x: number; y: number }; pill?: { x: number; y: number } };

const TEACHER = "#c8794a";
const SPEAKERS = [
  { who: "Ms. Rivera", c: TEACHER, t: "Limestone stores carbon for millions of years." },
  { who: "Jordan", c: "#3f7fbf", t: "So rocks are a carbon sink?" },
  { who: "Ms. Rivera", c: TEACHER, t: "Exactly. Lab report due Friday, 11:59 PM.", due: "Due Fri 11:59 PM" },
  { who: "Sam", c: "#8a5cc2", t: "Is the nitrogen cycle on the test?" },
  { who: "Ms. Rivera", c: TEACHER, t: "Yes. That one will be on the test.", due: "★ On the test" },
];
const ESSAY = [
  "Why the New Deal still matters",
  "",
  "In 1933 a quarter of Americans were out of work. The",
  "programs that followed did more than create jobs; they",
  "changed what people expected from their government.",
  "Social Security, the FDIC and fair labor standards are",
  "still here ninety years later, which is the strongest",
  "argument that the New Deal worked where it counted.",
];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The laptop screen: an essay in progress, Nevernote's live transcript beside it, the recording pill below. */
function drawScreen(g: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f6d9b8");
  bg.addColorStop(1, "#e7b98f");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Menu bar.
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillRect(0, 0, W, 26);
  g.fillStyle = "#1c1915";
  g.font = "600 15px Inter, system-ui";
  g.fillText("  Docs   File   Edit   View", 10, 18);

  // Essay window.
  const ex = 34, ey = 52, ew = W * 0.56, eh = H - 160;
  g.shadowColor = "rgba(60,40,20,0.25)";
  g.shadowBlur = 24;
  g.fillStyle = "#ffffff";
  roundRect(g, ex, ey, ew, eh, 14);
  g.fill();
  g.shadowBlur = 0;
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(ex + 20 + i * 18, ey + 18, 6, 0, Math.PI * 2);
    g.fill();
  });
  const typed = Math.floor((t * 34) % (ESSAY.join(" ").length + 120));
  let left = typed;
  ESSAY.forEach((line, i) => {
    const show = line.slice(0, Math.max(0, left));
    left -= line.length + 1;
    g.fillStyle = i === 0 ? "#1c1915" : "#4a433b";
    g.font = i === 0 ? "600 24px Newsreader, Georgia, serif" : "17px Inter, system-ui";
    g.fillText(show, ex + 30, ey + 64 + i * 30);
    if (left < 0 && left > -line.length - 1 && Math.floor(t * 2) % 2 === 0) {
      const w = g.measureText(show).width;
      g.fillStyle = "#c8794a";
      g.fillRect(ex + 31 + w, ey + 48 + i * 30, 2, 20);
    }
  });

  // Nevernote panel.
  const px = ex + ew + 24, py = 52, pw = W - px - 30, ph = H - 160;
  g.shadowColor = "rgba(60,40,20,0.3)";
  g.shadowBlur = 30;
  g.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(g, px, py, pw, ph, 18);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#d9534a";
  g.beginPath();
  g.arc(px + 22, py + 24, 6 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1915";
  g.font = "600 16px Inter, system-ui";
  g.fillText("Nevernote · APES", px + 36, py + 30);
  const n = Math.floor(t / 1.6) % (SPEAKERS.length + 3);
  let y = py + 62;
  SPEAKERS.slice(0, Math.min(n + 1, SPEAKERS.length)).forEach((s) => {
    g.fillStyle = s.c;
    g.font = "700 13px Inter, system-ui";
    g.fillText(s.who, px + 16, y);
    g.fillStyle = "#f0ebe3";
    g.font = "14px Inter, system-ui";
    const words = s.t.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (g.measureText(cur + " " + w).width > pw - 50) {
        lines.push(cur);
        cur = w;
      } else cur = cur ? cur + " " + w : w;
    }
    lines.push(cur);
    const bh = lines.length * 19 + 14;
    roundRect(g, px + 12, y + 6, pw - 24, bh, 12);
    g.fill();
    g.fillStyle = "#1c1915";
    lines.forEach((l, i) => g.fillText(l, px + 22, y + 25 + i * 19));
    y += bh + 12;
    if (s.due) {
      g.fillStyle = "rgba(200,121,74,0.18)";
      roundRect(g, px + 12, y - 4, g.measureText(s.due).width + 28, 24, 12);
      g.fill();
      g.fillStyle = "#6b4f3a";
      g.font = "700 13px Inter, system-ui";
      g.fillText(s.due, px + 26, y + 12);
      y += 30;
    }
    y += 12;
  });

  // Recording pill at the bottom of the screen.
  const pwid = 260, phgt = 52, pxl = W / 2 - pwid / 2, pyl = H - 78;
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 20;
  g.fillStyle = "#16120e";
  roundRect(g, pxl, pyl, pwid, phgt, 26);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#d9534a";
  g.beginPath();
  g.arc(pxl + 28, pyl + 26, 8, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 18; i++) {
    const h = 6 + Math.abs(Math.sin(t * 7 + i * 0.7) * Math.cos(t * 3 + i)) * 26;
    g.fillStyle = "#3f9a6b";
    roundRect(g, pxl + 50 + i * 8, pyl + 26 - h / 2, 4, h, 2);
    g.fill();
  }
  const sec = Math.floor(t) + 2520;
  g.fillStyle = "#f6f1e9";
  g.font = "600 17px ui-monospace, monospace";
  g.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, pxl + 200, pyl + 32);
}

function label(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "700 54px Inter, system-ui";
  const w = g.measureText(text).width + 70;
  g.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(g, (512 - w) / 2, 18, w, 92, 46);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc((512 - w) / 2 + 40, 64, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1915";
  g.fillText(text, (512 - w) / 2 + 62, 83);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  return s;
}

function boardTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 360;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2f4a3e";
  g.fillRect(0, 0, 1024, 360);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.fillStyle = "rgba(255,255,255,0.88)";
  g.lineWidth = 4;
  g.font = "italic 56px Newsreader, Georgia, serif";
  g.fillText("The carbon cycle", 60, 90);
  g.font = "36px Inter, system-ui";
  g.fillText("atmosphere  →  plants  →  soil  →  rock", 60, 170);
  g.fillText("Lab report due Fri 11:59", 60, 240);
  g.beginPath();
  g.ellipse(840, 200, 110, 70, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillText("CO₂", 805, 212);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(0, 300, 1024, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Classroom({ progress, onAnchors }: { progress: () => number; onAnchors?: (a: Anchors) => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#fbf3ea", 18, 34);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);

    scene.add(new THREE.HemisphereLight("#fff8ef", "#e6cfb5", 1.35));
    const sun = new THREE.DirectionalLight("#fff1dd", 2.2);
    sun.position.set(6, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.radius = 4;
    scene.add(sun);

    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const k = color + JSON.stringify(extra);
      if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra }));
      return mats.get(k)!;
    };
    const mesh = (geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>) => {
      const m = new THREE.Mesh(geo, mat(color, extra));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // Room.
    const floor = mesh(new THREE.PlaneGeometry(30, 30), "#ecdcc6");
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    scene.add(floor);
    const wall = mesh(new THREE.PlaneGeometry(30, 10), "#f7efe4", 0, 5, -8);
    wall.castShadow = false;
    scene.add(wall);
    const side = mesh(new THREE.PlaneGeometry(30, 10), "#f3e8da", -9, 5, 0);
    side.rotation.y = Math.PI / 2;
    side.castShadow = false;
    scene.add(side);
    for (let i = 0; i < 3; i++) {
      const win = mesh(new THREE.BoxGeometry(0.05, 2.2, 1.8), "#cfe3f0", -8.95, 2.9, -4 + i * 4, { emissive: "#cfe3f0", emissiveIntensity: 0.35 });
      scene.add(win);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.5, 0.08), [mat("#3a2c22"), mat("#3a2c22"), mat("#3a2c22"), mat("#3a2c22"), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.95 }), mat("#3a2c22")]);
    board.position.set(0, 2.25, -7.9);
    scene.add(board);
    const tdesk = mesh(new THREE.BoxGeometry(2.2, 0.85, 0.9), "#b98b63", -2.4, 0.425, -5.8);
    scene.add(tdesk);
    scene.add(mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), "#d9534a", -2.9, 1.02, -5.8));

    // A person: low-poly body, head, hair, and two arms we can pose.
    const person = (shirt: string, skin: string, hair: string, seated: boolean) => {
      const g = new THREE.Group();
      const base = seated ? 0.45 : 0;
      if (!seated) g.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.85, 6), "#3b3530", 0, 0.42, 0));
      const body = mesh(new THREE.CylinderGeometry(0.21, 0.27, 0.72, 6), shirt, 0, base + (seated ? 0.36 : 1.2), 0);
      g.add(body);
      const headY = base + (seated ? 0.93 : 1.78);
      const head = mesh(new THREE.IcosahedronGeometry(0.21, 0), skin, 0, headY, 0);
      head.add(mesh(new THREE.SphereGeometry(0.225, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2.1), hair, 0, 0.03, 0.02));
      g.add(head);
      const arm = (sx: number) => {
        const pivot = new THREE.Group();
        pivot.position.set(sx * 0.27, base + (seated ? 0.62 : 1.48), 0);
        const a = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), shirt, 0, -0.25, 0);
        pivot.add(a);
        g.add(pivot);
        return pivot;
      };
      return { g, head, l: arm(-1), r: arm(1) };
    };

    const desk = (x: number, z: number) => {
      const d = new THREE.Group();
      d.add(mesh(new THREE.BoxGeometry(1.25, 0.06, 0.7), "#d6b48f", 0, 0.75, -0.35));
      for (const [lx, lz] of [[-0.55, -0.65], [0.55, -0.65], [-0.55, -0.05], [0.55, -0.05]]) d.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5), "#8a7a6a", lx, 0.375, lz));
      d.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), "#7c8a96", 0, 0.45, 0.25));
      d.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), "#7c8a96", 0, 0.72, 0.5));
      d.position.set(x, 0, z);
      scene.add(d);
      return d;
    };

    // Teacher, color-coded to her transcript lines, with a speaking ring and a name tag.
    const teacher = person(TEACHER, "#e0b089", "#4a3326", false);
    teacher.g.position.set(0.2, 0, -6.6);
    scene.add(teacher.g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 24), new THREE.MeshStandardMaterial({ color: TEACHER, emissive: TEACHER, emissiveIntensity: 0.9, flatShading: true }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.25, 0);
    teacher.g.add(ring);
    const tag = label("Ms. Rivera", TEACHER);
    tag.position.set(0, 2.65, 0);
    teacher.g.add(tag);

    // The class.
    const SHIRTS = ["#7aa6c2", "#9bc29a", "#d7a6b8", "#c9b37a", "#8f9ad1", "#c28f7a", "#7ab8b0", "#b9a0d6", "#d1c08f", "#93a8a0", "#c7a0a0"];
    const SKINS = ["#f1c9a5", "#d9a77c", "#a9744f", "#7a4f35", "#e8b896"];
    const HAIRS = ["#2b2118", "#5a3a22", "#c99a5b", "#1d1d1d", "#7a4b2a"];
    type Kid = ReturnType<typeof person> & { mood: "phone" | "sleep" | "hand" | "doodle" | "you" | "idle"; phase: number };
    const kids: Kid[] = [];
    const cols = [-4.2, -1.4, 1.4, 4.2];
    const rows = [-3.2, -0.9, 1.4];
    const YOU = { c: 2, r: 1 };
    let k = 0;
    rows.forEach((z, r) =>
      cols.forEach((x, c) => {
        desk(x, z);
        const you = c === YOU.c && r === YOU.r;
        const p = person(you ? "#e8973e" : SHIRTS[k % SHIRTS.length], SKINS[(k * 3) % SKINS.length], HAIRS[(k * 2) % HAIRS.length], true);
        p.g.position.set(x, 0, z + 0.22);
        p.g.rotation.y = Math.PI;
        scene.add(p.g);
        const moods: Kid["mood"][] = ["phone", "idle", "sleep", "doodle", "hand", "idle", "phone", "idle", "doodle", "sleep", "idle"];
        kids.push({ ...p, mood: you ? "you" : moods[k % moods.length], phase: k * 1.7 });
        if (!you) k++;
      }),
    );
    
    // Your laptop: the screen is a live canvas.
    const ux = cols[YOU.c], uz = rows[YOU.r];
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const g2 = canvas.getContext("2d")!;
    const screenTex = new THREE.CanvasTexture(canvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const laptop = new THREE.Group();
    laptop.position.set(ux, 0.78, uz - 0.38);
    laptop.add(mesh(new THREE.BoxGeometry(0.62, 0.025, 0.42), "#b9bcc2", 0, 0, 0.05));
    const lid = new THREE.Group();
    lid.position.set(0, 0.012, -0.16);
    lid.rotation.x = -0.22;
    lid.add(mesh(new THREE.BoxGeometry(0.62, 0.4, 0.018), "#b9bcc2", 0, 0.2, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.3625), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    screen.position.set(0, 0.2, 0.011);
    lid.add(screen);
    laptop.add(lid);
    scene.add(laptop);
    const glow = new THREE.PointLight("#ffd9b0", 0.6, 1.6);
    glow.position.set(ux, 1.05, uz - 0.1);
    scene.add(glow);

    // Anchor points on the screen we tell the page about, for the HTML callouts.
    const panelPt = new THREE.Vector3(0.17, 0.138, 0.012);
    const pillPt = new THREE.Vector3(0, -0.152, 0.012);

    // Camera path: wide shot → over the room → over your shoulder onto the screen.
    const look = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const SHOTS = [
      { p: look(8.5, 8.2, 11.5), t: look(0, 1, -2.5) },
      { p: look(5.6, 4.4, 6.4), t: look(0.8, 1, -2.2) },
      { p: look(ux + 0.9, 1.9, uz + 1.6), t: look(ux, 1.0, uz - 0.5) },
      { p: look(ux + 0.26, 1.24, uz + 0.08), t: look(ux + 0.02, 0.98, uz - 0.56) },
    ];
    const camPos = new THREE.Vector3();
    const camTgt = new THREE.Vector3();
    const portrait = { last: SHOTS[3].p.clone(), far: look(ux + 0.45, 1.75, uz + 0.45) };
    const shot = (s: number) => {
      SHOTS[3].p.copy(camera.aspect < 0.8 ? portrait.far : portrait.last);
      const seg = clamp(s, 0, 0.9999) * (SHOTS.length - 1);
      const i = Math.floor(seg);
      const f = ease(seg - i);
      camPos.lerpVectors(SHOTS[i].p, SHOTS[i + 1].p, f);
      camTgt.lerpVectors(SHOTS[i].t, SHOTS[i + 1].t, f);
    };

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / innerHeight - 0.5) * 2;
    };
    addEventListener("pointermove", onMove);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 58 : 38;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    const start = performance.now();
    let raf = 0;
    let lastScreen = 0;
    const smooth = { s: 0 };
    const tmp = new THREE.Vector3();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - start) / 1000;
      // The first second and a half flies in on its own; scrolling takes it the rest of the way.
      const intro = reduce ? 1 : ease(clamp(t / 2.6));
      const target = intro * (1 / 3) + clamp(progress()) * (2 / 3);
      smooth.s += (target - smooth.s) * 0.08;
      shot(smooth.s);
      camera.position.copy(camPos).add(tmp.set(mouse.x * 0.25 * (1 - smooth.s), -mouse.y * 0.15 * (1 - smooth.s), 0));
      camera.lookAt(camTgt);
      // Push the room down under the headline while wide; center it once we're at the desk.
      const w = el.clientWidth, h = el.clientHeight;
      camera.setViewOffset(w, h, 0, -h * (0.07 + (camera.aspect < 0.8 ? 0.15 : 0.28) * (1 - clamp(smooth.s * 1.6))), w, h);

      // Teacher talks and points; her ring pulses with her voice.
      teacher.r.rotation.z = -1.2 + Math.sin(t * 1.3) * 0.25;
      teacher.r.rotation.x = -0.4;
      teacher.l.rotation.z = 0.2;
      teacher.g.rotation.y = Math.sin(t * 0.5) * 0.35;
      const v = 1 + Math.abs(Math.sin(t * 5) * Math.sin(t * 1.7)) * 0.35;
      ring.scale.set(v, v, v);

      for (const kid of kids) {
        const ph = t + kid.phase;
        kid.l.rotation.x = kid.r.rotation.x = -1.1;
        kid.head.rotation.set(0, 0, 0);
        kid.head.position.y = 1.38;
        if (kid.mood === "phone") {
          kid.head.rotation.x = 0.45;
          kid.r.rotation.x = -1.4 + Math.sin(ph * 4) * 0.05;
        } else if (kid.mood === "sleep") {
          kid.head.rotation.x = 0.9;
          kid.head.position.y = 1.2 + Math.sin(ph * 0.8) * 0.01;
        } else if (kid.mood === "hand") {
          const up = (Math.sin(ph * 0.6) + 1) / 2 > 0.6;
          kid.r.rotation.x = up ? -2.9 : -1.1;
        } else if (kid.mood === "doodle") {
          kid.head.rotation.x = 0.35;
          kid.r.rotation.z = Math.sin(ph * 6) * 0.12;
        } else if (kid.mood === "you") {
          kid.head.rotation.x = 0.28;
          kid.l.rotation.x = -1.25 + Math.sin(t * 14) * 0.06;
          kid.r.rotation.x = -1.25 + Math.cos(t * 13) * 0.06;
        } else {
          kid.head.rotation.y = Math.sin(ph * 0.4) * 0.5;
        }
      }

      if (now - lastScreen > 60) {
        lastScreen = now;
        drawScreen(g2, canvas.width, canvas.height, t);
        screenTex.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (onAnchors) {
        const proj = (p: THREE.Vector3) => {
          const w = screen.localToWorld(p.clone()).project(camera);
          return { x: (w.x * 0.5 + 0.5) * el.clientWidth, y: (-w.y * 0.5 + 0.5) * el.clientHeight };
        };
        onAnchors({ panel: proj(panelPt), pill: proj(pillPt) });
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => x.dispose());
      });
      screenTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [progress, onAnchors]);

  return <div ref={host} className="absolute inset-0" aria-hidden />;
}

export default Classroom;
