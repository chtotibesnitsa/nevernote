# Test Nevernote on every platform

Do the setup once (A), then test each platform (B to E), then check that they agree with each other (F).

Live backend: Supabase project `bbvaqcsyinbeopyhrqzi`. Website after the PR is merged: https://chtotibesnitsa.github.io/nevernote/

## A. One-time setup

| Step | Where | Result |
|---|---|---|
| 1. AI notes key | OpenRouter: make a key and add $5 of credit. Supabase → Edge Functions → Secrets → `LLM_API_KEY` | Summaries, study guides and Ask work |
| 2. Google sign-in | Google Cloud → APIs and Services → Credentials → OAuth client, type **Web**. Authorized redirect URI: `https://bbvaqcsyinbeopyhrqzi.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase → Authentication → Providers → Google | "Continue with Google" works |
| 3. Website | Merge PR #1. Settings → Pages is already set to GitHub Actions. The **Deploy website** workflow publishes it | The site is live |
| 4. Supabase plan | Upgrade the NeverNote org to Pro ($25 a month) before you post | The project never pauses and has room for storage |

Already done for you: database, security rules, the five functions, the overnight batch, the sign-in redirect URLs, and the website deploy workflow.

Check the backend before anything else. In Supabase → Edge Functions, `summarize`, `ask`, `nightly`, `delete-account` and `revenuecat` should all show as Active.

## B. Website (nothing to install)

1. Open the site. Check the landing page, the phone layout, the pricing section and the FAQ.
2. Click **Start free**. You land in the app.
3. **Settings → Sign in with Google.** You come back signed in.
4. **Record.** The browser transcribes on your device. The first time it downloads a small model.
5. Say: "The lab report is due Friday at 11:59 p.m. and this will be on the test."
6. Expected: a due-date chip and a star appear within a few seconds. Stop the recording.
7. Open the note. The three dots go red, orange, then green once the AI notes arrive. You should see notes, a study guide and key terms.
8. Reload the page. The note is still there.

## C. Mac and Windows

1. Run `npm install && npm run dev:desktop`. For a real installer, push a tag such as `v1.0.0`; the **Desktop release** workflow builds Mac and Windows installers.
2. First recording downloads about 530 MB of models. Wait for it.
3. Sign in with the same Google account as the website.
4. Expected: the note you made on the web shows up in the list within a minute.
5. Record a short class. Stop. Expected: speaker labels (S1, S2) appear after you stop.

## D. iPhone and iPad (TestFlight)

You need your Apple developer account and an app record for `app.nevernote`.

```sh
cd apps/mobile
npm install --legacy-peer-deps
npx eas login
npx eas build -p ios --profile production     # about 25 minutes in the cloud
npx eas submit -p ios --latest                # sends it to TestFlight
```

The build already points at the live backend. Install from TestFlight, then:

1. Open the app. Allow the microphone and notifications.
2. **Settings → Sign in** (Apple, Google or email). Use the same Google account.
3. Start a recording, lock the screen, wait a minute, unlock. It should still be recording.
4. Say the due-date sentence from step B5. A notification should fire during recording.
5. Stop. Expected: transcript with speaker labels, then notes and a study guide.
6. Tap a due date. The iPhone calendar sheet opens (this is the free path).
7. Pause and resume. The note stays one note.

## E. Pro paywalls

Pro purchases need RevenueCat and two App Store products, so until those exist you can test the walls but not the buying.

1. Create `nevernote_pro_monthly` ($3.99) and `nevernote_pro_yearly` ($29.99) in App Store Connect.
2. In RevenueCat, attach both to the entitlement `pro` and add the webhook in `server/README.md`.
3. Put the RevenueCat public iOS key in `apps/mobile/.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and rebuild.

Test the walls today on a free account:

| Do this | Expect |
|---|---|
| Open a note, tap **Ask** | Pro sheet |
| Tap "Add all to calendar" | Pro sheet |
| Record 4 classes in one day | The 4th is queued for overnight, or instant after a 5-second sponsor card |
| Dismiss the Pro sheet three times | No more Pro prompts for a month |

To test Pro without paying, set your own plan in Supabase SQL Editor:

```sql
update profiles set plan = 'pro' where id = (select id from auth.users where email = 'you@example.com');
```

Then Ask and calendar auto-add should work. Set it back to `'free'` afterwards.

## F. Do the platforms agree?

| Test | Expect |
|---|---|
| Record on the phone, wait up to one minute, look at the website and Mac | The same note, transcript, summary and due dates |
| Rename a speaker on the website | The new name shows on the phone and Mac |
| Delete a note on the Mac | It disappears on the phone and website |
| Record on the phone with Airplane mode on, then turn it off | Dots go orange to green on their own |
| Sign out and back in | Everything comes back (history is in your account) |
| Settings → Delete account | Notes and account are gone everywhere |

How fast does data show up? Each app checks for changes every 60 seconds and right away when you open it or return to it. It is not instant push. If you want true instant sync, tell me and I'll add Supabase Realtime.

## G. Check the numbers

- Supabase SQL Editor: `select * from admin_daily order by day desc;` shows signups, recordings, minutes, summaries, upsells and upgrades.
- Cost of AI notes per summary: `select avg(tokens_in), avg(tokens_out) from summary_jobs where status = 'done';` Compare with the profit model.
- Edge Functions → Logs shows any failed summary and why.

## If something is wrong

| Symptom | Likely cause |
|---|---|
| "Continue with Google" shows an error | Step A2 redirect URI or client secret |
| Notes stay orange | `LLM_API_KEY` missing (step A1). The error is in Edge Functions → Logs → `summarize` |
| Website shows a blank page | Pages is not deployed yet. Check the **Deploy website** run in Actions |
| Sign-in loops back to the landing page | Authentication → URL Configuration must list the site URL |
| iPhone crashes when you stop recording | Send me the crash log. The speaker-label module has only been compiled on Linux so far |
