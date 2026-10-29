// The hero's 3D classroom, played as pre-rendered frames on a canvas (the way
// Apple's product pages do it). The frames come from a three.js scene rendered
// offline, so every device gets the same 3D look with or without WebGL.
//
// Smoothness: every frame is downloaded once as a small compressed file, and
// only the frames around the current scroll position are decoded (off the main
// thread, with createImageBitmap) and kept ready. Drawing a ready bitmap is a
// straight copy, so scrolling never waits on a decode. A frame-rate independent
// glide plus a blend of the two nearest frames keeps the motion liquid.
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

type Drawable = ImageBitmap | HTMLImageElement;
const IDLE = 10000; // idle frames live in the same cache, offset by this

/**
 * `progress()` returns 0..1 for the scroll. `onFrame(f)` is called on every
 * drawn frame with the (fractional) frame shown, so things laid over the
 * canvas can follow it exactly.
 */
export function HeroFrames({ progress, set, onFrame, onReady, className = "" }: { progress: () => number; set: FrameSet; onFrame?: (f: number) => void; onReady?: () => void; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;
  const readyCb = useRef(onReady);
  readyCb.current = onReady;

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d", { alpha: false })!;
    const blobs = new Map<number, Blob>();
    const ready = new Map<number, Drawable>();
    const pending = new Set<number>();
    let alive = true;
    let dirty = true;
    const bitmaps = typeof createImageBitmap === "function";

    const url = (k: number) => (k >= IDLE ? name(set, "i", k - IDLE) : name(set, "s", k));
    // Downloads: idle loop first (it's what you see on load), then the scroll frames, six at a time.
    const queue = [...Array.from({ length: set.idle }, (_, i) => IDLE + i), ...loadOrder(set.count)];
    const fetcher = async () => {
      while (alive && queue.length) {
        const k = queue.shift()!;
        try {
          const r = await fetch(url(k));
          if (r.ok) blobs.set(k, await r.blob());
          dirty = true;
        } catch {
          // a missing frame just means its neighbour is shown
        }
      }
    };
    for (let n = 0; n < 6; n++) void fetcher();

    const decode = (k: number) => {
      const b = blobs.get(k);
      if (!b || pending.has(k) || ready.has(k)) return;
      pending.add(k);
      const done = (d?: Drawable) => {
        pending.delete(k);
        if (!alive) return void (d instanceof ImageBitmap && d.close());
        if (d) ready.set(k, d);
        dirty = true;
      };
      if (bitmaps) createImageBitmap(b).then(done, () => done());
      else {
        const img = new Image();
        img.src = URL.createObjectURL(b);
        img.decode().then(() => done(img), () => done());
      }
    };
    /** Keep the frames in `want` decoded; drop the rest once the cache is full. */
    const keep = (want: number[], hold: (k: number) => boolean) => {
      let inflight = pending.size;
      for (const k of want) {
        if (inflight >= 3) break;
        if (!ready.has(k) && !pending.has(k) && blobs.has(k)) {
          decode(k);
          inflight++;
        }
      }
      if (ready.size > 36)
        for (const [k, d] of ready)
          if (!hold(k)) {
            if (d instanceof ImageBitmap) d.close();
            ready.delete(k);
            if (ready.size <= 28) break;
          }
    };

    // The canvas is exactly one frame big and CSS covers the viewport with it.
    canvas.width = set.w;
    canvas.height = set.h;

    const nearest = (i: number) => {
      for (let d = 0; d < set.count; d++) {
        const a = ready.get(i - d) ?? ready.get(i + d);
        if (a) return a;
      }
      return ready.get(IDLE);
    };
    let shown = false;
    const draw = (img: Drawable | undefined, alpha = 1) => {
      if (!img) return;
      if (!shown) {
        shown = true;
        readyCb.current?.();
      }
      g.globalAlpha = alpha;
      g.drawImage(img, 0, 0);
    };

    let cur = progress() * (set.count - 1);
    let dir = 1;
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
      if (Math.abs(diff) > 0.01) dir = Math.sign(diff);
      cur = Math.abs(diff) < 0.002 ? target : cur + diff * (1 - Math.exp(-dt * 10));
      const i = Math.floor(cur);
      const atTop = cur < 0.02 && target < 0.02;
      // Decode ahead in the direction of travel, a few behind.
      const want: number[] = [];
      for (let d = 0; d <= 10; d++) want.push(i + d * dir);
      for (let d = 1; d <= 4; d++) want.push(i - d * dir);
      const scroll = want.filter((k) => k >= 0 && k < set.count);
      if (atTop) {
        // At the top: loop the teacher talking and her voice flowing, 48 frames over 4 s.
        const f = (((now - t0) / 1000) * 12) % set.idle;
        const k = Math.floor(f);
        const loop = Array.from({ length: 6 }, (_, d) => IDLE + ((k + d) % set.idle));
        keep([...loop, ...scroll.slice(0, 4)], (x) => loop.includes(x) || (x >= 0 && x < 8));
        const a = ready.get(IDLE + k);
        if (a) {
          draw(a, 1);
          draw(ready.get(IDLE + ((k + 1) % set.idle)), f - k);
          dirty = true;
          frameCb.current?.(0);
          return;
        }
      } else keep(scroll, (x) => x < IDLE && Math.abs(x - i) <= 14);
      if (!dirty && Math.abs(diff) < 0.002) return;
      dirty = false;
      const a = ready.get(i);
      draw(a ?? nearest(i), 1);
      const b = ready.get(i + 1);
      if (a && b) draw(b, cur - i);
      frameCb.current?.(cur);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      for (const d of ready.values()) if (d instanceof ImageBitmap) d.close();
    };
  }, [progress, set]);

  return <canvas ref={ref} className={`block h-full w-full object-cover ${className}`} />;
}

/** The CSS matrix3d that lays a w×h box onto the quad (TL, TR, BR, BL), like a texture on the 3D screen. */
export function quadMatrix(w: number, h: number, q: number[]) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  // Square-to-quad homography (Heckbert), then scaled from the w×h box.
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / den;
  const hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  // u = x / w, v = y / h
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((n) => +n.toFixed(8)).join(",")})`;
}
