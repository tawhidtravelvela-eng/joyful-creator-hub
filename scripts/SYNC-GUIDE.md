# Tripjack Hotel Static Data — Sync Guide

## Overview

Tripjack requires a local hotel catalogue (`tripjack_hotels` table) for search.
This guide covers the initial sync and weekly auto-updates.

---

## 1. Initial Full Sync (New Deployment)

### Option A: Bash Script (Recommended)

```bash
# Set your Supabase credentials
export SUPABASE_URL="https://your-supabase-url.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Run full sync
chmod +x scripts/sync-tripjack-hotels.sh
./scripts/sync-tripjack-hotels.sh
```

The script will:
- Paginate through ALL Tripjack hotels (100 per page, 10 pages per batch)
- Save progress to `/tmp/tripjack-sync-state.json` — safe to interrupt and resume
- Log progress to stdout

### Option B: Browser Console

Open your app in a browser and paste in the dev console:

```js
let cursor = null, total = 0;
while (true) {
  const body = { action: "sync-hotels", maxPages: 10 };
  if (cursor) body.nextCursor = cursor;
  const res = await fetch("/functions/v1/tripjack-hotel-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());
  total += res.totalSynced || 0;
  console.log(`Synced: ${total}, complete: ${res.complete}`);
  if (res.complete || !res.nextCursor) break;
  cursor = res.nextCursor;
  await new Promise(r => setTimeout(r, 1000));
}
```

---

## 2. Weekly Auto-Sync (Incremental Updates)

### For Supabase Cloud

Run `scripts/setup-tripjack-cron.sql` in the SQL Editor:
1. Go to **SQL Editor** in your Supabase Dashboard
2. Replace `YOUR_SUPABASE_URL` and `YOUR_ANON_KEY` with your values
3. Execute the SQL

### For Self-Hosted Supabase

**Option A: pg_cron (if available)**
- Same SQL as above, run via `psql`
- Ensure `pg_cron` and `pg_net` extensions are enabled in your PostgreSQL config

**Option B: System cron**
```bash
# Add to crontab: crontab -e
0 3 * * 0 SUPABASE_URL="https://your-url" SUPABASE_ANON_KEY="your-key" SYNC_MODE=incremental /path/to/scripts/sync-tripjack-hotels.sh >> /var/log/tripjack-sync.log 2>&1
```

---

## 3. Sync Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `full` (default) | Fetches all hotels from scratch | Initial setup, data reset |
| `incremental` | Only fetches hotels updated since last sync | Weekly cron jobs |

Set mode via environment variable:
```bash
SYNC_MODE=incremental ./scripts/sync-tripjack-hotels.sh
```

---

## 4. Monitoring

### Check sync job status (pg_cron)
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'tripjack-weekly-hotel-sync')
ORDER BY start_time DESC LIMIT 5;
```

### Check hotel count
```sql
SELECT 
  count(*) AS total,
  count(*) FILTER (WHERE is_deleted = false) AS active,
  count(*) FILTER (WHERE is_deleted = true) AS deleted,
  max(updated_at) AS last_updated
FROM tripjack_hotels;
```

---

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| Sync times out | Reduce `maxPages` to 5 or `SYNC_MAX_PAGES=5` |
| No hotels found for city | Run full sync first — incremental won't help if catalogue is empty |
| Proxy errors | Check that your server can reach `65.20.67.77` |
| Edge function not deployed | Run `supabase functions deploy tripjack-hotel-search` |
| Missing secrets | Set `PROXY_SECRET_KEY` in your Supabase secrets |
