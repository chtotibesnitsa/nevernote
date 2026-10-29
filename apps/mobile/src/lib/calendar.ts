// Calendar: anyone can add a single due date through the system sheet; Pro
// adds every one automatically, with an alert the evening before.
import type { Extraction, Note } from "@notelater/core";
import * as Calendar from "expo-calendar/legacy";

function eventFor(e: Extraction, note: Note) {
  const start = new Date(e.when!);
  const end = e.allDay ? new Date(start.getTime() + 86400_000) : new Date(start.getTime() + 30 * 60_000);
  return {
    title: `${e.kind === "exam" ? "Test: " : "Due: "}${e.title}`,
    startDate: start,
    endDate: end,
    allDay: e.allDay,
    notes: `“${e.phrase}”\n\nHeard in ${note.title} · NoteLater`,
    alarms: [{ relativeOffset: e.allDay ? -16 * 60 : -24 * 60 }],
  };
}

/** One item, through the iOS add-event sheet (no calendar permission needed). */
export async function addOne(e: Extraction, note: Note): Promise<boolean> {
  const r = await Calendar.createEventInCalendarAsync(eventFor(e, note));
  return r.action === "saved";
}

/** Every dated item straight into the default calendar. Returns how many were added. */
export async function addAll(items: Extraction[], note: Note): Promise<number> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) return 0;
  const cal = await Calendar.getDefaultCalendarAsync();
  let n = 0;
  for (const e of items) {
    if (!e.when) continue;
    await Calendar.createEventAsync(cal.id, eventFor(e, note));
    n++;
  }
  return n;
}
