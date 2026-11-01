import { useEffect, useState } from "react";
import { useApp } from "../app/state.tsx";

function until(t: Date, now: number): string {
  const s = Math.max(0, Math.floor((t.getTime() - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

/** Free accounts: how many AI notes are left today, as a quiet meter. Tapping it shows Pro. */
export function QuotaPill({ wide, compact }: { wide?: boolean; compact?: boolean }) {
  const { quota, openPro } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!quota) return null;
  const out = quota.left === 0;
  return (
    <button
      onClick={() => openPro("unlimited")}
      title="Free accounts get 5 AI notes a day. Each update after a pause counts as one."
      className={`group block rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-3.5 py-3 text-left transition-colors hover:border-black/20 ${wide ? "w-full" : ""}`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-[#1d1d1f]">AI notes today</span>
        <span className="text-[12.5px] tabular-nums text-[#6e6e73]">
          {quota.left} of {quota.limit} left
        </span>
      </span>
      <span className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: quota.limit }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < quota.left ? "bg-[#1d1d1f]" : "bg-black/10"}`} />
        ))}
      </span>
      <span className="mt-2 flex items-center justify-between gap-3 text-[12px] text-[#86868b]">
        <span className="whitespace-nowrap tabular-nums">{out ? `More in ${until(quota.resetAt, now)}` : `Resets in ${until(quota.resetAt, now)}`}</span>
        {!compact && <span className="whitespace-nowrap font-medium text-[#1d1d1f] opacity-70 transition-opacity group-hover:opacity-100">Unlimited with Pro</span>}
      </span>
    </button>
  );
}
