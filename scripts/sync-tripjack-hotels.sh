#!/usr/bin/env bash
# ============================================================
# Tripjack Hotel Static Data — Full Sync Script
# ============================================================
# Usage:
#   ./scripts/sync-tripjack-hotels.sh
#
# Environment variables (required):
#   SUPABASE_URL       — Your Supabase project URL
#   SUPABASE_ANON_KEY  — Your Supabase anon/public key
#
# Optional:
#   SYNC_MAX_PAGES     — Pages per batch (default: 10, each page = 100 hotels)
#   SYNC_DELAY_SECS    — Delay between batches (default: 1)
#   SYNC_MODE          — "full" (default) or "incremental"
#                        incremental uses lastUpdateTime from previous run
#
# Schedule weekly with cron:
#   0 3 * * 0 /path/to/scripts/sync-tripjack-hotels.sh >> /var/log/tripjack-sync.log 2>&1
# ============================================================

set -euo pipefail

# ── Config ──
SUPABASE_URL="${SUPABASE_URL:?'SUPABASE_URL is required'}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:?'SUPABASE_ANON_KEY is required'}"
MAX_PAGES="${SYNC_MAX_PAGES:-10}"
DELAY="${SYNC_DELAY_SECS:-1}"
MODE="${SYNC_MODE:-full}"
STATE_FILE="${STATE_FILE:-/tmp/tripjack-sync-state.json}"
FUNCTION_URL="$SUPABASE_URL/functions/v1/tripjack-hotel-search"
MAX_BATCHES=500  # Safety limit: 500 batches × 10 pages × 100 hotels = 500k max

# ── Helpers ──
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

call_sync() {
  local body="$1"
  curl -s -m 180 "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -d "$body"
}

parse_json() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1',''))" 2>/dev/null
}

# ── Load previous state for incremental sync ──
last_update_time=""
if [ "$MODE" = "incremental" ] && [ -f "$STATE_FILE" ]; then
  last_update_time=$(python3 -c "import json; d=json.load(open('$STATE_FILE')); print(d.get('lastSyncTime',''))" 2>/dev/null || echo "")
  if [ -n "$last_update_time" ]; then
    log "Incremental mode: using lastUpdateTime=$last_update_time"
  fi
fi

# ── Main sync loop ──
log "Starting Tripjack hotel sync (mode=$MODE, maxPages=$MAX_PAGES)"
cursor=""
total=0
batch=0
errors=0
start_time=$(date +%s)

while true; do
  batch=$((batch + 1))

  # Build request body
  body="{\"action\":\"sync-hotels\",\"maxPages\":$MAX_PAGES"
  if [ -n "$cursor" ]; then
    body="$body,\"nextCursor\":\"$cursor\""
  fi
  if [ -n "$last_update_time" ]; then
    body="$body,\"lastUpdateTime\":\"$last_update_time\""
  fi
  body="$body}"

  log "Batch $batch — cursor: ${cursor:0:20}..."

  response=$(call_sync "$body" || echo '{"success":false,"error":"curl failed"}')

  # Parse response
  success=$(echo "$response" | parse_json "success")
  synced=$(echo "$response" | parse_json "totalSynced")
  complete=$(echo "$response" | parse_json "complete")
  next_cursor=$(echo "$response" | parse_json "nextCursor")
  error_msg=$(echo "$response" | parse_json "error")

  if [ "$success" != "True" ]; then
    errors=$((errors + 1))
    log "ERROR in batch $batch: $error_msg"
    if [ $errors -ge 3 ]; then
      log "Too many consecutive errors ($errors). Aborting."
      break
    fi
    sleep 5
    continue
  fi

  errors=0  # Reset on success
  synced_num=${synced:-0}
  total=$((total + synced_num))
  log "Batch $batch done — synced: $synced_num, running total: $total"

  # Check completion
  if [ "$complete" = "True" ] || [ -z "$next_cursor" ] || [ "$next_cursor" = "None" ]; then
    log "Sync complete!"
    break
  fi

  cursor="$next_cursor"

  # Safety limit
  if [ $batch -ge $MAX_BATCHES ]; then
    log "Reached max batches ($MAX_BATCHES). Saving cursor for next run."
    break
  fi

  sleep "$DELAY"
done

end_time=$(date +%s)
duration=$((end_time - start_time))

# ── Save state for incremental runs ──
python3 -c "
import json
state = {
    'lastSyncTime': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'totalSynced': $total,
    'batches': $batch,
    'durationSeconds': $duration,
    'nextCursor': '${cursor:-}',
    'complete': $([ "$complete" = "True" ] && echo "true" || echo "false")
}
with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
print('State saved to $STATE_FILE')
"

log "============================================"
log "SYNC SUMMARY"
log "  Mode:     $MODE"
log "  Hotels:   $total"
log "  Batches:  $batch"
log "  Duration: ${duration}s"
log "  Complete: $complete"
if [ -n "$cursor" ] && [ "$complete" != "True" ]; then
  log "  Resume cursor saved — run again to continue"
fi
log "============================================"
