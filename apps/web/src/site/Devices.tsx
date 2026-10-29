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

/**
 * iPhone 16 Pro, to scale: a 393x852 screen in a brushed-steel band with chamfered
 * edges, the real button layout (action button and volume left, side button and
 * Camera Control right), antenna lines, Dynamic Island, status bar and home bar.
 * Everything is in percentages, so it stays a real phone at any width.
 */
export function IPhone({ children, className = "", small }: { children: ReactNode; className?: string; small?: boolean }) {
  const btn = "absolute w-[1.1%] bg-[linear-gradient(90deg,#6f6f73,#d9d9dc_45%,#8a8a8e)]";
  return (
    <div className={`relative aspect-[433/882] ${className}`}>
      {/* buttons */}
      <span className={`${btn} -left-[0.6%] top-[17.5%] h-[4.4%] rounded-l-[2px]`} />
      <span className={`${btn} -left-[0.6%] top-[24.5%] h-[7.6%] rounded-l-[2px]`} />
      <span className={`${btn} -left-[0.6%] top-[33.5%] h-[7.6%] rounded-l-[2px]`} />
      <span className={`${btn} -right-[0.6%] top-[27%] h-[11%] rounded-r-[2px]`} />
      <span className={`${btn} -right-[0.6%] top-[60%] h-[5.2%] rounded-r-[2px] opacity-80`} />
      {/* the steel band */}
      <div
        className="absolute inset-0 rounded-[17%/8.3%] p-[1.7%] shadow-[0_60px_90px_-40px_rgb(0_0_0/0.55),0_24px_40px_-24px_rgb(0_0_0/0.35)]"
        style={{
          background: "linear-gradient(100deg,#b9b9bd 0%,#f4f4f6 9%,#8d8d92 22%,#d6d6da 38%,#a2a2a7 55%,#efeff1 72%,#86868b 88%,#c8c8cc 100%)",
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.7), inset 0 0 0 2px rgb(0 0 0 / 0.18), inset 0 2px 3px rgb(255 255 255 / 0.6), 0 60px 90px -40px rgb(0 0 0 / 0.55), 0 24px 40px -24px rgb(0 0 0 / 0.35)",
        }}
      >
        {/* antenna lines */}
        <span className="absolute left-0 top-[11%] h-[0.5%] w-[1.7%] bg-[#6d6d72]/60" />
        <span className="absolute right-0 top-[11%] h-[0.5%] w-[1.7%] bg-[#6d6d72]/60" />
        <span className="absolute bottom-[11%] left-0 h-[0.5%] w-[1.7%] bg-[#6d6d72]/60" />
        <span className="absolute bottom-[11%] right-0 h-[0.5%] w-[1.7%] bg-[#6d6d72]/60" />
        {/* black glass with the screen inside */}
        <div className="relative h-full w-full rounded-[15.5%/7.5%] bg-black p-[3.2%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
          <div className="relative h-full w-full overflow-hidden rounded-[12.5%/5.9%] bg-white">
            {!small && <StatusBar />}
            <div className="absolute left-1/2 top-[1.25%] z-20 h-[4.1%] w-[31%] -translate-x-1/2 rounded-full bg-black">
              <span className="absolute right-[9%] top-1/2 h-[46%] aspect-square -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#3d4658,#0b0d12_62%)]" />
            </div>
            <div className="absolute inset-0">{children}</div>
            <div className="absolute bottom-[0.9%] left-1/2 z-20 h-[0.6%] min-h-[3px] w-[34%] -translate-x-1/2 rounded-full bg-black/85" />
          </div>
          {/* glass glare */}
          <div className="pointer-events-none absolute inset-0 rounded-[15.5%/7.5%] bg-[linear-gradient(118deg,rgb(255_255_255/0.14)_0%,transparent_28%,transparent_72%,rgb(255_255_255/0.05)_100%)]" />
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[6.2%] items-center justify-between px-[9%] pt-[1.2%] text-[15px] font-semibold tracking-tight text-black">
      <span className="w-[24%] text-center">9:41</span>
      <span className="flex w-[24%] items-center justify-center gap-[5px]">
        <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor" /></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden><path fill="currentColor" d="M8 2.2c2.2 0 4.2.9 5.7 2.3l1.1-1.1C13 1.6 10.6.6 8 .6S3 1.6 1.2 3.4l1.1 1.1C3.8 3.1 5.8 2.2 8 2.2zm0 3.2c1.3 0 2.5.5 3.4 1.3l1.1-1.1C11.3 4.5 9.7 3.8 8 3.8s-3.3.7-4.5 1.8l1.1 1.1c.9-.8 2.1-1.3 3.4-1.3zm0 3.2c-.5 0-1 .2-1.3.5L8 10.4l1.3-1.3c-.3-.3-.8-.5-1.3-.5z" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden><rect x="0.5" y="0.5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" /><path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill="currentColor" opacity="0.45" /></svg>
      </span>
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
        <span className="ml-2 flex-1 truncate rounded-[6px] bg-white px-2 py-[2px] text-center text-[9px] text-[#6e6e73]">notelater.com/app</span>
      </div>
      <img src={src} alt="" loading="lazy" className="block aspect-[16/10] w-full object-cover object-top" />
    </div>
  );
}

// ---------- downloads ----------

export type Os = "mac" | "win" | "ios" | "web";
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
    steps: [
      "Open NoteLater.dmg from your Downloads and drag NoteLater into Applications.",
      "Open NoteLater from Applications. The first time, macOS says it can't check the developer: click Done.",
      "Open System Settings, then Privacy & Security, scroll down and click Open Anyway next to NoteLater. Confirm with your password or Touch ID.",
      "NoteLater opens, and from now on it opens like any other app. Sign in with Google and hit record.",
    ],
  },
  win: {
    title: "Installing on Windows",
    steps: ["Open NoteLater Setup.exe from your Downloads.", "If Windows shows \"Windows protected your PC\", click More info, then Run anyway.", "NoteLater installs and opens by itself, with a shortcut on your desktop.", "Hit record. The speech model downloads once, then everything runs offline."],
  },
  ios: {
    title: "On iPhone and iPad",
    steps: ["The App Store app is on its way.", "Until then, open notelater.com in Safari.", "Tap Share, then Add to Home Screen.", "Open it from your Home Screen and hit record."],
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
        {os === "mac" && (
          <p className="mt-4 rounded-[14px] bg-black/[0.04] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#6e6e73]">
            No Open Anyway button? In Terminal, paste <code className="rounded bg-white px-1 py-0.5 font-mono text-[11.5px] text-[#1d1d1f]">xattr -cr /Applications/NoteLater.app</code> and press Return, then open NoteLater again.
          </p>
        )}
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
          <img src="/shots/iphone.webp" alt="" loading="lazy" className="block h-full w-full object-cover object-top" />
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

/** Starts the right installer download for a platform and shows how to install it. */
export function useInstaller() {
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
  const ui = <AnimatePresence>{sheet && <InstallSheet os={sheet.os} file={sheet.file} onClose={() => setSheet(null)} />}</AnimatePresence>;
  return { release, go, setSheet, ui };
}

/** Which installer fits the device this page is open on. */
export function deviceOs(): Os {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "web";
  if (/Mac/.test(ua)) return "mac";
  if (/Win/.test(ua)) return "win";
  return "web";
}

export function Downloads() {
  const { release, go, setSheet, ui } = useInstaller();
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
      {release && <p className="mt-4 text-center text-[12.5px] text-[#6e6e73]">Latest version {release.version}. Free.</p>}
      {ui}
    </>
  );
}
