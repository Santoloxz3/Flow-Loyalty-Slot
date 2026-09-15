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
PACKAGE_ID="${PACKAGE_ID:-0x642708e9efb9052026555608c1d6f8f6b33a9f7b106497ad93121f975f797548}"

FLEXIBLE_POOL_ID="${FLEXIBLE_POOL_ID:-0xb914f28e385b0d193c13e9cb9d6621466a209fd98376098aff97bc799b0bd234}"
LOYAL_POOL_ID="${LOYAL_POOL_ID:-0x0aac4a32e17c57b45b83f1aa4c4ea8014e3601d63258c4e40ec7257e7c8a20f4}"
WHALE_POOL_ID="${WHALE_POOL_ID:-0xd2a17cf5c2554e8d16d19c6a0f3720fbc13663aefedcb528422c1b9dc675d40d}"

FLEXIBLE_ADMIN_CAP_ID="${FLEXIBLE_ADMIN_CAP_ID:-0x5540cf578ef5f5c81017c7d7d4b6bde5aa82266085c69a35cc81d75f4cc14ee8}"
LOYAL_ADMIN_CAP_ID="${LOYAL_ADMIN_CAP_ID:-0x9b0ea9266bc882982dbdb148b87a9c2537f897ba8697d7f715da0b4a2d15619a}"
WHALE_ADMIN_CAP_ID="${WHALE_ADMIN_CAP_ID:-0x6f153e6d615c519d1b3fcce02ee3f8098ba8587459ae651764eaea915fd77f55}"

: "${FLOW_COIN_ID:?Set FLOW_COIN_ID with a FLOW coin object owned by the admin wallet}"
: "${FLEXIBLE_REWARD_AMOUNT:?Set FLEXIBLE_REWARD_AMOUNT in base units}"
: "${LOYAL_REWARD_AMOUNT:?Set LOYAL_REWARD_AMOUNT in base units}"
: "${WHALE_REWARD_AMOUNT:?Set WHALE_REWARD_AMOUNT in base units}"

active_address="$("$SUI_BIN" client active-address)"
if [ "$active_address" != "$ADMIN_ADDRESS" ]; then
  echo "Active Sui address is $active_address, expected admin $ADMIN_ADDRESS." >&2
  exit 1
fi

cd "$PACKAGE_DIR"
"$SUI_BIN" client ptb \
  --split-coins "@$FLOW_COIN_ID" "[$FLEXIBLE_REWARD_AMOUNT,$LOYAL_REWARD_AMOUNT,$WHALE_REWARD_AMOUNT]" \
  --assign reward_coins \
  --move-call "$PACKAGE_ID::flow_staking::fund_rewards" "<$FLOW_COIN_TYPE>" "@$FLEXIBLE_ADMIN_CAP_ID" "@$FLEXIBLE_POOL_ID" reward_coins.0 \
  --move-call "$PACKAGE_ID::flow_staking::fund_rewards" "<$FLOW_COIN_TYPE>" "@$LOYAL_ADMIN_CAP_ID" "@$LOYAL_POOL_ID" reward_coins.1 \
  --move-call "$PACKAGE_ID::flow_staking::fund_rewards" "<$FLOW_COIN_TYPE>" "@$WHALE_ADMIN_CAP_ID" "@$WHALE_POOL_ID" reward_coins.2 \
  --gas-budget 50000000 \
  --summary
