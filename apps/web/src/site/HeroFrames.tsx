// The hero's 3D classroom, played as pre-rendered frames on a canvas (the way
// Apple's product pages do it). The frames come from a three.js scene rendered
// offline, so every device gets the same 3D look at a steady 60fps, with or
// without WebGL. Scroll picks the frame; a light spring and a crossfade between
// neighbouring frames keep the motion smooth between them.
import { useEffect, useRef } from "react";

export interface FrameSet {
  dir: string;
  count: number;
  idle: number;
  w: number;
  h: number;
}
export const DESKTOP: FrameSet = { dir: "/hero/d", count: 150, idle: 48, w: 1600, h: 900 };
export const MOBILE: FrameSet = { dir: "/hero/m", count: 120, idle: 48, w: 720, h: 1400 };
export const pickSet = () => (typeof matchMedia !== "undefined" && matchMedia("(max-aspect-ratio: 1/1)").matches ? MOBILE : DESKTOP);

const name = (set: FrameSet, kind: "s" | "i", i: number) => `${set.dir}/${kind}${String(i).padStart(kind === "s" ? 3 : 2, "0")}.webp`;

/** First every 16th frame, then every 8th, and so on, so a fast scroll always has something close. */
function loadOrder(n: number) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let step = 16; step >= 1; step /= 2)
    for (let i = 0; i < n; i += step)
      if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
  if (!seen.has(n - 1)) out.push(n - 1);
  return out;
}

export function HeroFrames({ progress, set, className = "" }: { progress: () => number; set: FrameSet; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d", { alpha: false })!;
    const frames: (HTMLImageElement | undefined)[] = Array(set.count);
    const idle: (HTMLImageElement | undefined)[] = Array(set.idle);
    let alive = true;
    let dirty = true;

    const load = (src: string) =>
      new Promise<HTMLImageElement | undefined>((res) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        img.decode().then(() => res(img), () => res(undefined));
      });
    // Six at a time: idle loop first (it's what you see on load), then the scroll frames.
    const queue: (() => Promise<void>)[] = [
      ...Array.from({ length: set.idle }, (_, i) => async () => void (idle[i] = await load(name(set, "i", i)))),
      ...loadOrder(set.count).map((i) => async () => {
        frames[i] = await load(name(set, "s", i));
        dirty = true;
      }),
    ];
    const worker = async () => {
      while (alive && queue.length) await queue.shift()!();
    };
    for (let k = 0; k < 6; k++) void worker();

    // The canvas is exactly one frame big and CSS covers the viewport with it: every
    // draw is a straight copy, which stays cheap even with GPU acceleration off.
    canvas.width = set.w;
    canvas.height = set.h;

    const nearest = (i: number) => {
      for (let d = 0; d < set.count; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return idle[0];
    };
    const draw = (img: HTMLImageElement | undefined, alpha = 1) => {
      if (!img) return;
      g.globalAlpha = alpha;
      g.drawImage(img, 0, 0);
    };

    let cur = progress() * (set.count - 1);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const target = progress() * (set.count - 1);
      const diff = target - cur;
      // Frame-rate independent glide toward the scroll position. Every draw blends
      // the two nearest frames, so the motion stays liquid between them.
      cur = Math.abs(diff) < 0.002 ? target : cur + diff * (1 - Math.exp(-dt * 9));
      const atTop = cur < 0.02 && target < 0.02;
      if (atTop && idle[set.idle - 1]) {
        // At the top: loop the teacher talking and the smoke drifting out, 48 frames over 4 s.
        const f = (((now - t0) / 1000) * 12) % set.idle;
        const i = Math.floor(f);
        draw(idle[i], 1);
        draw(idle[(i + 1) % set.idle], f - i);
        dirty = true;
        return;
      }
      if (!dirty && Math.abs(diff) < 0.002) return;
      const i = Math.floor(cur);
      dirty = false;
      const a = frames[i] ?? nearest(i);
      draw(a, 1);
      const b = frames[i + 1];
      if (b && a === frames[i]) draw(b, cur - i);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [progress, set]);

  return <canvas ref={ref} className={`block h-full w-full object-cover ${className}`} />;
}

/** Where the laptop screen ends up on the page in the last frame, for handing over to the live demo. */
export function screenRect(set: FrameSet, vw: number, vh: number) {
  const s = Math.max(vw / set.w, vh / set.h);
  const portrait = set.w < set.h;
  // Matches cameraAt() in the render scene: desktop fits the 16:10 screen, portrait fills its height.
  const sh = portrait ? set.h / 0.98 : set.h;
  const sw = portrait ? sh * 1.6 : Math.min(set.w, set.h * 1.6);
  return { w: sw * s, h: sh * s, x: (vw - sw * s) / 2, y: (vh - sh * s) / 2 };
}
