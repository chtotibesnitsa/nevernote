// Pro: subscribe Google or Apple Calendar to NoteLater once, and every due date
// it hears after that shows up on its own, with a reminder the night before.
import { useState } from "react";
import { Button } from "../components/ui.tsx";
import { calendarFeed } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

export function CalendarSync() {
  const { need, toast } = useApp();
  const [feed, setFeed] = useState<{ https: string; webcal: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    if (!need("calendarSync", "calendar")) return;
    setBusy(true);
    const r = await calendarFeed();
    setBusy(false);
    if ("error" in r) toast({ title: "Couldn't set up calendar sync", body: "Check your connection and try again." });
    else setFeed(r);
  };
  if (!feed)
    return (
      <Button variant="primary" onClick={() => void connect()} disabled={busy}>
        {busy ? "Setting up…" : "Connect my calendar"}
      </Button>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.webcal)}`} target="_blank" rel="noreferrer" className="press inline-flex rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] px-4 py-2 text-sm font-semibold text-white">
          Add to Google Calendar
        </a>
        <a href={feed.webcal} className="press-light inline-flex rounded-full bg-[var(--card)] px-4 py-2 text-sm font-semibold">
          Add to Apple Calendar
        </a>
        <button onClick={() => void navigator.clipboard.writeText(feed.https).then(() => toast({ title: "Feed link copied" }))} className="press-light rounded-full bg-[var(--card)] px-4 py-2 text-sm font-semibold">
          Copy link
        </button>
      </div>
      <p className="text-[13px] text-[var(--mute)]">Keep this link private: anyone with it can see your due dates. Calendars refresh it every hour or so.</p>
    </div>
  );
}
