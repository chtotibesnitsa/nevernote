import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/AppShell";
import { CodeInput } from "@/components/CodeInput";
import { Button } from "@/components/ui/button";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useAuth } from "@/hooks/useAuth";
import { api, errorMessage } from "@/lib/api";

interface SetupPayload {
  secret: string;
  otpauth_url: string;
  account: string;
  issuer: string;
}

interface EnrollResult {
  session_token: string;
  recovery_codes: string[];
}

/**
 * One-time authenticator enrollment. Shown only when the vault has no TOTP
 * secret yet; after this the unlock screen takes over forever.
 */
export default function MfaSetup() {
  const { saveSession, signOut, user } = useAuth();
  const [code, setCode] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [savedAck, setSavedAck] = useState<boolean>(false);

  const setup = useQuery<SetupPayload>({
    queryKey: ["mfa-setup"],
    queryFn: () => api<SetupPayload>("/auth/mfa/setup", { method: "POST" }),
    retry: 0,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    const url = setup.data?.otpauth_url;
    if (!url) return;
    void QRCode.toDataURL(url, { margin: 1, width: 440, color: { dark: "#232120", light: "#fffdf8" }, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [setup.data?.otpauth_url]);

  const enroll = useMutation({
    mutationFn: (value: string) => api<EnrollResult>("/auth/mfa/enroll", { method: "POST", json: { code: value } }),
    onSuccess: (data) => {
      setRecovery(data.recovery_codes);
      // Session is held until the user confirms they stored the recovery codes.
      sessionStorage.setItem("nevernote:pending_session", data.session_token);
    },
    onError: (e) => {
      setCode("");
      toast.error(errorMessage(e));
    },
  });

  const finish = useCallback(() => {
    const token = sessionStorage.getItem("nevernote:pending_session");
    sessionStorage.removeItem("nevernote:pending_session");
    if (token) saveSession(token);
  }, [saveSession]);

  const copyCodes = useCallback(() => {
    if (!recovery) return;
    void navigator.clipboard.writeText(recovery.join("\n")).then(() => toast.success("Recovery codes copied."));
  }, [recovery]);

  const downloadCodes = useCallback(() => {
    if (!recovery) return;
    const body = [
      "NeverNote recovery codes",
      `Account: ${user?.email ?? ""}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "Each code works once. Keep them somewhere only you can reach.",
      "",
      ...recovery,
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    a.download = "nevernote-recovery-codes.txt";
    a.click();
  }, [recovery, user?.email]);

  if (recovery) {
    return (
      <Shell title="Save your recovery codes" eyebrow="Step 2 of 2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          These are the only way back in if you lose your phone. Each one works once. Store them in your password manager
          now — they are never shown again.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-3">
          {recovery.map((c) => (
            <code key={c} className="rounded-lg bg-card px-2.5 py-2 text-center font-mono text-[13px] tracking-wide shadow-sm">{c}</code>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={copyCodes}><Copy className="h-4 w-4" /> Copy all</Button>
          <Button variant="outline" className="rounded-xl" onClick={downloadCodes}><Download className="h-4 w-4" /> Download .txt</Button>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} />
          I&apos;ve saved these codes somewhere safe.
        </label>
        <Button className="mt-4 h-12 w-full rounded-xl text-base" disabled={!savedAck} onClick={finish}>
          <ShieldCheck className="h-4 w-4" /> Open NeverNote
        </Button>
      </Shell>
    );
  }

  return (
    <Shell title="Set up your authenticator" eyebrow="Step 1 of 2 · one time only">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Scan this with Google Authenticator (or any authenticator app). From then on, signing in takes a 6-digit code
        from your phone — and your session stays alive so you rarely have to.
      </p>

      {setup.isLoading && <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Generating your secret…</div>}
      {setup.isError && <div className="mt-5"><ErrorNote message={errorMessage(setup.error)} action={<button className="underline" onClick={() => void setup.refetch()}>Try again</button>} /></div>}

      {setup.data && (
        <>
          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-background p-5">
            {qr ? (
              <img src={qr} alt="Authenticator QR code" className="h-48 w-48 rounded-xl" />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-secondary"><Spinner /></div>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> NeverNote · {setup.data.account}</p>
            {showSecret ? (
              <div className="w-full text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Manual entry key</p>
                <code className="mt-1 block break-all rounded-lg bg-secondary px-3 py-2 font-mono text-xs">{setup.data.secret}</code>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Time-based · 6 digits · 30 seconds</p>
              </div>
            ) : (
              <button className="text-xs text-muted-foreground underline" onClick={() => setShowSecret(true)}>Can&apos;t scan? Show the setup key</button>
            )}
          </div>

          <div className="mt-6">
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" /> Enter the 6-digit code it shows</label>
            <CodeInput value={code} onChange={setCode} onComplete={(c) => enroll.mutate(c)} disabled={enroll.isPending} invalid={enroll.isError} />
          </div>

          {enroll.isError && <div className="mt-3"><ErrorNote message={errorMessage(enroll.error)} /></div>}

          <Button className="mt-4 h-12 w-full rounded-xl text-base" disabled={code.length !== 6 || enroll.isPending} onClick={() => enroll.mutate(code)}>
            {enroll.isPending ? <Spinner /> : <Check className="h-4 w-4" />} Confirm and turn on 2FA
          </Button>
        </>
      )}

      <button className="mt-5 w-full text-center text-xs text-muted-foreground underline" onClick={signOut}>
        Sign out instead
      </button>
    </Shell>
  );
}

export function Shell({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md fade-up">
        <div className="mb-7 flex justify-center">
          <Logo />
        </div>
        <div className="paper-card p-7">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
          <h1 className="mt-1.5 text-2xl font-medium leading-tight">{title}</h1>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
