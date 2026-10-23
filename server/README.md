# Nevernote server

A Supabase project serves every app. It provides:

- **Accounts:** Apple, Google and email sign-in.
- **Sync:** one `notes` table with row-level security.
- **AI notes:** Edge Functions that call one cheap, OpenAI-compatible LLM.
- **Pro:** the plan switches on through a RevenueCat webhook.

The apps work without any of this; they just stay local. Transcription never touches the server.

| Function | What it does | Auth |
|---|---|---|
| `summarize` | Writes notes, a study guide, key terms and due dates for one note. Free accounts get 5 instant AI notes a day, and each update to a note counts as one. After that the note is queued for overnight, or written now after a 5-second sponsor card. | User JWT |
| `ask` | "Ask your notes" (Pro only; returns 402 otherwise) | User JWT |
| `nightly` | Works through the overnight queue | `Bearer $CRON_SECRET` |
| `revenuecat` | App Store purchases flip `profiles.plan` | `Bearer $REVENUECAT_WEBHOOK_SECRET` |

## Deploy (about 15 minutes)

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine to start). Note the project ref, the URL and the anon key.
2. **Push the schema and functions:**
   ```sh
   npm i -g supabase
   supabase link --project-ref <ref> --workdir server
   supabase db push --workdir server
   cp server/.env.example server/.env   # fill in LLM_API_KEY, CRON_SECRET, REVENUECAT_WEBHOOK_SECRET
   supabase secrets set --env-file server/.env --workdir server
   supabase functions deploy --workdir server
   ```
3. **Get an LLM key.** Make an [OpenRouter](https://openrouter.ai) key; the default model is `google/gemini-2.5-flash-lite`, about $0.10 per million input tokens. A 50-minute class is roughly 8k tokens, so about a tenth of a cent per summary. Any OpenAI-compatible endpoint works; set `LLM_BASE_URL` and `LLM_MODEL`.
4. **Set up sign-in** (Authentication → Providers):
   - **Apple:**
     - Enable it.
     - Under *Client IDs*, add the iOS bundle id `app.nevernote` (the native sign-in sends an ID token for it) and your web Services ID.
     - Add the secret key from your Apple developer account.
   - **Google:**
     - Enable it with an OAuth client from Google Cloud.
     - Add `nevernote://auth` and your site URL to *Redirect URLs* (Authentication → URL Configuration).
   - **Email:**
     - Edit the *Magic Link* template so it includes `{{ .Token }}`. The phone app asks for the 6-digit code.
5. **Schedule the overnight batch** (SQL editor; enable the `pg_cron` and `pg_net` extensions first):
   ```sql
   select cron.schedule('nevernote-nightly', '0 8 * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/nightly',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     );
   $$);
   ```
   08:00 UTC is 3–4 a.m. in US Eastern time, so notes are waiting before class.
6. **Connect RevenueCat:**
   - Create the products `nevernote_pro_monthly` ($3.99) and `nevernote_pro_yearly` ($29.99) in App Store Connect.
   - In RevenueCat, attach both to the entitlement `pro` and the *current* offering.
   - Add a webhook to `https://<ref>.supabase.co/functions/v1/revenuecat` with the Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
7. **Point the apps at the project:**
   - Web: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
   - iOS: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `apps/mobile/.env`, or as EAS secrets.

## Watching growth

Signed-in apps write first-party events (`recording_started`, `recording_finished`, `upsell_shown`, `pro_opened`, `upgrade`, …) to `usage_events`. Raw audio and transcripts are never part of an event. The `admin_daily` view gives daily actives, recordings, minutes and upgrades:

```sql
select * from admin_daily order by day desc limit 30;
```

The view only works with the service role key, never from an app.
