import type { Extraction } from "@nevernote/core";

/** One-tap .ics file for a due date (free). Pro adds these to Google Calendar automatically. */
export function icsFor(items: Extraction[], course?: string): string {
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
        `SUMMARY:${esc((course ? `${course}: ` : "") + i.title)}`,
        `DESCRIPTION:${esc(`"${i.phrase}" (heard by Nevernote)`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT18H",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(i.title)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nevernote//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function download(name: string, text: string, type = "text/calendar"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
