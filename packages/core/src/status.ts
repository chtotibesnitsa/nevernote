import type { Stage } from "./types";

/** red = needs you or failed, orange = working or waiting for Wi-Fi, green = done. */
export type Dot = "red" | "orange" | "green";

export interface StageInfo {
  dot: Dot;
  label: string;
  /** Pulses while something is actively happening. */
  live: boolean;
}

const INFO: Record<Stage, StageInfo> = {
  recording: { dot: "red", label: "Recording", live: true },
  paused: { dot: "orange", label: "Paused", live: false },
  transcribing: { dot: "orange", label: "Transcribing on this device", live: true },
  labelling: { dot: "orange", label: "Telling speakers apart", live: true },
  queued: { dot: "orange", label: "Saved offline · summary when you're online", live: false },
  summarising: { dot: "orange", label: "Writing notes", live: true },
  ready: { dot: "green", label: "Notes ready", live: false },
  failed: { dot: "red", label: "Something went wrong · tap to retry", live: false },
};

export function stageInfo(stage: Stage): StageInfo {
  return INFO[stage];
}

/** The three-step progress strip shown on every note: heard → transcribed → summarised. */
export function pipelineDots(stage: Stage): [Dot, Dot, Dot] {
  switch (stage) {
    case "recording":
      return ["red", "orange", "orange"];
    case "paused":
      return ["orange", "orange", "orange"];
    case "transcribing":
    case "labelling":
      return ["green", "orange", "red"];
    case "queued":
    case "summarising":
      return ["green", "green", "orange"];
    case "ready":
      return ["green", "green", "green"];
    case "failed":
      return ["green", "red", "red"];
  }
}
