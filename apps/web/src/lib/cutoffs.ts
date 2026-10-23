// A small log, per note, of every time a recording stopped, paused or came back,
// and why. Kept in localStorage so it survives a closed tab and shows on the note.
export type CutReason = "started" | "manual" | "paused" | "resumed" | "mic" | "offline" | "online" | "tab" | "finished";

export interface CutEntry {
  at: string;
  sec: number;
  reason: CutReason;
  text: string;
}

const TEXT: Record<CutReason, string> = {
  started: "Recording started",
  manual: "You stopped recording",
  paused: "You paused",
  resumed: "Recording resumed",
  mic: "Microphone lost",
  offline: "Wi-Fi dropped. Still recording on this device",
  online: "Back online",
  tab: "Tab was closed or reloaded. Everything up to this point is saved",
  finished: "Recording finished",
};

const key = (id: string) => `nn:cuts:${id}`;

export function getCuts(id: string): CutEntry[] {
  try {
    return JSON.parse(localStorage.getItem(key(id)) ?? "[]");
  } catch {
    return [];
  }
}

export function logCut(id: string, reason: CutReason, sec: number, detail?: string) {
  const list = getCuts(id);
  list.push({ at: new Date().toISOString(), sec, reason, text: detail ? `${TEXT[reason]}: ${detail}` : TEXT[reason] });
  try {
    localStorage.setItem(key(id), JSON.stringify(list.slice(-60)));
  } catch {
    /* storage full or blocked; the recording itself is unaffected */
  }
}

/** Heartbeat so a closed tab can be told apart from a clean stop on the next visit. */
const ACTIVE = "nn:active";
export const setActive = (v: { noteId: string; elapsed: number } | null) => {
  try {
    if (v) localStorage.setItem(ACTIVE, JSON.stringify(v));
    else localStorage.removeItem(ACTIVE);
  } catch {
    /* ignore */
  }
};
export const getActive = (): { noteId: string; elapsed: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE) ?? "null");
  } catch {
    return null;
  }
};
