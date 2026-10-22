// Realistic device frames (titanium iPhone, aluminium MacBook, a Windows laptop and
// a browser window) and the download cards with their install walkthrough.
import { Apple, Check, Download, Globe, Monitor, Smartphone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { soft, spring } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";

const fade = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: soft };

/** iPhone 16 Pro style: brushed titanium band, side buttons, black bezel, Dynamic Island. */
export function IPhone({ children, className = "", small }: { children: ReactNode; className?: string; small?: boolean }) {
  const r = small ? 30 : 58;
  const band = small ? 3 : 5;
  const bezel = small ? 4 : 8;
  return (
    <div className={`relative ${className}`}>
      {/* side buttons */}
      <span className="absolute -left-[2px] top-[17%] h-[5%] w-[3px] rounded-l bg-[linear-gradient(90deg,#8d8a86,#c9c6c1)]" />
      <span className="absolute -left-[2px] top-[25%] h-[9%] w-[3px] rounded-l bg-[linear-gradient(90deg,#8d8a86,#c9c6c1)]" />
      <span className="absolute -left-[2px] top-[36%] h-[9%] w-[3px] rounded-l bg-[linear-gradient(90deg,#8d8a86,#c9c6c1)]" />
      <span className="absolute -right-[2px] top-[28%] h-[13%] w-[3px] rounded-r bg-[linear-gradient(270deg,#8d8a86,#c9c6c1)]" />
      <div
        className="relative shadow-[0_60px_100px_-40px_rgb(0_0_0/0.55),0_20px_40px_-20px_rgb(0_0_0/0.3)]"
        style={{
          borderRadius: r,
          padding: band,
          background: "linear-gradient(135deg,#d9d6d1 0%,#a7a39d 18%,#eceae6 34%,#8f8b85 52%,#cfccc6 70%,#9c9892 86%,#e2dfda 100%)",
        }}
      >
        <div className="relative bg-black" style={{ borderRadius: r - band, padding: bezel, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)" }}>
          <div className="relative overflow-hidden bg-white" style={{ borderRadius: r - band - bezel }}>
            <div className={`absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black ${small ? "top-[5px] h-[10px] w-[34%]" : "top-[11px] h-[30px] w-[32%]"}`}>
              <span className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b4a6b,#0b0d14_60%)] ${small ? "right-[8%] h-[5px] w-[5px]" : "right-[10%] h-[11px] w-[11px]"}`} />
            </div>
            {children}
          </div>
          {/* glass glare */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.16)_0%,transparent_30%,transparent_70%,rgb(255_255_255/0.05)_100%)]" style={{ borderRadius: r - band }} />
        </div>
      </div>
    </div>
  );
}

/** MacBook Pro style: thin black bezel with a notch, aluminium deck with the finger notch. */
export function MacBook({ src, alt, children }: { src?: string; alt?: string; children?: ReactNode }) {
  return (
    <div className="relative">
      <div className="relative mx-auto w-[88%] rounded-t-[3.2%_5%] rounded-b-[4px] bg-[linear-gradient(180deg,#2a2a2c,#111)] p-[1.6%] pb-[2.2%] shadow-[inset_0_0_0_1.5px_#3a3a3c,inset_0_0_0_3px_#0b0b0c]">
        <div className="absolute left-1/2 top-[1.6%] z-10 h-[2.6%] w-[11%] -translate-x-1/2 rounded-b-[8px] bg-[#111]">
          <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f2a44]" />
        </div>
        <div className="relative overflow-hidden rounded-[6px] bg-white">
          {src ? <img src={src} alt={alt} className="block aspect-[16/10] w-full object-cover object-top" loading="lazy" /> : children}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgb(255_255_255/0.18),transparent_35%)]" />
        </div>
      </div>
      {/* hinge and deck */}
      <div className="relative mx-auto h-[10px] w-[88%] bg-[linear-gradient(180deg,#5a5a5e,#2b2b2e)]" style={{ clipPath: "polygon(1% 0,99% 0,100% 100%,0 100%)" }} />
      <div className="relative h-[16px] rounded-b-[18px] rounded-t-[3px] bg-[linear-gradient(180deg,#f2f2f4_0%,#d4d4d8_45%,#a9a9ae_100%)] shadow-[0_40px_60px_-24px_rgb(0_0_0/0.5),inset_0_1px_0_#fff]">
        <div className="mx-auto h-[6px] w-[15%] rounded-b-[8px] bg-[linear-gradient(180deg,#b9b9be,#d6d6da)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]" />
      </div>
    </div>
  );
}

/** A Windows laptop: dark graphite lid, square corners, taskbar along the bottom. */
function WinLaptop({ src }: { src: string }) {
  return (
    <div className="relative">
      <div className="mx-auto w-[90%] rounded-[6px] bg-[linear-gradient(180deg,#3a3d42,#1d1f22)] p-[2.2%] shadow-[inset_0_0_0_1px_#55595f]">
        <div className="relative overflow-hidden rounded-[2px] bg-white">
          <img src={src} alt="" loading="lazy" className="block aspect-[16/10] w-full object-cover object-top" />
          <div className="absolute inset-x-0 bottom-0 flex h-[7%] items-center justify-center gap-[3%] bg-[#f3f3f3]/90 backdrop-blur">
            {["#0078d4", "#1d1d1f", "#ffb900", "#107c10"].map((c) => (
              <span key={c} className="h-[45%] rounded-[2px]" style={{ background: c, aspectRatio: "1" }} />
            ))}
          </div>
        </div>
      </div>
      <div className="h-[9px] rounded-b-[10px] bg-[linear-gradient(180deg,#5d6167,#2e3135)] shadow-[0_30px_40px_-20px_rgb(0_0_0/0.5)]" />
    </div>
  );
}

/** A browser window: traffic lights, a tab and the address bar. */
function BrowserWindow({ src }: { src: string }) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_30px_50px_-24px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)]">
      <div className="flex items-center gap-[5px] bg-[#ececef] px-2.5 py-2">
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 flex-1 truncate rounded-[6px] bg-white px-2 py-[2px] text-center text-[9px] text-[#6e6e73]">nevernote.app/app</span>
      </div>
      <img src={src} alt="" loading="lazy" className="block aspect-[16/10] w-full object-cover object-top" />
    </div>
  );
}

// ---------- downloads ----------

type Os = "mac" | "win" | "ios" | "web";
interface Asset {
  name: string;
  browser_download_url: string;
  size: number;
}

/** The latest release's installers, straight from GitHub. Null until loaded or when there's no release yet. */
function useRelease() {
  const [r, setR] = useState<{ version: string; assets: Asset[] } | null>(null);
  useEffect(() => {
    const repo = GITHUB_REPO.replace("https://github.com/", "");
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then((x) => (x.ok ? x.json() : null))
      .then((j) => j && setR({ version: j.tag_name, assets: j.assets ?? [] }))
      .catch(() => {});
  }, []);
  return r;
}

const pick = (assets: Asset[], test: (n: string) => boolean) => assets.find((a) => test(a.name.toLowerCase()) && !a.name.endsWith(".blockmap"));
const mb = (a?: Asset) => (a ? `${Math.round(a.size / 1e6)} MB` : "");

const STEPS: Record<Os, { title: string; steps: string[] }> = {
  mac: {
    title: "Installing on your Mac",
    steps: ["Open Nevernote.dmg from your Downloads.", "Drag Nevernote into the Applications folder.", "First time only: right-click Nevernote in Applications and choose Open, then Open again.", "Hit record. The speech model downloads once, then everything runs offline."],
  },
  win: {
    title: "Installing on Windows",
    steps: ["Open Nevernote Setup.exe from your Downloads.", "If Windows shows \"Windows protected your PC\", click More info, then Run anyway.", "Nevernote installs and opens by itself, with a shortcut on your desktop.", "Hit record. The speech model downloads once, then everything runs offline."],
  },
  ios: {
    title: "On iPhone and iPad",
    steps: ["The App Store app is on its way.", "Until then, open nevernote in Safari.", "Tap Share, then Add to Home Screen.", "Open it from your Home Screen and hit record."],
  },
  web: { title: "", steps: [] },
};

function Press({ children, onClick, dark }: { children: ReactNode; onClick: () => void; dark?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ y: 3, scale: 0.97 }}
      transition={spring}
      onClick={onClick}
      className={`relative inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold tracking-tight ${
        dark
          ? "bg-[linear-gradient(180deg,#48484a,#1d1d1f)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_-2px_0_rgb(0_0_0/0.4),0_4px_0_#000,0_14px_24px_-10px_rgb(0_0_0/0.55)] active:shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_0_#000,0_6px_12px_-8px_rgb(0_0_0/0.5)]"
          : "bg-[linear-gradient(180deg,#ffffff,#e9e9ee)] text-[#1d1d1f] shadow-[inset_0_1px_0_#fff,inset_0_-2px_0_rgb(0_0_0/0.06),0_4px_0_#c7c7cc,0_14px_24px_-12px_rgb(0_0_0/0.35)] active:shadow-[inset_0_1px_0_#fff,0_1px_0_#c7c7cc,0_6px_12px_-8px_rgb(0_0_0/0.3)]"
      }`}
    >
      {children}
    </motion.button>
  );
}

function InstallSheet({ os, onClose, file }: { os: Os; onClose: () => void; file?: string }) {
  const s = STEPS[os];
  const [step, setStep] = useState(0);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const t = setInterval(() => setStep((k) => Math.min(s.steps.length, k + 1)), 700);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    addEventListener("keydown", esc);
    return () => {
      clearInterval(t);
      removeEventListener("keydown", esc);
    };
  }, [s.steps.length]);
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.94, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[460px] rounded-[30px] bg-white/90 p-7 text-[#1d1d1f] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.5),inset_0_1px_0_#fff] ring-1 ring-black/5 backdrop-blur-2xl"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/5 text-[#424245] transition hover:bg-black/10">
          <X size={15} />
        </button>
        {file && (
          <div className="flex items-center gap-3">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.1 }} className="grid h-11 w-11 place-items-center rounded-full bg-[#1d1d1f] text-white">
              <Check size={20} strokeWidth={3} />
            </motion.span>
            <div>
              <div className="text-[17px] font-semibold tracking-tight">Download started</div>
              <div className="text-[13px] text-[#6e6e73]">{file}</div>
            </div>
          </div>
        )}
        <div className={`${file ? "mt-6" : ""} text-[15px] font-semibold tracking-tight`}>{s.title}</div>
        <ol className="mt-3 space-y-2.5">
          {s.steps.map((t, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= step ? 1 : 0.25, x: 0 }} transition={{ ...soft, delay: i * 0.05 }} className="flex gap-3 text-[14.5px] leading-snug text-[#1d1d1f]">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition ${i < step ? "bg-[#1d1d1f] text-white" : "bg-black/[0.06] text-[#424245]"}`}>{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              {t}
            </motion.li>
          ))}
        </ol>
        <div className="mt-6">
          <Press dark onClick={onClose}>Got it</Press>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

const CARDS: { os: Os; icon: typeof Apple; name: string; note: string; cta: string }[] = [
  { os: "mac", icon: Apple, name: "Mac", note: "Apple Silicon and Intel · macOS 12+", cta: "Download" },
  { os: "win", icon: Monitor, name: "Windows", note: "Windows 10 and 11", cta: "Download" },
  { os: "ios", icon: Smartphone, name: "iPhone and iPad", note: "App Store soon · works in Safari now", cta: "Get it" },
  { os: "web", icon: Globe, name: "Web", note: "Nothing to install, any browser", cta: "Open" },
];

function Art({ os }: { os: Os }) {
  if (os === "mac")
    return (
      <motion.div className="w-[80%]" whileHover={{ rotateX: 8, y: -4 }} transition={spring} style={{ transformPerspective: 800 }}>
        <MacBook src="/shots/mac.webp" alt="" />
      </motion.div>
    );
  if (os === "win")
    return (
      <motion.div className="w-[80%]" whileHover={{ rotateY: -10, y: -4 }} transition={spring} style={{ transformPerspective: 800 }}>
        <WinLaptop src="/shots/windows.webp" />
      </motion.div>
    );
  if (os === "ios")
    return (
      <motion.div className="mt-6 w-[34%]" whileHover={{ y: -10, rotateZ: -4 }} transition={spring}>
        <IPhone small>
          <img src="/shots/iphone.webp" alt="" loading="lazy" className="block aspect-[390/844] w-full object-cover object-top" />
        </IPhone>
      </motion.div>
    );
  return (
    <motion.div className="w-[82%]" whileHover={{ scale: 1.04, y: -4 }} transition={spring}>
      <BrowserWindow src="/shots/web.webp" />
    </motion.div>
  );
}

const TINT: Record<Os, string> = {
  mac: "radial-gradient(90% 80% at 50% 0%,#eef1f7,#dfe3ec)",
  win: "radial-gradient(90% 80% at 50% 0%,#e9f2fb,#d8e5f3)",
  ios: "radial-gradient(90% 80% at 50% 0%,#f4f0ea,#e7e1d8)",
  web: "radial-gradient(90% 80% at 50% 0%,#eef4ef,#dde8df)",
};

export function Downloads() {
  const release = useRelease();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<{ os: Os; file?: string } | null>(null);
  const go = (os: Os) => {
    if (os === "web") return nav("/app");
    if (os === "ios") return setSheet({ os });
    const a = release?.assets ?? [];
    let asset: Asset | undefined;
    if (os === "win") asset = pick(a, (n) => n.endsWith(".exe"));
    else {
      // Browsers report every Mac as "Intel", so default to Apple Silicon (every Mac since 2020); Intel has its own button.
      asset = pick(a, (n) => n.endsWith(".dmg") && n.includes("arm64")) ?? pick(a, (n) => n.endsWith(".dmg"));
    }
    if (asset) location.href = asset.browser_download_url;
    else window.open(RELEASES, "_blank", "noopener");
    setSheet({ os, file: asset ? `${asset.name} · ${mb(asset)}` : "Pick your file on the release page" });
  };
  const intelMac = release && pick(release.assets, (n) => n.endsWith(".dmg") && !n.includes("arm64"));
  return (
    <>
      <div className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c, i) => (
          <motion.div key={c.os} {...fade} transition={{ ...soft, delay: i * 0.06 }} className="card group flex h-full flex-col p-2.5">
            <div className="relative grid h-[190px] place-items-center overflow-hidden rounded-[20px] [perspective:900px]" style={{ background: TINT[c.os] }}>
              <Art os={c.os} />
            </div>
            <div className="flex items-center gap-2.5 px-2 pt-4">
              <span className="lglass grid h-9 w-9 place-items-center rounded-[11px] text-[#1d1d1f]">
                <c.icon size={18} />
              </span>
              <div>
                <div className="text-[17px] font-semibold leading-tight tracking-tight">{c.name}</div>
                <div className="text-[12.5px] text-[#6e6e73]">{c.note}</div>
                {c.os === "mac" && intelMac && (
                  <button onClick={() => { location.href = intelMac.browser_download_url; setSheet({ os: "mac", file: `${intelMac.name} · ${mb(intelMac)}` }); }} className="mt-1 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[12px] font-medium text-[#424245] transition hover:bg-black/[0.08]">
                    Intel Mac build
                  </button>
                )}
              </div>
            </div>
            <div className="mt-auto px-2 pb-2 pt-5">
              <Press dark={c.os === "mac" || c.os === "win"} onClick={() => go(c.os)}>
                {c.os === "mac" || c.os === "win" ? <Download size={16} strokeWidth={2.5} /> : <c.icon size={16} />}
                {c.cta}
              </Press>
            </div>
          </motion.div>
        ))}
      </div>
      {release && <p className="mt-4 text-center text-[12.5px] text-[#6e6e73]">Latest version {release.version}. Free and open source.</p>}
      <AnimatePresence>{sheet && <InstallSheet os={sheet.os} file={sheet.file} onClose={() => setSheet(null)} />}</AnimatePresence>
    </>
  );
}
