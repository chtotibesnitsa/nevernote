export function newId(): string {
  const t = Date.now().toString(36);
  const r = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join("");
  return `${t}-${r}`;
}

export function deviceKind(): import("@nevernote/core").Device {
  const p = window.nevernote?.platform;
  if (p === "darwin") return "mac";
  if (p === "win32") return "windows";
  if (p === "linux") return "linux";
  return "web";
}
