import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createSuiTestnetClient } from "./suiClient.mjs";

const client = createSuiTestnetClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let payoutKeypair = null;
try {
  if (process.env.PRIVATE_KEY) {
    const keyBytes = Buffer.from(process.env.PRIVATE_KEY, "base64").subarray(0, 32);
    payoutKeypair = Ed25519Keypair.fromSecretKey(keyBytes);
  }
} catch (error) {
  console.error("[staking-boost] unable to initialize payout key:", error);
}

const normalize = (value) => String(value || "").toLowerCase();

async function getProfile(wallet) {
  const { data, error } = await supabase.rpc("loyalty_profile_snapshot", { p_wallet: wallet });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;

  return {
    wallet: row.wallet,
    loyaltyXp: Number(row.loyalty_xp || 0),
    bonusXp: Number(row.bonus_xp || 0),
    totalXp: Number(row.total_xp || 0),
    currentTier: row.current_tier || "starter",
    activeStakingBoost: Number(row.active_staking_boost || 0),
    boostStartedAt: row.boost_started_at || null,
    boostExpiresAt: row.boost_expires_at || null,
  };
}

function getTransactionEnvelope(result) {
  return result?.Transaction || result?.FailedTransaction || null;
}

function getTransactionSender(tx) {
  return tx?.transaction?.sender || tx?.sender || tx?.effects?.sender || null;
}

function findRewardEvent(tx, wallet) {
  const events = tx?.events || [];
  for (const event of events) {
    const eventType = String(event?.eventType || event?.type || "");
    const json = event?.json || event?.parsedJson || {};
    const eventUser = normalize(json?.user);

    if (eventUser !== normalize(wallet)) continue;

    if (eventType.endsWith("::flow_staking::RewardClaimed")) {
      return {
        eventType: "RewardClaimed",
        amountNanos: BigInt(json?.amount || 0),
        poolId: String(json?.pool_id || json?.poolId || ""),
      };
    }

    if (eventType.endsWith("::flow_staking::Unstaked")) {
      return {
        eventType: "Unstaked",
        amountNanos: BigInt(json?.reward || 0),
        poolId: String(json?.pool_id || json?.poolId || ""),
      };
    }
  }
  return null;
}

async function loadClaim(digest) {
  const { data, error } = await supabase
    .from("staking_boost_claims")
    .select("*")
    .eq("claim_digest", digest)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function payBonus(wallet, amountNanos) {
  if (!payoutKeypair) throw new Error("Payout wallet is not configured");
  if (!process.env.FLOW_COIN_TYPE) throw new Error("FLOW_COIN_TYPE is not configured");
  if (amountNanos <= 0n) return null;

  const payoutWallet = payoutKeypair.getPublicKey().toSuiAddress();
  const payoutBalance = await client.getBalance({
    owner: payoutWallet,
    coinType: process.env.FLOW_COIN_TYPE,
  });

  const available = BigInt(payoutBalance.balance?.balance || 0);
  if (available < amountNanos) {
    throw new Error("Insufficient FLOW in staking boost reserve");
  }

  const tx = new Transaction();
  const coin = tx.coin({
    balance: amountNanos,
    type: process.env.FLOW_COIN_TYPE,
  });
  tx.transferObjects([coin], wallet);

  const result = await client.signAndExecuteTransaction({
    signer: payoutKeypair,
    transaction: tx,
    include: { effects: true },
  });

  const envelope = getTransactionEnvelope(result);
  if (!envelope || envelope.status?.success === false || result?.FailedTransaction) {
    throw new Error(envelope?.status?.error?.message || "Staking boost transaction failed");
  }

  return envelope.digest;
}

export async function getStakingBoost(req, res) {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet required" });

  try {
    const profile = await getProfile(wallet);
    return res.json({ profile });
  } catch (error) {
    console.error("[staking-boost] status failed:", error);
    return res.status(500).json({ message: "Unable to load staking boost" });
  }
}

export async function claimStakingBoost(req, res) {
  const wallet = req.body?.wallet;
  const digest = String(req.body?.digest || "").trim();

  if (!wallet || !digest) {
    return res.status(400).json({ message: "Wallet and claim digest are required" });
  }

  try {
    const existing = await loadClaim(digest);
    if (existing?.status === "success") {
      return res.json({
        alreadyProcessed: true,
        boostPercent: Number(existing.boost_percent || 0),
        bonusFlow: Number(existing.bonus_reward_nanos || 0) / 1e9,
        bonusTx: existing.bonus_tx_hash || null,
      });
    }
    if (existing?.status === "pending") {
      return res.status(409).json({ message: "This staking claim is already being processed" });
    }

    await client.waitForTransaction({ digest, timeout: 30_000 });
    const result = await client.getTransaction({
      digest,
      include: { effects: true, events: true, transaction: true },
    });

    const tx = getTransactionEnvelope(result);
    if (!tx || tx.status?.success === false || result?.FailedTransaction) {
      return res.status(400).json({ message: "The staking transaction was not successful" });
    }

    const sender = getTransactionSender(tx);
    if (sender && normalize(sender) !== normalize(wallet)) {
      return res.status(403).json({ message: "Staking claim sender does not match wallet" });
    }

    const rewardEvent = findRewardEvent(tx, wallet);
    if (!rewardEvent || rewardEvent.amountNanos <= 0n) {
      return res.status(400).json({ message: "No eligible staking reward event found in this transaction" });
    }

    const profile = await getProfile(wallet);
    const boostPercent = Number(profile?.activeStakingBoost || 0);
    if (boostPercent <= 0) {
      return res.json({
        boostPercent: 0,
        baseRewardFlow: Number(rewardEvent.amountNanos) / 1e9,
        bonusFlow: 0,
        message: "No active Staking Reward Boost",
      });
    }

    const bonusNanos = (rewardEvent.amountNanos * BigInt(boostPercent)) / 100n;

    const row = {
      claim_digest: digest,
      wallet,
      pool_id: rewardEvent.poolId || null,
      base_reward_nanos: rewardEvent.amountNanos.toString(),
      boost_percent: boostPercent,
      bonus_reward_nanos: bonusNanos.toString(),
      status: "pending",
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("staking_boost_claims")
      .insert(row);

    if (insertError) {
      if (insertError.code === "23505") {
        const concurrent = await loadClaim(digest);
        if (concurrent?.status === "success") {
          return res.json({
            alreadyProcessed: true,
            boostPercent: Number(concurrent.boost_percent || 0),
            bonusFlow: Number(concurrent.bonus_reward_nanos || 0) / 1e9,
            bonusTx: concurrent.bonus_tx_hash || null,
          });
        }
        return res.status(409).json({ message: "This staking claim is already being processed" });
      }
      throw insertError;
    }

    try {
      const bonusTx = await payBonus(wallet, bonusNanos);
      const { error: updateError } = await supabase
        .from("staking_boost_claims")
        .update({
          status: "success",
          bonus_tx_hash: bonusTx,
          updated_at: new Date().toISOString(),
        })
        .eq("claim_digest", digest);
      if (updateError) throw updateError;

      return res.json({
        boostPercent,
        baseRewardFlow: Number(rewardEvent.amountNanos) / 1e9,
        bonusFlow: Number(bonusNanos) / 1e9,
        finalRewardFlow: Number(rewardEvent.amountNanos + bonusNanos) / 1e9,
        bonusTx,
      });
    } catch (paymentError) {
      await supabase
        .from("staking_boost_claims")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("claim_digest", digest);
      throw paymentError;
    }
  } catch (error) {
    console.error("[staking-boost] claim failed:", error);
    return res.status(500).json({ message: error?.message || "Unable to process staking boost" });
  }
}
