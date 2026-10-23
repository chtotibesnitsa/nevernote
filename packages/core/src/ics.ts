// Calendar files: one-tap .ics downloads in the app, and the live calendar
// feed Pro subscribes to (new due dates show up on their own).
import type { Extraction } from "./types.ts";

/** One-tap .ics file for a due date (free). Pro adds these to Google Calendar automatically. */
export function icsFor(items: (Extraction & { course?: string })[], course?: string, name = "Nevernote"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const events = items
    .filter((i) => i.when)
    .map((i) => {
      const d = i.when!.replace(/[-:]/g, "");
      const when = i.allDay ? `DTSTART;VALUE=DATE:${d.slice(0, 8)}` : `DTSTART:${d.slice(0, 15)}`;
      return [
        "BEGIN:VEVENT",
        `UID:${i.id}@nevernote.app`,
        `DTSTAMP:${stamp}`,
        when,
        `SUMMARY:${esc(((i.course ?? course) ? `${i.course ?? course}: ` : "") + i.title)}`,
        `DESCRIPTION:${esc(`"${i.phrase}" (heard by Nevernote)`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT18H",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(i.title)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nevernote//EN", `X-WR-CALNAME:${esc(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", ...events, "END:VCALENDAR"].join("\r\n");
}

