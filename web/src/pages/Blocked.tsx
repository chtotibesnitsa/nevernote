import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Shell } from "@/pages/MfaSetup";

/** Shown when a Google account that isn't the owner completes sign-in. */
export default function Blocked({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  return (
    <Shell title="This vault isn't yours" eyebrow="Access denied">
      <div className="mt-1 flex items-start gap-3 rounded-xl border border-clay/30 bg-clay-soft/60 px-3 py-3 text-sm text-clay">
        <ShieldX className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          NeverNote is a private, single-owner instance. {email ? <>The account <span className="font-medium">{email}</span> is not the owner, so</> : "Your account is not the owner, so"} nothing was created and no data is visible.
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        If this is your instance, sign out and come back with the owner&apos;s Google account.
      </p>
      <Button className="mt-5 h-12 w-full rounded-xl text-base" onClick={signOut}>
        Sign out and try another account
      </Button>
    </Shell>
  );
}
