// What the desktop app exposes to this UI (apps/desktop/src/preload.ts).
import type { Note, Segment } from "@notelater/core";

export type AsrModelId = "parakeet-en" | "parakeet-multi" | "moonshine-base";

export interface DesktopBridge {
  platform: string;
  models: {
    status(): Promise<Record<AsrModelId, boolean>>;
    download(asr: AsrModelId): Promise<boolean>;
    onProgress(cb: (p: { asr: AsrModelId; p: number; label: string }) => void): () => void;
  };
  recorder: {
    start(noteId: string, asr: AsrModelId, vocabulary: string[]): Promise<void>;
    audio(samples: Float32Array): void;
    stop(noteId: string): Promise<{ segments: Segment[]; seconds: number } | { error: string }>;
    onSegment(cb: (m: { noteId: string; segment: Segment }) => void): () => void;
    onStage(cb: (m: { noteId: string; stage: string; message?: string }) => void): () => void;
    /** The words of the phrase being spoken right now, before it is final. */
    onPartial?(cb: (m: { noteId: string; text: string }) => void): () => void;
  };
  notes: {
    list(): Promise<Note[]>;
    get(id: string): Promise<Note | undefined>;
    put(note: Note): Promise<void>;
    delete(id: string): Promise<void>;
    meta(key: string, value?: string): Promise<string | undefined>;
  };
  notify(title: string, body: string, noteId?: string): Promise<void>;
  onOpenNote(cb: (id: string) => void): () => void;
  openExternal(url: string): Promise<void>;
  /** A notelater:// link the app was opened with (sign-in handoff). Older builds lack it. */
  onAuth?(cb: (url: string) => void): () => void;
}

declare global {
  interface Window {
    notelater?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined = typeof window !== "undefined" ? window.notelater : undefined;
export const isDesktop = !!desktop;

export const GITHUB_PROFILE = "https://github.com/chtotibesnitsa";
export const X_PROFILE = "https://x.com/aleks_lucenko";
export const GITHUB_REPO = "https://github.com/chtotibesnitsa/nevernote";
export const RELEASES = `${GITHUB_REPO}/releases/latest`;
