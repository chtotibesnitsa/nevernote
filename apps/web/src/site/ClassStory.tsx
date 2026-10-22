// The front-page animation, in CSS 3D so it runs on every browser (no WebGL):
// a classroom seen from the back row, the teacher's voice rippling out across
// the floor, one student working on their own laptop. As you scroll the camera
// drops in over their shoulder and the screen takes over: the Nevernote
// recording that lets them do it.
import { Hand, Moon, Pencil, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawScreen } from "./screen.ts";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

type Mood = "idle" | "phone" | "sleep" | "hand" | "doodle" | "you";
interface Kid { x: number; y: number; hair: string; shirt: string; mood: Mood }

const COLS = [-270, -90, 90, 270];
const ROWS = [-120, 40, 200];
const HAIR = ["#2b2118", "#6b3f23", "#d9a441", "#16110e", "#8b4a2b", "#3a2a22"];
const SHIRT = ["#4f7fb5", "#6b9f7a", "#8a7fc0", "#c26a6a", "#5d6b7a", "#b58a4f", "#4a9a98"];
const MOODS: Mood[] = ["phone", "idle", "sleep", "doodle", "idle", "hand", "phone", "idle", "doodle", "sleep", "idle", "phone"];
const HERO = { x: 90, y: 200 };

const KIDS: Kid[] = ROWS.flatMap((y, r) =>
  COLS.map((x, c) => {
    const i = r * COLS.length + c;
    const you = x === HERO.x && y === HERO.y;
    return { x, y, hair: you ? "#2a1d14" : HAIR[i % HAIR.length], shirt: you ? "#f0a25a" : SHIRT[(i * 3) % SHIRT.length], mood: you ? "you" : MOODS[i] } as Kid;
  }),
);

/** A student from behind: hair, shoulders, and what they're up to. */
function Kid({ hair, shirt, mood }: Pick<Kid, "hair" | "shirt" | "mood">) {
  const head = mood === "sleep" ? 22 : mood === "phone" ? 12 : 0;
  return (
    <svg viewBox="0 0 90 150" width="90" height="150" className={mood === "idle" ? "nn-sway" : ""} style={{ overflow: "visible" }}>
      <ellipse cx="45" cy="146" rx="30" ry="5" fill="rgb(0 0 0 / .18)" />
      {/* chair back */}
      <rect x="20" y="70" width="50" height="52" rx="10" fill="#8d6a4a" />
      {/* body */}
      <path d="M14 150 C10 100 22 78 45 76 C68 78 80 100 76 150 Z" fill={shirt} />
      {mood === "you" && <path d="M28 82 C34 94 56 94 62 82 C58 76 32 76 28 82Z" fill="#e0893c" />}
      {mood === "hand" && <rect x="64" y="20" width="12" height="62" rx="6" fill={shirt} className="nn-wave" style={{ transformOrigin: "70px 82px" }} />}
      <g style={{ transform: `translateY(${head}px)`, transformOrigin: "45px 70px" }}>
        <rect x="38" y="62" width="14" height="16" rx="6" fill="#e8b48a" />
        <ellipse cx="45" cy="46" rx="22" ry="25" fill={hair} />
        <ellipse cx="45" cy="30" rx="17" ry="9" fill="#fff" opacity=".1" />
        {mood === "you" && <path d="M26 44 C28 20 62 20 64 44" fill="none" stroke="#1c1915" strokeWidth="4" strokeLinecap="round" />}
        {mood === "you" && <rect x="20" y="40" width="9" height="16" rx="4.5" fill="#1c1915" />}
        {mood === "you" && <rect x="61" y="40" width="9" height="16" rx="4.5" fill="#1c1915" />}
      </g>
    </svg>
  );
}

function Teacher() {
  return (
    <svg viewBox="0 0 110 190" width="110" height="190" style={{ overflow: "visible" }}>
      <ellipse cx="55" cy="186" rx="34" ry="6" fill="rgb(0 0 0 / .2)" />
      <rect x="36" y="140" width="14" height="46" rx="6" fill="#3a3a48" />
      <rect x="58" y="140" width="14" height="46" rx="6" fill="#3a3a48" />
      <path d="M18 146 C14 98 30 80 55 78 C80 80 96 98 92 146 Z" fill="#d9772f" />
      <path d="M44 80 L55 108 L66 80Z" fill="#fff" />
      <rect x="66" y="104" width="22" height="12" rx="3" fill="#fff" stroke="#c8794a" />
      <rect x="82" y="60" width="12" height="62" rx="6" fill="#d9772f" className="nn-point" style={{ transformOrigin: "88px 118px" }} />
      <circle cx="88" cy="58" r="7" fill="#e8b48a" />
      <rect x="48" y="62" width="14" height="18" rx="6" fill="#e8b48a" />
      <ellipse cx="55" cy="46" rx="22" ry="25" fill="#e8b48a" />
      <path d="M31 44 C28 14 82 12 79 44 C70 28 44 26 31 44Z" fill="#3b2a20" />
      <circle cx="46" cy="48" r="2.6" fill="#1c1915" />
      <circle cx="64" cy="48" r="2.6" fill="#1c1915" />
      <ellipse cx="55" cy="60" rx="6" ry="4" fill="#9b3d2e" className="nn-talk" style={{ transformOrigin: "55px 60px" }} />
    </svg>
  );
}

const SCREEN = "linear-gradient(135deg,#dfe9ff,#f3dfff)";

function Laptop({ lit }: { lit?: boolean }) {
  return (
    <svg viewBox="0 0 70 52" width="70" height="52" style={{ overflow: "visible" }}>
      <rect x="6" y="2" width="58" height="38" rx="4" fill="#2b2b30" />
      <rect x="9" y="5" width="52" height="32" rx="2" fill={lit ? "#f6d9b8" : "#8fa6c9"} opacity={lit ? 1 : 0.85} />
      {!lit && <rect x="14" y="10" width="26" height="3" rx="1.5" fill="#fff" opacity=".6" />}
      {!lit && <rect x="14" y="17" width="38" height="3" rx="1.5" fill="#fff" opacity=".4" />}
      <path d="M0 42 H70 L66 49 H4Z" fill="#b9bcc2" />
    </svg>
  );
}

const MOOD_ICON = { phone: Smartphone, sleep: Moon, hand: Hand, doodle: Pencil } as const;

const LINES = ["Essay is due Thursday, 11:59 PM", "Quiz moved to Monday", "Units 7 and 8 are on it", "Bring your textbook tomorrow"];

export function ClassStory({ progress }: { progress: () => number }) {
  const root = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const flat = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const heroCanvas = useRef<HTMLCanvasElement>(null);
  const bigCanvas = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const el = root.current;
      if (!el) return;
      const p = progress();
      const W = el.clientWidth;
      const H = el.clientHeight;
      const s0 = clamp(Math.min(W / 1250, H / 760), 0.36, 1.05);
      const zoom = ease(clamp((p - 0.26) / 0.3));
      const rx = lerp(64, 50, zoom);
      const rz = lerp(-9, 5, ease(clamp(p / 0.5)));
      const s = s0 * (1 + 1.55 * zoom);
      // Pull the student to the middle of the frame as the camera drops in.
      const dx = -HERO.x * s0 * zoom * 1.1;
      const dy = -HERO.y * s0 * 0.5 * zoom;
      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--rz", `${rz}deg`);
      if (world.current) {
        world.current.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${s}) rotateX(${rx}deg) rotateZ(${rz}deg)`;
      }
      // Opacity lives outside the 3D group: fading a 3D group itself would flatten it.
      if (stage.current) stage.current.style.opacity = String(1 - ease(clamp((p - 0.5) / 0.1)));
      if (pill.current) pill.current.style.opacity = String(ease(clamp((p - 0.12) / 0.1)));
      // The screen takes over.
      const into = ease(clamp((p - 0.48) / 0.12));
      if (flat.current) {
        const settle = ease(clamp((p - 0.6) / 0.4));
        flat.current.style.opacity = String(into);
        flat.current.style.transform = `translateY(${lerp(14, 4, into) - settle * 2}vh) scale(${lerp(0.42, 0.86, into) + settle * 0.1})`;
        flat.current.style.pointerEvents = "none";
      }
      // Redraw the screens a few times a second.
      if (now - last > 66) {
        last = now;
        const t = (now - t0) / 1000;
        for (const c of [heroCanvas.current, bigCanvas.current]) {
          const g = c?.getContext("2d");
          if (c && g && (c === heroCanvas.current ? p < 0.62 : p > 0.44)) drawScreen(g, c.width, c.height, t);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  const rings = useMemo(() => [0, 0.8, 1.6, 2.4], []);
  // Everything that stands up faces the camera whatever angle it's at.
  const face = "rotateZ(calc(var(--rz) * -1)) rotateX(calc(var(--rx) * -1))";
  const stand = (x: number, y: number, z: number, w: number, h: number) =>
    ({ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: `translate3d(${x}px,${y}px,${z}px)`, transformStyle: "preserve-3d", ["--w" as string]: `${w}px`, ["--h" as string]: `${h}px` }) as React.CSSProperties;
  const bill = (w: number, h: number): React.CSSProperties => ({ position: "absolute", left: -w / 2, top: -h, width: w, height: h, transformOrigin: "50% 100%", transform: face });

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_70%,#ffe9cf_0%,transparent_70%)]" />
      <div ref={stage} className="absolute inset-0" style={{ perspective: "1700px", perspectiveOrigin: "50% 40%" }}>
      <div className="absolute left-1/2 top-[74%] h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
        <div ref={world} className="absolute left-0 top-0 h-0 w-0 will-change-transform" style={{ transformStyle: "preserve-3d", transformOrigin: `${HERO.x}px ${HERO.y}px` }}>
          {/* floor */}
          <div className="absolute rounded-[28px]" style={{ left: -620, top: -440, width: 1240, height: 880, background: "repeating-linear-gradient(90deg,#e9c796 0 70px,#e3bd88 70px 72px),linear-gradient(#e9c796,#ddb078)", boxShadow: "0 0 0 10px #c99a62, 0 40px 80px rgb(120 70 20 / .35)" }} />
          {/* voice ripples from the teacher */}
          <div className="absolute overflow-hidden rounded-[28px]" style={{ left: -620, top: -440, width: 1240, height: 880, transform: "translateZ(2px)" }}>
            {rings.map((d) => (
              <div key={d} className="nn-ring absolute rounded-full" style={{ left: 620, top: 110, width: 1700, height: 1700, border: "10px solid #ff8a1f", animationDelay: `${d}s` }} />
            ))}
          </div>
          {/* back wall + board */}
          <div style={stand(0, -430, 0, 1240, 280)}>
            <div style={bill(1240, 280)}>
              <div className="h-full w-full rounded-t-[22px]" style={{ background: "linear-gradient(#f6ead9,#efdcc3)", boxShadow: "inset 0 -10px 0 #d3b48a" }}>
                <div className="absolute left-1/2 top-8 h-[170px] w-[520px] -translate-x-1/2 rounded-xl border-[10px] border-[#8d6a4a] bg-[#25423a] p-5 text-left font-bold text-white/90">
                  <div className="text-[22px] text-[#ffd27a]">UNIT 7 · THE NEW DEAL</div>
                  <div className="mt-2 text-[17px] opacity-80">Essay due Thu · Quiz Mon</div>
                  <div className="mt-3 h-1.5 w-40 rounded bg-white/40" />
                  <div className="mt-2 h-1.5 w-56 rounded bg-white/30" />
                </div>
                {[-480, 480].map((x) => (
                  <div key={x} className="absolute top-12 h-[130px] w-[110px] rounded-lg border-[8px] border-[#d3b48a] bg-[#cfe6ff]" style={{ left: `calc(50% + ${x}px - 55px)` }} />
                ))}
              </div>
            </div>
          </div>
          {/* teacher */}
          <div style={stand(0, -340, 0, 110, 190)}>
            <div style={bill(110, 190)}>
              <Teacher />
              <div key={line} className="nn-pop absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border-2 border-[#1c1915] bg-white px-3 py-1.5 text-[15px] font-extrabold text-[#1c1915] shadow-[3px_3px_0_#1c1915]">
                {LINES[line]}
              </div>
            </div>
          </div>
          {/* desks + students */}
          {KIDS.map((k, i) => {
            const you = k.mood === "you";
            const Icon = k.mood !== "idle" && k.mood !== "you" ? MOOD_ICON[k.mood] : null;
            return (
              <div key={i} className="absolute left-0 top-0 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
                <div className="absolute rounded-xl bg-black/20 blur-md" style={{ left: k.x - 76, top: k.y - 44, width: 152, height: 100, transform: "translateZ(1px)" }} />
                <div style={stand(k.x, k.y + 38, 0, 126, 36)}>
                  <div style={bill(126, 34)} className="rounded-b-md bg-[#a8764a]" />
                </div>
                <div className="absolute rounded-lg" style={{ left: k.x - 66, top: k.y - 38, width: 132, height: 76, transform: "translateZ(34px)", background: "linear-gradient(#f2d09c,#e6b97c)", boxShadow: "0 0 0 4px #c99256" }} />
                <div style={stand(k.x, k.y - 4, 34, 70, 52)}>
                  <div style={bill(70, 52)}>
                    {you ? (
                      <div className="relative h-full w-full">
                        <div className="absolute inset-x-[7px] top-0 h-[40px] rounded-md border-[3px] border-[#2b2b30] bg-[#2b2b30]">
                          <canvas ref={heroCanvas} width={256} height={160} className="h-full w-full rounded-[3px]" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-[8px] rounded-b-md bg-[#b9bcc2]" />
                      </div>
                    ) : (
                      <Laptop />
                    )}
                  </div>
                </div>
                <div style={stand(k.x, k.y + 70, 0, 90, 150)}>
                  <div style={bill(90, 150)}>
                    <Kid hair={k.hair} shirt={k.shirt} mood={k.mood} />
                    {Icon && (
                      <div className="nn-bob absolute -top-9 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border-2 border-[#1c1915] bg-white shadow-[2px_2px_0_#1c1915]">
                        <Icon size={16} strokeWidth={2.6} />
                      </div>
                    )}
                  </div>
                </div>
                {you && (
                  <div style={stand(k.x, k.y + 70, 0, 150, 150)}>
                    <div style={bill(190, 150)}>
                      <div ref={pill} className="absolute -top-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 opacity-0">
                        <span className="whitespace-nowrap rounded-full border-2 border-[#1c1915] bg-[#ffd27a] px-3 py-1 text-[13px] font-extrabold text-[#1c1915] shadow-[3px_3px_0_#1c1915]">You, on your own work</span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-[#1c1915] bg-[#1c1915] px-3 py-1 text-[13px] font-extrabold text-white">
                          <span className="nn-blink h-2.5 w-2.5 rounded-full bg-[#ff3b30]" /> Nevernote is listening
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      </div>
      {/* the screen, up close */}
      <div ref={flat} className="absolute inset-x-0 bottom-[8vh] mx-auto w-[min(92vw,960px)] origin-bottom opacity-0 will-change-transform">
        <div className="rounded-[26px] border-[3px] border-[#1c1915] bg-gradient-to-b from-[#d7d9de] to-[#b9bcc2] p-[10px] shadow-[10px_10px_0_#1c1915]">
          <canvas ref={bigCanvas} width={1024} height={640} className="block w-full rounded-[16px]" />
        </div>
        <div className="mx-auto h-3 w-[108%] -translate-x-[4%] rounded-b-[24px] border-[3px] border-t-0 border-[#1c1915] bg-gradient-to-b from-[#c8cad0] to-[#a9acb3]" />
      </div>
    </div>
  );
}
