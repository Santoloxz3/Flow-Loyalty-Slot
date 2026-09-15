#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SUI_BIN="${SUI_BIN:-}"
if [ -z "$SUI_BIN" ]; then
  if command -v sui >/dev/null 2>&1; then
    SUI_BIN="sui"
  elif [ -x /tmp/sui-cli/sui ]; then
    SUI_BIN="/tmp/sui-cli/sui"
  else
    echo "Missing Sui CLI. Set SUI_BIN=/path/to/sui." >&2
    exit 1
  fi
fi

ADMIN_ADDRESS="${ADMIN_ADDRESS:-0xe8ec5bf9587b55547f0f58bcb3c7341e90dff8d1a10abbfe2b4728e52a7813e8}"
FLOW_COIN_TYPE="${FLOW_COIN_TYPE:-0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW}"
CLOCK_ID="${CLOCK_ID:-0x6}"

FLEXIBLE_RPS="${FLEXIBLE_RPS:-0}"
LOYAL_RPS="${LOYAL_RPS:-0}"
WHALE_RPS="${WHALE_RPS:-0}"

FLEXIBLE_LOCK="${FLEXIBLE_LOCK:-0}"
LOYAL_LOCK="${LOYAL_LOCK:-2592000}"
WHALE_LOCK="${WHALE_LOCK:-7776000}"

OUT_FILE="${OUT_FILE:-$PACKAGE_DIR/.env.staking.generated}"

parse_json() {
  node -e "$1"
}

echo "Publishing package from $PACKAGE_DIR"
publish_json="$("$SUI_BIN" client ptb \
  --publish "$PACKAGE_DIR" \
  --assign upgrade_cap \
  --transfer-objects "[upgrade_cap]" "@$ADMIN_ADDRESS" \
  --gas-budget 300000000 \
  --json)"

package_id="$(printf '%s' "$publish_json" | parse_json '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
const changes = data.objectChanges || data.effects?.objectChanges || [];
const published = changes.find((item) => item.type === "published" || item.packageId);
if (!published) process.exit(1);
process.stdout.write(published.packageId || published.package_id);
')"

if [ -z "$package_id" ]; then
  echo "Could not parse package id from publish output." >&2
  exit 1
fi

echo "Creating staking pools for $FLOW_COIN_TYPE"
pools_json="$("$SUI_BIN" client ptb \
  --move-call "$package_id::flow_staking::create_pool" "<$FLOW_COIN_TYPE>" "$FLEXIBLE_RPS" "$FLEXIBLE_LOCK" "@$CLOCK_ID" \
  --assign flexible_cap \
  --transfer-objects "[flexible_cap]" "@$ADMIN_ADDRESS" \
  --move-call "$package_id::flow_staking::create_pool" "<$FLOW_COIN_TYPE>" "$LOYAL_RPS" "$LOYAL_LOCK" "@$CLOCK_ID" \
  --assign loyal_cap \
  --transfer-objects "[loyal_cap]" "@$ADMIN_ADDRESS" \
  --move-call "$package_id::flow_staking::create_pool" "<$FLOW_COIN_TYPE>" "$WHALE_RPS" "$WHALE_LOCK" "@$CLOCK_ID" \
  --assign whale_cap \
  --transfer-objects "[whale_cap]" "@$ADMIN_ADDRESS" \
  --gas-budget 100000000 \
  --json)"

pool_ids="$(printf '%s' "$pools_json" | parse_json '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
const changes = data.objectChanges || data.effects?.objectChanges || [];
const pools = changes
  .filter((item) => item.type === "created" && String(item.objectType || "").includes("::flow_staking::StakingPool<"))
  .map((item) => item.objectId);
if (pools.length < 3) process.exit(1);
process.stdout.write(pools.slice(0, 3).join("\n"));
')"

pool_for_lock() {
  expected_lock="$1"
  printf '%s\n' "$pool_ids" | while IFS= read -r pool_id; do
    lock_duration="$("$SUI_BIN" client object "$pool_id" --json | parse_json '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(String(data.content?.lock_duration ?? ""));
')"
    if [ "$lock_duration" = "$expected_lock" ]; then
      printf '%s' "$pool_id"
      return 0
    fi
  done
}

flexible_pool="$(pool_for_lock "$FLEXIBLE_LOCK")"
loyal_pool="$(pool_for_lock "$LOYAL_LOCK")"
whale_pool="$(pool_for_lock "$WHALE_LOCK")"

if [ -z "$flexible_pool" ] || [ -z "$loyal_pool" ] || [ -z "$whale_pool" ]; then
  echo "Could not map pool IDs by lock duration." >&2
  exit 1
fi

cat > "$OUT_FILE" <<EOF
VITE_FLOW_STAKING_PACKAGE_ID=$package_id
VITE_FLOW_STAKING_POOL_ID=$flexible_pool
VITE_FLOW_STAKING_POOL_FLEXIBLE_ID=$flexible_pool
VITE_FLOW_STAKING_POOL_LOYAL_ID=$loyal_pool
VITE_FLOW_STAKING_POOL_WHALE_ID=$whale_pool
EOF

echo "Wrote $OUT_FILE"
cat "$OUT_FILE"
