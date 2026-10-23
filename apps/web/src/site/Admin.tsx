// Owner dashboard: spending, revenue, profit and loss, usage. The page is only a viewer.
// Every number comes from the `admin` Edge Function, which checks the caller server-side,
// so opening this URL signed out, or signed in as anyone else, shows nothing.
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui.tsx";
import { supabase } from "../lib/cloud.ts";

interface Day {
  day: string; signups: number; active: number; recordings: number; minutes: number; summaries: number; asks: number;
  tokens_in: number; tokens_out: number; llm_cost: number; upgrades: number; downgrades: number; upsells_shown: number; gross: number; fixed_cost: number;
}
interface Cost { id: number; name: string; monthly_usd: number; starts_on: string; ends_on: string | null }
interface Overview {
  me: string; days: Day[]; styles: Record<string, number>; custom_rules_summaries: number;
  totals: { users: number; guests?: number; pro_users: number; notes: number; db_bytes: number };
  top_spenders: { email: string; plan: string; summaries: number; asks: number; cost: number }[]; costs: Cost[];
}

const APPLE_CUT = 0.15;
const usd = (n: number, d = n !== 0 && Math.abs(n) < 10 ? 2 : 0) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Chart({ labels, series, height = 180, money = true }: {
  labels: string[]; height?: number; money?: boolean;
  series: { name: string; color: string; values: number[]; kind: "bar" | "line" }[];
}) {
  const w = 640, padL = 46, padR = 8, padT = 10, padB = 24, h = height;
  const all = series.flatMap((s) => s.values), max = Math.max(0, ...all), min = Math.min(0, ...all);
  const span = max - min || 1, step = labels.length > 1 ? (w - padL - padR) / labels.length : w;
  const y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB);
  const x = (i: number) => padL + step * i + step / 2;
  const fmt = (v: number) => (money ? usd(v) : num(v));
  const ticks = [min, min + span / 2, max];
  const bars = series.filter((s) => s.kind === "bar"), bw = Math.max(2, Math.min(18, (step * 0.7) / Math.max(1, bars.length)));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={series.map((s) => s.name).join(", ")}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--mute)">{fmt(t)}</text>
        </g>
      ))}
      {min < 0 && <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} stroke="var(--mute)" strokeDasharray="3 3" />}
      {bars.map((s, si) =>
        s.values.map((v, i) => (
          <rect key={`${s.name}${i}`} x={x(i) - (bw * bars.length) / 2 + si * bw} y={Math.min(y(v), y(0))} width={bw - 1} height={Math.max(1, Math.abs(y(v) - y(0)))} rx="1.5" fill={s.color} />
        )),
      )}
      {series.filter((s) => s.kind === "line").map((s) => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      ))}
      {labels.map((l, i) => (i % Math.ceil(labels.length / 7) === 0 ? <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="var(--mute)">{short(l)}</text> : null))}
    </svg>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
      {items.map(([n, c]) => (
        <span key={n} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{n}</span>
      ))}
    </div>
  );
}

const Panel = ({ title, children, sub }: { title: string; sub?: string; children: ReactNode }) => (
  <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
    <h2 className="text-lg font-semibold">{title}</h2>
    {sub && <p className="text-sm text-[var(--mute)]">{sub}</p>}
    <div className="mt-3">{children}</div>
  </section>
);
const Kpi = ({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) => (
  <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
    <div className="text-xs uppercase tracking-wide text-[var(--mute)]">{label}</div>
    <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "good" ? "text-[var(--color-dot-green)]" : tone === "bad" ? "text-[var(--color-dot-red)]" : ""}`}>{value}</div>
  </div>
);

export function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "error">("idle");
  const [form, setForm] = useState({ name: "", amount: "" });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data: d, error } = await supabase!.functions.invoke("admin", { body });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      throw Object.assign(new Error(String(error.message)), { status });
    }
    return d;
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await call({ action: "overview", days: range }));
      setState("idle");
    } catch (e) {
      setData(null);
      setState((e as { status?: number }).status === 403 || (e as { status?: number }).status === 401 ? "denied" : "error");
    }
  }, [call, range]);

  useEffect(() => { if (session) void load(); }, [session, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    let cum = 0;
    return data.days.map((d) => {
      const revenue = d.gross * (1 - APPLE_CUT), cost = d.llm_cost + d.fixed_cost, profit = revenue - cost;
      cum += profit;
      return { ...d, revenue, cost, profit, cum };
    });
  }, [data]);
  const sum = (k: "revenue" | "cost" | "llm_cost" | "fixed_cost" | "profit" | "summaries" | "asks" | "tokens_in" | "tokens_out" | "signups" | "minutes") => rows.reduce((a, r) => a + r[k], 0);

  const signIn = () => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}${import.meta.env.BASE_URL}admin` } });

  const shell = (children: ReactNode) => (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-5 pb-20 pt-6">
      <header className="flex items-center justify-between">
        <Link to="/"><Logo size={20} /></Link>
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--mute)]">Owner dashboard</span>
      </header>
      {children}
    </div>
  );

  if (!supabase) return shell(<p className="mt-16 text-center text-[var(--ink-2)]">This build is not connected to a server.</p>);
  if (session === undefined) return shell(<p className="mt-16 text-center text-[var(--mute)]">Loading…</p>);
  if (!session) {
    return shell(
      <div className="mx-auto mt-24 max-w-[380px] text-center">
        <h1 className="title-serif text-4xl">Owner sign-in</h1>
        <p className="mt-2 text-[var(--ink-2)]">Only the owner's Google account can open this.</p>
        <button onClick={signIn} className="mt-6 rounded-full bg-[var(--fg)] px-6 py-3 font-medium text-[var(--bg)]">Continue with Google</button>
      </div>,
    );
  }
  if (state === "denied") {
    return shell(
      <div className="mx-auto mt-24 max-w-[420px] text-center">
        <h1 className="title-serif text-4xl">Not authorized</h1>
        <p className="mt-2 text-[var(--ink-2)]">This account can't open the owner dashboard.</p>
        <button onClick={() => supabase!.auth.signOut()} className="mt-6 rounded-full border border-[var(--line)] px-6 py-3 font-medium">Sign out</button>
      </div>,
    );
  }
  if (!data) {
    return shell(<p className="mt-16 text-center text-[var(--mute)]">{state === "error" ? "Couldn't load. Try again in a moment." : "Loading…"}</p>);
  }

  const labels = rows.map((r) => r.day);
  const profit = sum("profit");
  const people = data.totals.users + (data.totals.guests ?? 0);
  const perUserCost = people ? sum("llm_cost") / people : 0;
  const mb = data.totals.db_bytes / 1048576;
  return shell(
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="title-serif text-4xl">Spending and profit</h1>
          <p className="text-sm text-[var(--mute)]">Signed in as {data.me}. Revenue is estimated from App Store purchases after Apple's 15% cut.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setRange(n)} className={`rounded-full border px-4 py-1.5 text-sm ${range === n ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--line)]"}`}>{n} days</button>
          ))}
          <button onClick={() => supabase!.auth.signOut()} className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm">Sign out</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Profit, ${range} days`} value={usd(profit)} tone={profit < 0 ? "bad" : "good"} />
        <Kpi label="Revenue" value={usd(sum("revenue"))} />
        <Kpi label="Costs" value={usd(sum("cost"))} />
        <Kpi label="AI spend" value={usd(sum("llm_cost"), 2)} />
        <Kpi label="Users" value={`${num(data.totals.users)}${data.totals.guests ? ` + ${num(data.totals.guests)} guests` : ""}`} />
        <Kpi label="On Pro" value={`${num(data.totals.pro_users)}${data.totals.users ? ` (${((data.totals.pro_users / data.totals.users) * 100).toFixed(1)}%)` : ""}`} />
        <Kpi label="Notes saved" value={num(data.totals.notes)} />
        <Kpi label="Database" value={`${mb.toFixed(1)} MB of 8 GB`} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Profit and loss" sub="Bars are each day. The line adds them up.">
          <Chart labels={labels} series={[
            { name: "Revenue", color: "var(--color-dot-green)", values: rows.map((r) => r.revenue), kind: "bar" },
            { name: "Costs", color: "var(--color-dot-red)", values: rows.map((r) => r.cost), kind: "bar" },
            { name: "Total profit", color: "var(--fg)", values: rows.map((r) => r.cum), kind: "line" },
          ]} />
          <Legend items={[["Revenue", "var(--color-dot-green)"], ["Costs", "var(--color-dot-red)"], ["Total profit", "var(--fg)"]]} />
        </Panel>
        <Panel title="AI spend per day" sub={`${num(sum("tokens_in"))} tokens in, ${num(sum("tokens_out"))} out over the period.`}>
          <Chart labels={labels} series={[{ name: "AI spend", color: "var(--color-clay)", values: rows.map((r) => r.llm_cost), kind: "bar" }]} />
          <p className="mt-2 text-xs text-[var(--mute)]">Averages {usd(perUserCost, 3)} a user so far. The provider's own bill is the final word.</p>
        </Panel>
        <Panel title="People">
          <Chart money={false} labels={labels} series={[
            { name: "Active users", color: "var(--fg)", values: rows.map((r) => r.active), kind: "line" },
            { name: "Signups", color: "var(--color-clay)", values: rows.map((r) => r.signups), kind: "bar" },
          ]} />
          <Legend items={[["Active users", "var(--fg)"], ["Signups", "var(--color-clay)"]]} />
        </Panel>
        <Panel title="Usage" sub={`${num(sum("minutes"))} minutes recorded, ${num(sum("summaries"))} summaries, ${num(sum("asks"))} questions asked.`}>
          <Chart money={false} labels={labels} series={[
            { name: "Summaries", color: "var(--color-dot-green)", values: rows.map((r) => r.summaries), kind: "bar" },
            { name: "Questions", color: "var(--color-dot-orange)", values: rows.map((r) => r.asks), kind: "bar" },
          ]} />
          <Legend items={[["Summaries", "var(--color-dot-green)"], ["Questions", "var(--color-dot-orange)"]]} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Biggest spenders" sub="Highest AI cost in the period.">
          {data.top_spenders.length === 0 ? <p className="text-sm text-[var(--mute)]">No AI usage yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-left text-[var(--mute)]"><th className="py-1 font-medium">User</th><th className="font-medium">Plan</th><th className="text-right font-medium">Notes</th><th className="text-right font-medium">Asks</th><th className="text-right font-medium">Cost</th></tr></thead>
              <tbody>{data.top_spenders.map((s) => (
                <tr key={s.email} className="border-t border-[var(--line)]"><td className="py-1.5">{s.email}</td><td>{s.plan}</td><td className="text-right tabular-nums">{s.summaries}</td><td className="text-right tabular-nums">{s.asks}</td><td className="text-right tabular-nums">{usd(s.cost, 3)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
        <Panel title="How notes are written" sub={`${data.custom_rules_summaries} of ${num(sum("summaries"))} summaries used custom rules.`}>
          {Object.keys(data.styles).length === 0 ? <p className="text-sm text-[var(--mute)]">No summaries yet.</p> : (
            <ul className="space-y-1.5 text-sm">{Object.entries(data.styles).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="tabular-nums">{n}</span></li>
            ))}</ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Fixed monthly costs" sub="Hosting, the Apple developer account, anything you pay every month. They are spread across the days above.">
          <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm">
            <tbody>{data.costs.map((c) => (
              <tr key={c.id} className="border-t border-[var(--line)] first:border-0">
                <td className="py-1.5">{c.name}</td><td className="text-[var(--mute)]">since {c.starts_on}</td>
                <td className="text-right tabular-nums">{usd(Number(c.monthly_usd), 2)} / month</td>
                <td className="text-right"><button className="text-[var(--mute)] underline" onClick={async () => { await call({ action: "delete_cost", id: c.id }); void load(); }}>Remove</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); await call({ action: "add_cost", name: form.name, monthly_usd: Number(form.amount) }); setForm({ name: "", amount: "" }); void load(); }}>
            <input aria-label="Cost name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vercel Pro" className="min-w-[180px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
            <input aria-label="Monthly amount in dollars" required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="$ a month" className="w-32 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
            <button className="rounded-lg bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)]">Add cost</button>
          </form>
        </Panel>
      </div>
    </>,
  );
}
