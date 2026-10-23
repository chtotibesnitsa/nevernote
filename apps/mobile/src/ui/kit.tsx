// The small set of pieces every screen is built from: glass, type, dots,
// the waveform and the springy pressable.
import { pipelineDots, stageInfo, type Dot, type Stage } from "@nevernote/core";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as WebBrowser from "expo-web-browser";
import { useEffect, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { serif, spring, useTheme } from "../lib/theme";
import { level } from "../state/app";

export const GITHUB_PROFILE = "https://github.com/chtotibesnitsa";
export const X_PROFILE = "https://x.com/aleks_lucenko";
export const GITHUB_REPO = "https://github.com/chtotibesnitsa/nevernote";

const liquid = isLiquidGlassAvailable();

/** iOS 26 liquid glass, with a frosted blur on older iPhones. */
export function Glass({ children, style, interactive, radius = 22, tint }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean; radius?: number; tint?: string }) {
  const t = useTheme();
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} tintColor={tint} style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: t.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }, style]}>
      <BlurView intensity={40} tint={t.dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? t.glassTint }]} />
      {children}
    </View>
  );
}

export function T({ style, kind = "body", ...rest }: TextProps & { kind?: "display" | "title" | "h2" | "body" | "small" | "mute" | "eyebrow" }) {
  const t = useTheme();
  const k: Record<string, TextStyle> = {
    display: { fontFamily: serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.6, color: t.fg },
    title: { fontFamily: serif, fontSize: 28, lineHeight: 33, letterSpacing: -0.3, color: t.fg },
    h2: { fontSize: 17, fontWeight: "600", color: t.fg },
    body: { fontSize: 16, lineHeight: 23, color: t.fg },
    small: { fontSize: 14, lineHeight: 19, color: t.ink2 },
    mute: { fontSize: 13, lineHeight: 18, color: t.mute },
    eyebrow: { fontSize: 11.5, fontWeight: "600", letterSpacing: 1.1, textTransform: "uppercase", color: t.mute },
  };
  return <Text {...rest} style={[k[kind], style]} />;
}

/** A pressable that gives a little under your thumb. */
export function Press({ children, style, scaleTo = 0.96, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable {...rest} onPressIn={(e) => ((s.value = withSpring(scaleTo, spring)), rest.onPressIn?.(e))} onPressOut={(e) => ((s.value = withSpring(1, spring)), rest.onPressOut?.(e))}>
      <Animated.View style={[a, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, variant = "primary", icon, style, disabled }: { label: string; onPress: () => void; variant?: "primary" | "glass" | "ghost"; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const t = useTheme();
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 13 }}>
      {icon}
      <Text style={{ fontSize: 16, fontWeight: "600", color: variant === "primary" ? t.bg : t.fg }}>{label}</Text>
    </View>
  );
  return (
    <Press onPress={onPress} disabled={disabled} style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      {variant === "primary" ? (
        <View style={{ backgroundColor: t.fg, borderRadius: 999 }}>{inner}</View>
      ) : variant === "glass" ? (
        <Glass radius={999} interactive>
          {inner}
        </Glass>
      ) : (
        inner
      )}
    </Press>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, padding: 16 }, style]}>{children}</View>;
}

const DOTS = (t: ReturnType<typeof useTheme>): Record<Dot, string> => ({ red: t.red, orange: t.orange, green: t.green });

export function StatusDot({ dot, live, size = 8 }: { dot: Dot; live?: boolean; size?: number }) {
  const t = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = live ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }), -1) : 0;
  }, [live, p]);
  const halo = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.55, 0]), transform: [{ scale: interpolate(p.value, [0, 1], [1, 2.6]) }] }));
  const c = DOTS(t)[dot];
  return (
    <View style={{ width: size, height: size }}>
      {live && <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: c }, halo]} />}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: c }} />
    </View>
  );
}

/** Heard → transcribed → summarised. */
export function StageDots({ stage, withLabel }: { stage: Stage; withLabel?: boolean }) {
  const dots = pipelineDots(stage);
  const info = stageInfo(stage);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {dots.map((d, i) => (
          <StatusDot key={i} dot={d} size={6} live={info.live && d !== "green" && (i === 0 || dots[i - 1] === "green")} />
        ))}
      </View>
      {withLabel && <T kind="mute">{info.label}</T>}
    </View>
  );
}

/** Live waveform from the mic level; the bars spring toward each new reading. */
export function Wave({ active, bars = 11, color, height = 22 }: { active: boolean; bars?: number; color?: string; height?: number }) {
  const t = useTheme();
  const lvl = useSharedValue(0);
  const read = level;
  useEffect(() => {
    if (!active) {
      lvl.value = withTiming(0, { duration: 300 });
      return;
    }
    const id = setInterval(() => (lvl.value = withSpring(read(), { damping: 14, stiffness: 260 })), 60);
    return () => clearInterval(id);
  }, [active, lvl, read]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5, height }}>
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} i={i} n={bars} lvl={lvl} color={color ?? t.green} height={height} />
      ))}
    </View>
  );
}

function Bar({ i, n, lvl, color, height }: { i: number; n: number; lvl: { value: number }; color: string; height: number }) {
  const center = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  const wobble = useSharedValue(0);
  useEffect(() => {
    wobble.value = withDelay(i * 40, withRepeat(withSequence(withTiming(1, { duration: 380 + i * 23 }), withTiming(0, { duration: 420 + i * 17 })), -1));
  }, [i, wobble]);
  const a = useAnimatedStyle(() => {
    const h = 0.18 + Math.min(1, lvl.value * 1.5) * (0.3 + center * 0.7) * (0.75 + wobble.value * 0.25);
    return { transform: [{ scaleY: h }] };
  });
  return <Animated.View style={[{ width: 3, height, borderRadius: 2, backgroundColor: color }, a]} />;
}

/** The personal touch, top right on every main screen. */
export function Hmu() {
  const t = useTheme();
  return (
    <Press onPress={() => void WebBrowser.openBrowserAsync(X_PROFILE)} accessibilityRole="link" accessibilityLabel="Made by Aleks, on X">
      <Glass radius={999} interactive style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 3, paddingRight: 10, paddingVertical: 3 }}>
        <Image source={require("../../assets/aleks.jpg")} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.line }} />
        <Text style={{ fontSize: 12.5, color: t.ink2 }}>hmu, I made this ↗</Text>
      </Glass>
    </Press>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.24, backgroundColor: t.fg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: serif, color: t.bg, fontSize: size * 0.62, marginTop: -size * 0.04 }}>N</Text>
        <View style={{ position: "absolute", right: size * 0.12, bottom: size * 0.12, width: size * 0.14, height: size * 0.14, borderRadius: size, backgroundColor: t.clay }} />
      </View>
      <Text style={{ fontFamily: serif, fontSize: size * 0.82, color: t.fg }}>Nevernote</Text>
    </View>
  );
}

/** A soft shimmering placeholder while the list loads. */
export function Skeleton({ height = 64, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.45, 0.9]) }));
  return <Animated.View style={[{ height, borderRadius: 18, backgroundColor: t.bubble }, a, style]} />;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtWhen(iso: string, allDay?: boolean): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", ...(allDay ? {} : { hour: "numeric", minute: "2-digit" }) });
}
