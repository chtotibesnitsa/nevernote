// Paper, ink and a little leather: the same palette as the website and the
// desktop app, with a warm near-black for dark mode.
import { useColorScheme } from "react-native";
import { useSettings } from "../state/settings";

export const palette = {
  leather: "#6b4f3a",
  clay: "#c8794a",
  red: "#d9534a",
  orange: "#e8973e",
  green: "#3f9a6b",
};

const light = {
  ...palette,
  dark: false,
  bg: "#f7f3ec",
  bg2: "#efe9df",
  card: "#fcfaf6",
  fg: "#1c1915",
  ink2: "#4a433b",
  mute: "#8a8076",
  line: "#e4ddd2",
  bubble: "#f0ebe3",
  glassTint: "rgba(255,255,255,0.55)",
};

const dark: typeof light = {
  ...palette,
  dark: true,
  bg: "#14120f",
  bg2: "#1a1714",
  card: "#1c1915",
  fg: "#f4efe6",
  ink2: "#cfc6ba",
  mute: "#998f84",
  line: "#2e2923",
  bubble: "#25211c",
  glassTint: "rgba(38,33,28,0.55)",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const isDark = pref === "dark" || (pref === "system" && system === "dark");
  return isDark ? dark : light;
}

export const serif = "ui-serif";
export const mono = "ui-monospace";

/** Speaker bubble accents, in order of first appearance. */
export const SPEAKER_TINTS = ["#6b4f3a", "#3f6f9a", "#7a5a9a", "#3f9a6b", "#c8794a", "#9a3f5a", "#5a7a3f", "#3f8a9a"];

export function speakerTint(id: string | undefined): string {
  const n = id ? Number(id.replace(/\D/g, "")) || 1 : 1;
  return SPEAKER_TINTS[(n - 1) % SPEAKER_TINTS.length];
}

export const spring = { damping: 18, stiffness: 180, mass: 0.9 };
