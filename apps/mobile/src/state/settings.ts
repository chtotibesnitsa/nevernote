import { createStore } from "./store";

export interface Settings {
  name: string;
  theme: "system" | "light" | "dark";
  notifyDeadlines: boolean;
  notifyExams: boolean;
  notifyImportant: boolean;
  /** Night-before reminder for every due date heard. */
  remindNightBefore: boolean;
  proTips: boolean;
  /** Summaries only on Wi-Fi (saves cellular data). */
  wifiOnly: boolean;
  haptics: boolean;
  onboarded: boolean;
  installedAt: string;
}

export const settings = createStore<Settings>(
  {
    name: "",
    theme: "system",
    notifyDeadlines: true,
    notifyExams: true,
    notifyImportant: false,
    remindNightBefore: true,
    proTips: true,
    wifiOnly: false,
    haptics: true,
    onboarded: false,
    installedAt: new Date().toISOString(),
  },
  "nn:settings",
);

export const useSettings = <U,>(select: (s: Settings) => U): U => settings.use(select);
