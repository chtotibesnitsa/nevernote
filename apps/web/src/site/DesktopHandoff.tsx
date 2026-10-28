// The browser tab a desktop sign-in ends on: hands the sign-in to the app.
import { motion } from "motion/react";
import { useEffect } from "react";
import { Logo, soft } from "../components/ui.tsx";
import { appLink } from "../lib/handoff.ts";

export function DesktopHandoff({ code }: { code: string }) {
  useEffect(() => {
    location.href = appLink(code);
  }, [code]);
  return (
    <div className="site grid min-h-screen place-items-center bg-[#f5f5f7] px-5">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft} className="w-full max-w-[420px] rounded-[32px] bg-white px-8 pb-8 pt-9 text-center shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_40px_80px_-40px_rgb(0_0_0/0.35)]">
        <Logo size={22} />
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...soft, delay: 0.15 }} className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-[26px] text-white shadow-[0_4px_0_#000]">
          ✓
        </motion.div>
        <h1 className="title-serif mt-6 text-[2rem] leading-tight">You're signed in.</h1>
        <p className="mt-2 text-[15px] text-[#6e6e73]">Head back to the NoteLater app. If your browser asks, allow it to open NoteLater.</p>
        <a href={appLink(code)} className="press mt-7 flex w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-4 text-[16px] font-bold text-white">
          Open NoteLater
        </a>
        <p className="mt-4 text-xs text-[#6e6e73]">You can close this tab afterwards.</p>
      </motion.div>
    </div>
  );
}
