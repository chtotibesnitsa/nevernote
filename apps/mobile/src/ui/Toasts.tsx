import { Pressable, Text, View } from "react-native";
import Animated, { FadeOutUp, LinearTransition, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme";
import { dismissToast, useApp } from "../state/app";
import { Glass, T } from "./kit";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 6, left: 12, right: 12, gap: 8 }}>
      {toasts.map((x) => (
        <Animated.View key={x.id} entering={SlideInUp.springify().damping(18)} exiting={FadeOutUp.duration(220)} layout={LinearTransition.springify()}>
          <Pressable onPress={() => dismissToast(x.id)}>
            <Glass radius={20} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T kind="h2" style={{ fontSize: 15 }}>{x.title}</T>
                {x.body ? <T kind="small">{x.body}</T> : null}
              </View>
              {x.action && (
                <Pressable
                  onPress={() => {
                    x.action!.run();
                    dismissToast(x.id);
                  }}
                  style={{ backgroundColor: t.fg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Text style={{ color: t.bg, fontWeight: "600", fontSize: 13 }}>{x.action.label}</Text>
                </Pressable>
              )}
            </Glass>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
