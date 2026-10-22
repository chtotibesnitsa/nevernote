// Shown when WebGL isn't available (hardware acceleration off, old GPU, some
// in-app browsers): the same story told flat. A laptop running Nevernote, the
// live transcript filling in beside the essay, and the recording pill.
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { drawScreen } from "./screen.ts";

export function FlatHero({ progress }: { progress: () => number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext("2d")!;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      drawScreen(g, c.width, c.height, (now - start) / 1000);
      // Zoom in as the page scrolls, like the camera does in 3D.
      const p = Math.min(1, progress() * 1.4);
      if (wrap.current) wrap.current.style.transform = `translateY(${(1 - p) * 6 + p * 4}vh) scale(${0.8 + p * 0.1})`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [progress]);
  const { scrollY } = useScroll();
  const glow = useTransform(scrollY, [0, 900], [0, 80]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div style={{ y: glow }} className="liquid pointer-events-none absolute left-1/2 top-[45%] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(240_162_90/0.4),transparent_62%)] blur-3xl" />
      <div ref={wrap} className="absolute inset-x-0 bottom-[6vh] mx-auto w-[min(92vw,980px)] origin-bottom will-change-transform">
        <div className="rounded-[26px] border border-white/70 bg-gradient-to-b from-[#d7d9de] to-[#b9bcc2] p-[10px] shadow-[0_50px_100px_-40px_rgb(60_40_20/0.6)]">
          <canvas ref={canvas} width={1024} height={640} className="block w-full rounded-[16px]" />
        </div>
        <div className="mx-auto h-3 w-[108%] -translate-x-[4%] rounded-b-[24px] bg-gradient-to-b from-[#c8cad0] to-[#a9acb3] shadow-[0_20px_30px_-12px_rgb(0_0_0/0.35)]" />
      </div>
    </div>
  );
}
