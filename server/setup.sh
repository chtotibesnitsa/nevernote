#!/usr/bin/env bash
# One-command backend setup. Usage: server/setup.sh <project-ref> <openrouter-key>
# Needs: `npx supabase login` done once, and the project already created at supabase.com.
set -euo pipefail
REF="${1:?project ref}"; LLM="${2:?OpenRouter key}"
cd "$(dirname "$0")"
SB="npx --yes supabase@latest --workdir ."
$SB link --project-ref "$REF"
$SB db push
CRON=$(openssl rand -hex 16); RC=$(openssl rand -hex 16)
cat > .env <<ENV
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=$LLM
LLM_MODEL=google/gemini-2.5-flash-lite
CRON_SECRET=$CRON
REVENUECAT_WEBHOOK_SECRET=$RC
ENV
$SB secrets set --env-file .env
$SB functions deploy
KEY=$($SB projects api-keys --project-ref "$REF" -o json | python3 -c 'import sys,json;print([k["api_key"] for k in json.load(sys.stdin) if k["name"]=="anon"][0])')
URL="https://$REF.supabase.co"
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$URL" "$KEY" > ../apps/web/.env
printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$URL" "$KEY" > ../apps/mobile/.env
echo; echo "Done. Wrote apps/web/.env and apps/mobile/.env."
echo "Nightly cron secret (for the SQL in server/README.md step 5): $CRON"
echo "RevenueCat webhook secret (step 6): $RC"
