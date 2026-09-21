import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSuiTestnetClient } from "./suiClient.mjs";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

const client = createSuiTestnetClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RARITY_RULES = Object.freeze({
  low: { rarity: "low", spins: 1, windowHours: 48 },
  medium: { rarity: "medium", spins: 1, windowHours: 24 },
  high: { rarity: "high", spins: 3, windowHours: 24 },
  legendary: { rarity: "legendary", spins: 5, windowHours: 24 },
});

const RESULT_RULES = Object.freeze([
  { maxRoll: 60, code: "no_win", bonusXp: 0, legacyAmount: 0 },
  { maxRoll: 70, code: "glass", bonusXp: 5, legacyAmount: 5000 },
  { maxRoll: 85, code: "moon", bonusXp: 15, legacyAmount: 10000 },
  { maxRoll: 95, code: "bag", bonusXp: 35, legacyAmount: 20000 },
  { maxRoll: 99, code: "flow", bonusXp: 55, legacyAmount: 30000 },
  { maxRoll: 100, code: "jackpot", bonusXp: 195, legacyAmount: 100000 },
]);

const RESULT_BY_CODE = Object.fromEntries(RESULT_RULES.map((rule) => [rule.code, rule]));

const normalize = (value) => String(value || "").toLowerCase();

function getRewardForRoll(roll) {
  return RESULT_RULES.find((rule) => roll <= rule.maxRoll) || RESULT_RULES[0];
}

async function verifySpinAuthorization({ wallet, requestId, timestamp, signature }) {
  const numericTimestamp = Number(timestamp);
  if (!signature || !Number.isFinite(numericTimestamp)) return false;
  if (Math.abs(Date.now() - numericTimestamp) > 5 * 60 * 1000) return false;

  const message = `Authorize FLOW NFT loyalty spin for wallet: ${wallet}, request: ${requestId}, timestamp: ${numericTimestamp}`;
  try {
    await verifyPersonalMessageSignature(new TextEncoder().encode(message), signature, {
      address: wallet,
    });
    return true;
  } catch (error) {
    console.warn("[loyalty] invalid spin signature:", error?.message || error);
    return false;
  }
}

async function discoverOwnedEligibleNfts(wallet) {
  // Keep NFT discovery aligned with the proven legacy implementation.
  const owned = await client.listOwnedObjects({
    owner: wallet,
    include: { content: true },
  });

  const objectIds = (owned.objects || []).map((item) => item.objectId).filter(Boolean);

  const diagnostics = {
    ownedObjectCount: objectIds.length,
    whitelistMatches: [],
    rarityMatches: [],
    eligibleMatches: [],
  };

  if (!objectIds.length) {
    return { eligibleNfts: [], diagnostics };
  }

  const [{ data: whitelist, error: whitelistError }, { data: rarityRows, error: rarityError }] =
    await Promise.all([
      supabase
        .from("nft_spin_whitelist")
        .select("object_id,spins_per_day")
        .in("object_id", objectIds),
      supabase
        .from("nft_loyalty_rarity")
        .select("object_id,rarity")
        .in("object_id", objectIds),
    ]);

  if (whitelistError) {
    throw new Error(`WHITELIST_QUERY_FAILED: ${whitelistError.message || whitelistError}`);
  }
  if (rarityError) {
    throw new Error(`RARITY_QUERY_FAILED: ${rarityError.message || rarityError}`);
  }

  diagnostics.whitelistMatches = (whitelist || []).map((row) => row.object_id);
  diagnostics.rarityMatches = (rarityRows || []).map((row) => ({
    objectId: row.object_id,
    rarity: row.rarity,
  }));

  if (!whitelist?.length) {
    return { eligibleNfts: [], diagnostics };
  }

  const rarityMap = new Map((rarityRows || []).map((row) => [normalize(row.object_id), row.rarity]));

  const eligibleNfts = whitelist
    .map((row) => {
      const configuredRarity = rarityMap.get(normalize(row.object_id));
      const rule = configuredRarity ? RARITY_RULES[configuredRarity] : null;

      if (!rule) {
        console.warn(
          "[loyalty] whitelisted NFT has no configured rarity and will be ignored:",
          row.object_id,
        );
        return null;
      }

      return {
        objectId: row.object_id,
        rarity: rule.rarity,
        allowance: rule.spins,
        windowHours: rule.windowHours,
      };
    })
    .filter(Boolean);

  diagnostics.eligibleMatches = eligibleNfts.map((nft) => ({
    objectId: nft.objectId,
    rarity: nft.rarity,
    allowance: nft.allowance,
    windowHours: nft.windowHours,
  }));

  return { eligibleNfts, diagnostics };
}

async function getOwnedEligibleNfts(wallet) {
  const { eligibleNfts } = await discoverOwnedEligibleNfts(wallet);
  return eligibleNfts;
}

async function getUsage(wallet, objectIds) {
  if (!objectIds.length) return new Map();

  const { data, error } = await supabase
    .from("loyalty_nft_usage")
    .select("object_id,period_started_at,used_spins")
    .eq("wallet", wallet)
    .in("object_id", objectIds);

  if (error) throw error;
  return new Map((data || []).map((row) => [normalize(row.object_id), row]));
}

function calculateAvailability(nft, usageRow, nowMs = Date.now()) {
  if (!usageRow?.period_started_at) {
    return {
      ...nft,
      usedSpins: 0,
      spinsLeft: nft.allowance,
      nextResetAt: null,
    };
  }

  const startedMs = new Date(usageRow.period_started_at).getTime();
  const windowMs = nft.windowHours * 60 * 60 * 1000;
  const resetAtMs = startedMs + windowMs;

  if (!Number.isFinite(startedMs) || nowMs >= resetAtMs) {
    return {
      ...nft,
      usedSpins: 0,
      spinsLeft: nft.allowance,
      nextResetAt: null,
    };
  }

  const usedSpins = Math.max(0, Number(usageRow.used_spins || 0));
  return {
    ...nft,
    usedSpins,
    spinsLeft: Math.max(0, nft.allowance - usedSpins),
    nextResetAt: new Date(resetAtMs).toISOString(),
  };
}

async function getAvailability(wallet, eligibleNfts) {
  const usage = await getUsage(wallet, eligibleNfts.map((nft) => nft.objectId));
  return eligibleNfts.map((nft) => calculateAvailability(nft, usage.get(normalize(nft.objectId))));
}

async function getProfile(wallet) {
  const { data, error } = await supabase.rpc("loyalty_profile_snapshot", { p_wallet: wallet });
  if (error) throw error;
  const profile = data?.[0] || null;
  if (!profile) return null;

  return {
    wallet: profile.wallet,
    loyaltyXp: Number(profile.loyalty_xp || 0),
    bonusXp: Number(profile.bonus_xp || 0),
    totalXp: Number(profile.total_xp || 0),
    currentTier: profile.current_tier || "starter",
    highestTierRank: Number(profile.highest_tier_rank || 0),
    activeStakingBoost: Number(profile.active_staking_boost || 0),
    boostStartedAt: profile.boost_started_at || null,
    boostExpiresAt: profile.boost_expires_at || null,
  };
}

async function getExistingSpin(wallet, requestId) {
  if (!requestId) return null;

  const { data, error } = await supabase
    .from("loyalty_spins")
    .select("spin_id,request_id,object_id,rarity,roll,result_code,loyalty_xp,bonus_xp,total_xp")
    .eq("wallet", wallet)
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const reward = RESULT_BY_CODE[data.result_code] || RESULT_RULES[0];
  return {
    spinId: data.spin_id,
    requestId: data.request_id,
    objectId: data.object_id,
    rarity: data.rarity,
    roll: Number(data.roll),
    resultCode: data.result_code,
    legacyAmount: reward.legacyAmount,
    loyaltyXp: Number(data.loyalty_xp || 0),
    bonusXp: Number(data.bonus_xp || 0),
    spinTotalXp: Number(data.total_xp || 0),
  };
}

export async function getLoyaltyStatus(req, res) {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet required" });

  try {
    const [{ eligibleNfts, diagnostics }, profile] = await Promise.all([
      discoverOwnedEligibleNfts(wallet),
      getProfile(wallet),
    ]);
    const nftStatus = await getAvailability(wallet, eligibleNfts);
    const spinsLeft = nftStatus.reduce((sum, item) => sum + item.spinsLeft, 0);

    return res.json({
      spinsLeft,
      nftStatus,
      profile,
      rules: RARITY_RULES,
      ...(process.env.IS_PULL_REQUEST === "true" ? { diagnostics } : {}),
    });
  } catch (error) {
    console.error("[loyalty] status failed:", error);
    return res.status(500).json({
      message: "Unable to load loyalty status",
      ...(process.env.IS_PULL_REQUEST === "true"
        ? { diagnosticError: error?.message || String(error) }
        : {}),
    });
  }
}

export async function startLoyaltySpin(req, res) {
  const wallet = req.body?.wallet;
  const requestId = String(req.body?.requestId || "").trim() || crypto.randomUUID();
  const timestamp = req.body?.timestamp;
  const signature = req.body?.signature;

  if (!wallet) return res.status(400).json({ message: "Wallet required" });

  const authorized = await verifySpinAuthorization({ wallet, requestId, timestamp, signature });
  if (!authorized) {
    return res.status(401).json({ message: "Wallet signature required for NFT Free Spin" });
  }

  try {
    const existing = await getExistingSpin(wallet, requestId);
    if (existing) {
      const [profile, eligibleNfts] = await Promise.all([
        getProfile(wallet),
        getOwnedEligibleNfts(wallet),
      ]);
      const nftStatus = await getAvailability(wallet, eligibleNfts);
      return res.json({
        ...existing,
        profile,
        spinsLeft: nftStatus.reduce((sum, item) => sum + item.spinsLeft, 0),
        nftStatus,
        idempotentReplay: true,
      });
    }

    const eligibleNfts = await getOwnedEligibleNfts(wallet);
    if (!eligibleNfts.length) {
      return res.status(403).json({ message: "An eligible FLOW NFT is required", spinsLeft: 0 });
    }

    const availability = await getAvailability(wallet, eligibleNfts);
    const target = availability.find((item) => item.spinsLeft > 0);
    if (!target) {
      return res.status(403).json({
        message: "No NFT Free Spins available",
        spinsLeft: 0,
        nftStatus: availability,
      });
    }

    const roll = crypto.randomInt(1, 101);
    const reward = getRewardForRoll(roll);

    const { data, error } = await supabase.rpc("loyalty_start_spin", {
      p_wallet: wallet,
      p_object_id: target.objectId,
      p_rarity: target.rarity,
      p_allowance: target.allowance,
      p_window_hours: target.windowHours,
      p_request_id: requestId,
      p_roll: roll,
      p_result_code: reward.code,
      p_bonus_xp: reward.bonusXp,
    });

    if (error) {
      if (/NO_SPINS_AVAILABLE/i.test(error.message || "")) {
        return res.status(409).json({ message: "NFT Free Spin already consumed" });
      }
      throw error;
    }

    const row = data?.[0];
    if (!row) throw new Error("loyalty_start_spin returned no data");

    const refreshedAvailability = await getAvailability(wallet, eligibleNfts);
    const profile = await getProfile(wallet);

    return res.json({
      spinId: row.spin_id,
      requestId,
      objectId: target.objectId,
      rarity: target.rarity,
      roll: Number(row.roll),
      resultCode: row.result_code,
      legacyAmount: reward.legacyAmount,
      loyaltyXp: Number(row.spin_loyalty_xp || 0),
      bonusXp: Number(row.spin_bonus_xp || 0),
      spinTotalXp: Number(row.spin_total_xp || 0),
      tierUnlocked: Boolean(row.tier_unlocked),
      profile,
      spinsLeft: refreshedAvailability.reduce((sum, item) => sum + item.spinsLeft, 0),
      nftStatus: refreshedAvailability,
    });
  } catch (error) {
    console.error("[loyalty] spin failed:", error);
    return res.status(500).json({ message: "Unable to process NFT Free Spin" });
  }
}
