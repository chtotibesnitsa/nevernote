// Due dates as real notifications: one the moment the teacher says it, then a
// reminder the evening before (and an hour before, when there's a time).
import type { Extraction, Note } from "@nevernote/core";
import * as Notifications from "expo-notifications";
import { settings } from "../state/settings";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function askPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export function allowed(e: Extraction): boolean {
  const s = settings.get();
  return (e.kind === "deadline" && s.notifyDeadlines) || (e.kind === "exam" && s.notifyExams) || (e.kind === "important" && s.notifyImportant);
}

export function describe(e: Extraction, note: Note): { title: string; body: string } {
  const when = e.when
    ? new Date(e.when).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", ...(e.allDay ? {} : { hour: "numeric", minute: "2-digit" }) })
    : "";
  if (e.kind === "important") return { title: "★ Worth remembering", body: e.phrase };
  return { title: `${e.kind === "exam" ? "Test" : "Due"}: ${e.title}`, body: `${when}${when ? " · " : ""}${note.title}` };
}

/** Shows it now and schedules the reminders. Safe to call twice for the same item. */
export async function announce(e: Extraction, note: Note): Promise<void> {
  if (!allowed(e)) return;
  const { title, body } = describe(e, note);
  const data = { noteId: note.id, extractionId: e.id };
  await Notifications.scheduleNotificationAsync({ identifier: `now-${e.id}`, content: { title, body, data }, trigger: null });
  if (!e.when || e.kind === "important" || !settings.get().remindNightBefore) return;
  const due = new Date(e.when);
  const eve = new Date(due);
  eve.setDate(eve.getDate() - 1);
  eve.setHours(20, 0, 0, 0);
  const at = [{ id: `eve-${e.id}`, date: eve, body: `Tomorrow · ${body}` }];
  if (!e.allDay) at.push({ id: `soon-${e.id}`, date: new Date(due.getTime() - 3600_000), body: `In an hour · ${body}` });
  for (const r of at) {
    if (r.date.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title, body: r.body, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
    });
  }
}

export async function cancelFor(e: Extraction): Promise<void> {
  await Promise.all([`eve-${e.id}`, `soon-${e.id}`].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}
