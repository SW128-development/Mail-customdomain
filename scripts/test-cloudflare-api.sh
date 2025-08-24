#!/usr/bin/env bash
set -euo pipefail

# Config
WORKER_URL="https://duckmail-cloudflare-provider.lungw96.workers.dev"
EMAIL="johndoe@10xco.de"
PASS="123123"
PAGE="1"

# Helpers
have_jq() { command -v jq >/dev/null 2>&1; }
pretty() {
  if have_jq; then
    jq . || true
  else
    cat
  fi
}

extract_token() {
  if have_jq; then
    jq -r .token
  else
    # naive fallback: find "token":"..."
    sed -n 's/.*"token"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1
  fi
}

extract_first_msg_id() {
  if have_jq; then
    jq -r '."hydra:member"[0].id // empty'
  else
    # fallback: try to grab first occurrence of "id":"..." after hydra:member
    awk 'BEGIN{RS="{";FS=","} /hydra:member/{found=1} found && /"id"/{for(i=1;i<=NF;i++){if($i ~ /"id"/){gsub(/.*"id"\s*:\s*"/,"",$i); gsub(/".*/,"",$i); print $i; exit}}}'
  fi
}

log() { echo -e "\n$1"; }

# 1) Domains
log "1) Domains"
curl -sS "${WORKER_URL}/domains" | pretty

# 2) Create account
log "2) Create account ${EMAIL}"
curl -sS -X POST "${WORKER_URL}/accounts" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"${EMAIL}\",\"password\":\"${PASS}\"}" | pretty

# 3) Get token
log "3) Get token"
TOKEN=$(curl -sS -X POST "${WORKER_URL}/token" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"${EMAIL}\",\"password\":\"${PASS}\"}" | extract_token)

if [ -z "${TOKEN}" ] || [ "${TOKEN}" = "null" ]; then
  echo "Failed to obtain token" >&2
  exit 1
fi

echo "TOKEN: ${TOKEN:0:16}…"

# 4) Me
log "4) Me"
curl -sS "${WORKER_URL}/me" -H "Authorization: Bearer ${TOKEN}" | pretty

# 5) Messages (page ${PAGE})
log "5) Messages (page ${PAGE})"
MSGS_JSON=$(curl -sS "${WORKER_URL}/messages?page=${PAGE}" -H "Authorization: Bearer ${TOKEN}")
echo "$MSGS_JSON" | pretty

# 6-8) If there is a message id, detail -> mark seen -> delete
MSG_ID=$(echo "$MSGS_JSON" | extract_first_msg_id || true)
if [ -n "${MSG_ID:-}" ]; then
  log "6) Message detail ${MSG_ID}"
  curl -sS "${WORKER_URL}/messages/${MSG_ID}" -H "Authorization: Bearer ${TOKEN}" | pretty

  log "7) Mark seen"
  curl -sS -X PATCH "${WORKER_URL}/messages/${MSG_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/merge-patch+json" \
    -d '{"seen":true}' | pretty

  log "8) Delete"
  curl -i -sS -X DELETE "${WORKER_URL}/messages/${MSG_ID}" -H "Authorization: Bearer ${TOKEN}" | head -n 1
else
  echo "No messages to operate on."
fi 