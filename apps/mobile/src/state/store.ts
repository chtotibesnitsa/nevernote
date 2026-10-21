// A tiny external store with selectors, so screens re-render only for the
// slice they read. Persisted slices write through to AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: () => void): () => void;
  use<U>(select: (s: T) => U): U;
}

export function createStore<T extends object>(initial: T, persistKey?: string): Store<T> & { ready: Promise<void> } {
  let state = initial;
  const subs = new Set<() => void>();
  const store = {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
      if (persistKey) void AsyncStorage.setItem(persistKey, JSON.stringify(state));
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    use<U>(select: (s: T) => U): U {
      return useSyncExternalStore(store.subscribe, () => select(state));
    },
    ready: Promise.resolve(),
  };
  if (persistKey) {
    store.ready = AsyncStorage.getItem(persistKey)
      .then((v) => {
        if (v) {
          state = { ...initial, ...JSON.parse(v) };
          subs.forEach((f) => f());
        }
      })
      .catch(() => {});
  }
  return store;
}
