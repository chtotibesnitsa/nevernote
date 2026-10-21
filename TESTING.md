# Test it end to end

Order matters: server first, so the apps you build already point at it.

## 1. Backend (10 min)
1. Create a project at supabase.com. Copy the **project ref** (the id in the URL).
2. Make an OpenRouter key at openrouter.ai (add $5 credit).
3. `npx supabase login`, then `server/setup.sh <ref> <openrouter-key>`.
4. Google sign-in: Supabase → Authentication → Providers → Google (client id and secret from Google Cloud → Credentials → OAuth client, type Web). Add `nevernote://auth` and `http://localhost:5173` under Authentication → URL Configuration → Redirect URLs. Add the Supabase callback URL shown on the provider page to the Google client's authorized redirect URIs.
5. Optional for now: Apple sign-in, RevenueCat, nightly cron (see server/README.md).

## 2. Web and Mac (same code, same account)
- Web: `npm install && npm run dev:web`, open http://localhost:5173, sign in with Google.
- Mac: `npm run dev:desktop`, sign in with the same Google account. The first recording downloads ~530 MB of models.

## 3. iPhone via TestFlight
Needs your Apple Developer account (paid) and an app record for `app.nevernote` in App Store Connect.
```sh
cd apps/mobile
npm install --legacy-peer-deps
npx eas login
npx eas build -p ios --profile production      # ~20-30 min in the cloud, no Xcode needed
npx eas submit -p ios --latest                 # uploads to TestFlight
```
Or in Xcode: `npx expo prebuild -p ios && open ios/*.xcworkspace`, set your team, Product → Archive → Distribute → TestFlight.
Because `apps/mobile/.env` is already filled in by step 1, the build talks to your backend.

## 4. What to check
| Test | Expect |
|---|---|
| Record 1 min on the phone, lock the screen | Keeps recording, words appear, orb stays alive |
| Stop | Speaker labels appear, three dots go red → orange → green after the summary |
| Say "the test is due Friday" | Notification fires during recording |
| Note → date row | Opens the iOS calendar sheet (free) |
| Sign in with Google on the phone, then open web and Mac | Same notes appear on all three |
| Delete a note on one device | Gone on the others |
| Notes → Pro (use a TestFlight sandbox account once RevenueCat is set up) | Calendar auto-add and Ask your notes unlock |
| Insights tab, and `select * from admin_daily` in Supabase | Counts match what you did |

Not testable yet: Pro purchases (needs RevenueCat plus App Store products), and the native speaker-label module has only been compiled on Linux, so the first on-device run is the real test. Send me any crash log or screenshot and I'll fix it.
