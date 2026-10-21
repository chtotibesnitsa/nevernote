import { useMutation } from "@tanstack/react-query";
import { Copy, LogOut, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CodeInput } from "@/components/CodeInput";
import { Button } from "@/components/ui/button";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStatus } from "@/hooks/useSecurity";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";

/** Two-factor management: recovery codes, device sign-out, authenticator reset. */
export function SecurityCard() {
  const { user, clearSession } = useAuth();
  const { status, refresh } = useAuthStatus(true);
  const [mode, setMode] = useState<"idle" | "recovery" | "reset">("idle");
  const [code, setCode] = useState<string>("");
  const [fresh, setFresh] = useState<string[] | null>(null);

  const regenerate = useMutation({
    mutationFn: (value: string) => api<{ recovery_codes: string[] }>("/auth/mfa/recovery", { method: "POST", json: { code: value } }),
    onSuccess: (d) => {
      setFresh(d.recovery_codes);
      setMode("idle");
      setCode("");
      void refresh();
      toast.success("New recovery codes generated. The old ones no longer work.");
    },
    onError: (e) => {
      setCode("");
      toast.error(errorMessage(e));
    },
  });

  const reset = useMutation({
    mutationFn: (value: string) => api("/auth/mfa/reset", { method: "POST", json: { code: value } }),
    onSuccess: () => {
      toast("Authenticator removed. You'll set up a new one on the next screen.");
      clearSession();
    },
    onError: (e) => {
      setCode("");
      toast.error(errorMessage(e));
    },
  });

  const signOutAll = useMutation({
    mutationFn: () => api("/auth/logout-all", { method: "POST" }),
    onSuccess: () => {
      toast("Signed out on every device.");
      clearSession();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-sage-soft text-sage"><ShieldCheck className="h-3.5 w-3.5" /> Two-factor on</span>
        <span className="chip bg-secondary text-muted-foreground">{user?.email}</span>
        {status && <span className="chip bg-secondary text-muted-foreground">{status.active_sessions} active device{status.active_sessions === 1 ? "" : "s"}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Enrolled {timeAgo(status?.enrolled_at ?? null)} · {status?.recovery_codes_left ?? 0} recovery code{(status?.recovery_codes_left ?? 0) === 1 ? "" : "s"} unused · sessions last 45 days of active use.
      </p>

      {fresh && (
        <div className="rounded-xl border border-sage/30 bg-sage-soft/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sage">Your new recovery codes — save them now</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {fresh.map((c) => <code key={c} className="rounded-lg bg-card px-2 py-1.5 text-center font-mono text-[12px] shadow-sm">{c}</code>)}
          </div>
          <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={() => void navigator.clipboard.writeText(fresh.join("\n")).then(() => toast.success("Copied."))}>
            <Copy className="h-3.5 w-3.5" /> Copy all
          </Button>
        </div>
      )}

      {mode !== "idle" && (
        <div className="rounded-xl border border-border/70 bg-background p-3.5">
          <p className="mb-2 text-sm font-medium">
            {mode === "recovery" ? "Confirm with your current authenticator code" : "Confirm before removing your authenticator"}
          </p>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={(c) => (mode === "recovery" ? regenerate.mutate(c) : reset.mutate(c))}
            disabled={regenerate.isPending || reset.isPending}
            invalid={regenerate.isError || reset.isError}
          />
          {(regenerate.isError || reset.isError) && (
            <div className="mt-2"><ErrorNote message={errorMessage(regenerate.error ?? reset.error)} /></div>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="rounded-xl" disabled={code.length !== 6 || regenerate.isPending || reset.isPending} onClick={() => (mode === "recovery" ? regenerate.mutate(code) : reset.mutate(code))}>
              {regenerate.isPending || reset.isPending ? <Spinner /> : null} Confirm
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setMode("idle"); setCode(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setMode("recovery")}>
            <RefreshCw className="h-3.5 w-3.5" /> New recovery codes
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => signOutAll.mutate()} disabled={signOutAll.isPending}>
            {signOutAll.isPending ? <Spinner /> : <LogOut className="h-3.5 w-3.5" />} Sign out everywhere
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl text-clay" onClick={() => setMode("reset")}>
            <Smartphone className="h-3.5 w-3.5" /> Move to a new phone
          </Button>
        </div>
      )}
    </div>
  );
}
