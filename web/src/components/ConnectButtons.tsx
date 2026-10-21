import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Link2, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage, openOAuthPopup } from "@/lib/api";

/** Google Calendar connect / disconnect. Authorization completes entirely server-side. */
export function GoogleConnect() {
  const { me, refresh } = useMe();
  const status = me?.connections.google.status;
  const connect = useMutation({
    mutationFn: async () => {
      const { auth_url } = await api<{ auth_url: string }>("/google/connect", { method: "POST" });
      const ok = await openOAuthPopup(auth_url);
      if (!ok) throw new Error("Popup was blocked. Allow popups for this site and try again.");
    },
    onSuccess: () => {
      void refresh();
      toast.success("Google Calendar authorization finished. Check the connection status below.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: () => api("/google", { method: "DELETE" }),
    onSuccess: () => void refresh(),
  });

  if (status === "needs_server_config") {
    return <ErrorNote message="Google Calendar connection requires server OAuth configuration (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET). Everything else works meanwhile; accepted items will wait here until it's configured." />;
  }
  if (status === "connected") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-sage-soft text-sage">Connected</span>
        <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
      </div>
    );
  }
  return (
    <Button onClick={() => connect.mutate()} disabled={connect.isPending} className="rounded-xl">
      {connect.isPending ? <Spinner /> : <CalendarDays className="h-4 w-4" />} Connect Google Calendar
    </Button>
  );
}

/** Wispr Flow MCP connect. The server URL is sent once to the backend and never stored client-side. */
export function WisprConnect() {
  const { me, refresh } = useMe();
  const [url, setUrl] = useState<string>("");
  const [showInput, setShowInput] = useState<boolean>(false);
  const wispr = me?.connections.wispr;
  const connect = useMutation({
    mutationFn: async () => {
      const body: { server_url?: string } = {};
      if (url.trim()) body.server_url = url.trim();
      const { auth_url } = await api<{ auth_url: string }>("/wispr/connect", { method: "POST", json: body });
      setUrl("");
      const ok = await openOAuthPopup(auth_url);
      if (!ok) throw new Error("Popup was blocked. Allow popups for this site and try again.");
    },
    onSuccess: () => {
      void refresh();
      toast.success("Wispr authorization finished. Check the connection status.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disconnect = useMutation({ mutationFn: () => api("/wispr", { method: "DELETE" }), onSuccess: () => void refresh() });

  if (wispr?.status === "connected") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-sage-soft text-sage">Connected · {wispr.host}</span>
          <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
        </div>
        {wispr.long_lived === false && (
          <p className="text-xs text-amber">Wispr granted only a short-lived token, so syncing may ask you to reconnect. Disconnect and reconnect to retry offline access.</p>
        )}
        {wispr.tools.length > 0 && <p className="text-xs text-muted-foreground">Discovered tools: {wispr.tools.join(", ")}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => connect.mutate()} disabled={connect.isPending} className="rounded-xl">
        {connect.isPending ? <Spinner /> : <Link2 className="h-4 w-4" />} Connect Wispr Flow
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Opens Wispr Flow in a popup to approve read-only access to your Notetaker meetings. Nothing to copy or paste.
      </p>
      {!showInput ? (
        <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setShowInput(true)}>
          Use a different MCP server URL
        </button>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            connect.mutate();
          }}
        >
          <label className="text-xs font-medium text-muted-foreground">Server URL from Wispr Flow → Settings → MCP → “All other apps”</label>
          <div className="flex gap-2">
            <Input type="url" autoComplete="off" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="rounded-xl" />
            <Button type="submit" disabled={connect.isPending || !url.trim()} className="rounded-xl">{connect.isPending ? <Spinner /> : "Authorize"}</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Only needed if Wispr shows a different URL than the standard one. Sent over HTTPS to your private server vault.</p>
        </form>
      )}
      {connect.isError && <ErrorNote message={errorMessage(connect.error)} />}
    </div>
  );
}
