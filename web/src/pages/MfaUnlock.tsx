import { useMutation } from "@tanstack/react-query";
import { KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CodeInput } from "@/components/CodeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useAuth } from "@/hooks/useAuth";
import { api, errorMessage, TransportError } from "@/lib/api";
import { Shell } from "@/pages/MfaSetup";

interface VerifyResult {
  session_token: string;
  used_recovery_code: boolean;
  recovery_codes_left?: number;
}

/** Normal sign-in second step: a code from the authenticator, then a long-lived session. */
export default function MfaUnlock({ email }: { email: string | null }) {
  const { saveSession, signOut } = useAuth();
  const [code, setCode] = useState<string>("");
  const [recoveryMode, setRecoveryMode] = useState<boolean>(false);
  const [recoveryCode, setRecoveryCode] = useState<string>("");

  const verify = useMutation({
    mutationFn: (payload: { code?: string; recovery_code?: string }) => api<VerifyResult>("/auth/mfa/verify", { method: "POST", json: payload }),
    onSuccess: (data) => {
      saveSession(data.session_token);
      if (data.used_recovery_code) {
        toast.warning(`Recovery code used — ${data.recovery_codes_left ?? 0} left. Generate new ones in Settings.`);
      }
    },
    onError: (e) => {
      setCode("");
      toast.error(errorMessage(e));
    },
  });

  return (
    <Shell title="Enter your code" eyebrow="Two-factor required">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {email ? <>Signed in as <span className="font-medium text-foreground">{email}</span>. </> : null}
        Open your authenticator app and type the current 6 digits. This device then stays unlocked.
      </p>

      {!recoveryMode ? (
        <>
          <div className="mt-6">
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" /> Authenticator code</label>
            <CodeInput value={code} onChange={setCode} onComplete={(c) => verify.mutate({ code: c })} disabled={verify.isPending} invalid={verify.isError} />
          </div>
          {verify.isError && <div className="mt-3"><ErrorNote message={errorMessage(verify.error)} /></div>}
          {verify.error instanceof TransportError && (
            <ul className="mt-2 space-y-1 rounded-xl bg-secondary/60 p-3 font-mono text-[11px] leading-snug">
              {verify.error.probes.map((p) => (
                <li key={p.name} className={p.ok ? "text-sage" : "text-clay"}>{p.ok ? "✓" : "✗"} {p.name} — {p.detail}</li>
              ))}
            </ul>
          )}
          <Button className="mt-4 h-12 w-full rounded-xl text-base" disabled={code.length !== 6 || verify.isPending} onClick={() => verify.mutate({ code })}>
            {verify.isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} Unlock NeverNote
          </Button>
          <button className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground underline" onClick={() => setRecoveryMode(true)}>
            <LifeBuoy className="h-3.5 w-3.5" /> Lost your phone? Use a recovery code
          </button>
        </>
      ) : (
        <>
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">Recovery code</label>
            <Input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              className="h-12 rounded-xl font-mono tracking-wider"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Each recovery code works once and is then burned.</p>
          </div>
          {verify.isError && <div className="mt-3"><ErrorNote message={errorMessage(verify.error)} /></div>}
          <Button className="mt-4 h-12 w-full rounded-xl text-base" disabled={recoveryCode.replace(/[^A-Z0-9]/g, "").length < 12 || verify.isPending} onClick={() => verify.mutate({ recovery_code: recoveryCode })}>
            {verify.isPending ? <Spinner /> : <ShieldCheck className="h-4 w-4" />} Unlock with recovery code
          </Button>
          <button className="mt-4 w-full text-center text-xs text-muted-foreground underline" onClick={() => setRecoveryMode(false)}>
            Back to authenticator code
          </button>
        </>
      )}

      <button className="mt-5 w-full text-center text-xs text-muted-foreground underline" onClick={signOut}>
        Sign out
      </button>
    </Shell>
  );
}
