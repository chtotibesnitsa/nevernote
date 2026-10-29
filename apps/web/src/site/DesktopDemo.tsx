// The student's laptop screen from the hero, as real HTML: NoteLater recording
// class, with notes taken from the board on the left and everything the
// teacher says on the right. The 3D scene uses a screenshot of this exact
// component as the laptop texture, so the hand-off from frames to page is seamless.
import { useEffect, useRef, useState } from "react";

const W = 1024;
const H = 640;

const SPEAKER = {
  teacher: { name: "Ms. Rivera", c: "#ff7a2f" },
  jordan: { name: "Jordan", c: "#3b7bff" },
  sam: { name: "Sam", c: "#8e8e93" },
} as const;
type Who = keyof typeof SPEAKER;

const LINES: { who: Who; t: string; at: string; tag?: string }[] = [
  { who: "teacher", at: "10:38", t: "Carbon moves from the air, into plants, into the soil, and eventually into rock." },
  { who: "jordan", at: "10:39", t: "So limestone is a carbon sink?" },
  { who: "teacher", at: "10:39", t: "Exactly. Limestone holds on to carbon for millions of years." },
  { who: "teacher", at: "10:41", t: "Your lab report is due Friday at 11:59 PM, on Canvas.", tag: "Due Fri 11:59 PM" },
  { who: "sam", at: "10:42", t: "Is the nitrogen cycle on the test too?" },
  { who: "teacher", at: "10:42", t: "Yes, the nitrogen cycle will be on the test.", tag: "On the test" },
];
// What keeps arriving once the page takes over from the frames.
const MORE: { who: Who; t: string; tag?: string }[] = [
  { who: "teacher", t: "Decomposition releases carbon back into the air, so it's a source, not a sink." },
  { who: "jordan", t: "Will you post the slides?" },
  { who: "teacher", t: "Slides go up tonight. Read chapter 9 before Monday.", tag: "Read ch. 9 by Mon" },
];

const NOTES: { h?: string; b?: string; flag?: string }[] = [
  { h: "The carbon cycle" },
  { b: "Carbon moves air → plants → soil → rock" },
  { b: "Limestone stores carbon for millions of years (a long-term sink)" },
  { b: "Fossil fuels: coal, oil and natural gas" },
  { h: "Coming up" },
  { flag: "Lab report due Fri 11:59 PM on Canvas" },
  { flag: "Test covers the nitrogen cycle too" },
];

function Waves({ live }: { live: boolean }) {
  return (
    <span className="flex h-[14px] items-center gap-[2px]">
      {[5, 9, 13, 8, 11, 6, 10, 7].map((h, i) => (
        <span key={i} className={`w-[2px] rounded-full bg-[#ff3b30] ${live ? "nn-eq" : ""}`} style={{ height: h, animationDelay: `${i * 0.09}s` }} />
      ))}
    </span>
  );
}

/** A 1024×640 macOS desktop, scaled to whatever box it's put in. */
export function DesktopDemo({ live = false, className = "" }: { live?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [extra, setExtra] = useState(0);
  const [sec, setSec] = useState(12 * 60 + 48);
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => setSec((s) => s + 1), 1000);
    const add = setInterval(() => setExtra((n) => (n < MORE.length ? n + 1 : n)), 2600);
    return () => {
      clearInterval(tick);
      clearInterval(add);
    };
  }, [live]);
  const lines = [...LINES.map((l) => ({ ...l })), ...MORE.slice(0, extra).map((l) => ({ ...l, at: "10:43" }))].slice(-6);
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div ref={box} className={`relative aspect-[16/10] w-full overflow-hidden ${className}`}>
      <div className="absolute left-0 top-0 origin-top-left font-[Inter_Variable,Inter,system-ui] text-[#1d1d1f] antialiased" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {/* wallpaper */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#e9ecf2_0%,#d3d8e2_45%,#bcc3d0_100%)]" />
        <div className="absolute -left-20 top-40 h-[420px] w-[620px] rounded-full bg-[#c9d3e6] opacity-70 blur-3xl" />
        {/* menu bar */}
        <div className="absolute inset-x-0 top-0 flex h-[24px] items-center gap-4 bg-white/45 px-4 text-[12px] backdrop-blur-xl">
          <svg width="12" height="14" viewBox="0 0 17 20" aria-hidden><path fill="#1d1d1f" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.9 1 7.5c-1.9 3.2-.5 8 1.3 10.6.9 1.3 2 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-4.5zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" /></svg>
          <span className="font-semibold">NoteLater</span>
          {["File", "Edit", "View", "Window"].map((m) => <span key={m}>{m}</span>)}
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#ff3b30]/12 px-2 py-[1px] font-medium text-[#d70015]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff3b30]" /> {clock}
          </span>
          <span>Fri 10:43</span>
        </div>

        {/* app window */}
        <div className="absolute left-[44px] top-[44px] flex h-[540px] w-[936px] overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_30px_80px_-20px_rgb(20_30_60/0.45),0_0_0_0.5px_rgb(0_0_0/0.08)]">
          {/* sidebar */}
          <div className="flex w-[176px] shrink-0 flex-col bg-[#f2f2f5]/90 px-3 pt-3">
            <div className="flex gap-[7px] pb-5 pl-1">
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-[11px] w-[11px] rounded-full" style={{ background: c }} />)}
            </div>
            <div className="flex items-center gap-2 px-1 pb-4">
              <svg width="20" height="20" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="15" fill="#1d1d1f" /><path d="M15 43.5V20.5L31 43.5V20.5V43.5H48" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinejoin="round" strokeLinecap="round" /><circle cx="47" cy="24" r="3.6" fill="#ff3b30" /></svg>
              <span className="text-[15px] font-semibold tracking-tight">NoteLater</span>
            </div>
            {["Home", "Notes", "Insights", "Settings"].map((n, i) => (
              <div key={n} className={`rounded-[8px] px-2.5 py-[6px] text-[13px] ${i === 1 ? "bg-white font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-[#6e6e73]"}`}>{n}</div>
            ))}
            <div className="mt-5 px-2.5 text-[11px] font-medium text-[#86868b]">Classes</div>
            {["Biology", "AP US History", "Calculus BC", "Chemistry"].map((n, i) => (
              <div key={n} className={`mt-0.5 rounded-[8px] px-2.5 py-[5px] text-[13px] ${i === 0 ? "text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{n}</div>
            ))}
          </div>

          {/* main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-black/[0.06] px-6 pb-3.5 pt-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] text-[#86868b]">Biology · Today, 10:30</div>
                <div className="text-[21px] font-semibold tracking-[-0.02em]">The carbon cycle</div>
              </div>
              <div className="flex -space-x-1.5">
                {(["teacher", "jordan", "sam"] as Who[]).map((w) => (
                  <span key={w} className="grid h-[24px] w-[24px] place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white" style={{ background: SPEAKER[w].c }}>{SPEAKER[w].name[0]}</span>
                ))}
              </div>
              <span className="flex items-center gap-2 rounded-full bg-[#1d1d1f] py-[6px] pl-3 pr-3.5 text-[12.5px] font-medium text-white">
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inset-0 rounded-full bg-[#ff3b30] ${live ? "animate-ping" : ""}`} />
                  <span className="relative h-2 w-2 rounded-full bg-[#ff3b30]" />
                </span>
                Recording {clock}
              </span>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.08fr]">
              {/* notes from the board */}
              <div className="border-r border-black/[0.06] px-6 py-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Notes <span className="font-normal normal-case tracking-normal">· from the board and what she said</span></div>
                {NOTES.map((n, i) =>
                  n.h ? (
                    <div key={i} className="mb-1.5 mt-3 text-[15px] font-semibold tracking-[-0.01em]">{n.h}</div>
                  ) : n.b ? (
                    <div key={i} className="flex gap-2 py-[3px] text-[13.5px] leading-[1.45] text-[#3a3a3c]"><span className="mt-[8px] h-[4px] w-[4px] shrink-0 rounded-full bg-[#aeaeb2]" />{n.b}</div>
                  ) : (
                    <div key={i} className="mt-1.5 flex items-center gap-2.5 rounded-[10px] bg-[#f5f5f7] px-3 py-2 text-[13px] font-medium">
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#ff3b30]" />
                      {n.flag}
                    </div>
                  ),
                )}
              </div>

              {/* live transcript */}
              <div className="flex min-h-0 flex-col px-5 py-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                  Live transcript <span className="ml-auto"><Waves live={live} /></span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden">
                  {lines.map((l, i) => (
                    <div key={`${l.t}`} className={`${live && i === lines.length - 1 && extra ? "nn-line-in" : ""}`}>
                      <div className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: SPEAKER[l.who].c }} />
                        <span className="font-semibold">{SPEAKER[l.who].name}</span>
                        <span className="text-[#aeaeb2]">{l.at}</span>
                      </div>
                      <div className="mt-0.5 pl-[13px] text-[13.5px] leading-[1.45] text-[#3a3a3c]">
                        {l.t}
                        {l.tag && <span className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-[#1d1d1f] px-2 py-[1px] text-[10.5px] font-medium text-white">{l.tag}</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 pl-[13px] text-[13px] text-[#aeaeb2]">
                    Listening <span className={`inline-block h-[14px] w-[1.5px] bg-[#1d1d1f] ${live ? "nn-caret" : ""}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* dock */}
        <div className="absolute bottom-[6px] left-1/2 flex -translate-x-1/2 gap-2 rounded-[16px] border border-white/60 bg-white/40 px-2.5 py-1.5 backdrop-blur-xl">
          {["#1d1d1f", "#3b7bff", "#34c759", "#ff9f0a", "#af52de", "#8e8e93"].map((c, i) => (
            <span key={c} className="h-[26px] w-[26px] rounded-[7px] shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" style={{ background: i ? `linear-gradient(180deg, ${c}cc, ${c})` : c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
