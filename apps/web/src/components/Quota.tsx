import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../app/state.tsx";

function until(t: Date, now: number): string {
  const s = Math.max(0, Math.floor((t.getTime() - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Free accounts: how many instant AI notes are left today and when they come back. Tapping it shows Pro (unlimited). */
export function QuotaPill({ wide }: { wide?: boolean }) {
  const { quota, openPro } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!quota) return null;
  const out = quota.left === 0;
  return (
    <button
      onClick={() => openPro("unlimited")}
      title="Free accounts get 5 instant AI notes a day. Each update a pause adds counts as one. Tap for unlimited."
      className={`press group flex items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left transition hover:-translate-y-0.5 ${wide ? "w-full" : ""} ${
        out ? "bg-[#fff4d6] shadow-[0_0_0_1.5px_#e9c46a,0_4px_0_#e9c46a]" : "bg-[#fffbea] shadow-[0_0_0_1.5px_#f1dc9a,0_4px_0_#f1dc9a]"
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-[15px] font-extrabold tabular-nums text-white shadow-[0_3px_0_#000]">{quota.left}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13.5px] font-extrabold text-[#1d1d1f]">
          {out ? "No instant AI notes left today" : `${quota.left} of ${quota.limit} AI notes left today`}
        </span>
        <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-[#6e6e73]">
          Resets in {until(quota.resetAt, now)} · <span className="text-[#1d1d1f] underline decoration-black/25 underline-offset-2 group-hover:decoration-black">Go unlimited</span>
        </span>
      </span>
      <Sparkles className="h-4 w-4 shrink-0 text-[#1d1d1f]" />
    </button>
  );
}
