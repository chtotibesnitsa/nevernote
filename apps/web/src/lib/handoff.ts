// Desktop sign-in finishes in the student's own browser (Google doesn't allow
// sign-in inside apps). Google comes back to the website with a one-time code
// that only the desktop app can redeem, because it holds the matching PKCE
// verifier, so the website hands the code to the app over nevernote://.

/** Where Google sends desktop sign-ins back to: a page on the website the auth allowlist already trusts. */
const SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://nevernote-git-site-v3-cookerprojects.vercel.app").replace(/\/$/, "");
export const desktopRedirect = `${SITE}/app`;

/** Set when this browser tab is the end of a desktop sign-in rather than a web one. */
export const handoffCode: string | null = (() => {
  if (typeof window === "undefined" || window.nevernote) return null;
  const code = new URLSearchParams(location.search).get("code");
  if (!code) return null;
  try {
    // A web sign-in started here would have left its own verifier behind.
    if (Object.keys(localStorage).some((k) => k.endsWith("-code-verifier"))) return null;
  } catch {
    /* storage blocked: still a handoff */
  }
  return code;
})();

export const appLink = (code: string) => `nevernote://auth?code=${encodeURIComponent(code)}`;
