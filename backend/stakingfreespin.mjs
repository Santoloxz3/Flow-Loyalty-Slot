import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createSuiTestnetClient } from "./suiClient.mjs";

const client = createSuiTestnetClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STAKING_PACKAGE_ID =
  process.env.FLOW_STAKING_PACKAGE_ID ||
  process.env.VITE_FLOW_STAKING_PACKAGE_ID ||
  "0x642708e9efb9052026555608c1d6f8f6b33a9f7b106497ad93121f975f797548";
const STAKING_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getNextUtcDayIso(date = new Date()) {
  return new Date(startOfUtcDay(date) + STAKING_SPIN_COOLDOWN_MS).toISOString();
}

function isSpinAvailable(lastUsedAt, plan) {
  if (!lastUsedAt) return true;

  const lastUsedMs = new Date(lastUsedAt).getTime();
  if (!Number.isFinite(lastUsedMs)) return false;

  if (plan.resetMode === "daily") {
    return lastUsedMs < startOfUtcDay();
  }

  return lastUsedMs + STAKING_SPIN_COOLDOWN_MS <= Date.now();
}

const STAKING_SPIN_PLANS = [
  {
    name: "Whale",
    durationDays: 90,
    resetMode: "daily",
    poolId:
      process.env.FLOW_STAKING_POOL_WHALE_ID ||
      process.env.VITE_FLOW_STAKING_POOL_WHALE_ID ||
      "0xd2a17cf5c2554e8d16d19c6a0f3720fbc13663aefedcb528422c1b9dc675d40d",
  },
  {
    name: "Loyal",
    durationDays: 30,
    resetMode: "cooldown_24h",
    poolId:
      process.env.FLOW_STAKING_POOL_LOYAL_ID ||
      process.env.VITE_FLOW_STAKING_POOL_LOYAL_ID ||
      "0x0aac4a32e17c57b45b83f1aa4c4ea8014e3601d63258c4e40ec7257e7c8a20f4",
  },
];

const normalizeObjectId = (value) => String(value || "").toLowerCase();

async function getEligibleStakingPlans(wallet) {
  if (!STAKING_PACKAGE_ID) return [];

  const response = await client.listOwnedObjects({
    owner: wallet,
    type: `${STAKING_PACKAGE_ID}::flow_staking::StakePosition`,
    include: { json: true },
    limit: 50,
  });

  const positions = (response.objects || [])
    .map((item) => ({
      objectId: item.objectId,
      poolId: item.json?.pool_id,
      amount: BigInt(item.json?.amount || "0"),
    }))
    .filter((position) => position.objectId && position.poolId && position.amount > 0n);

  return STAKING_SPIN_PLANS.flatMap((plan) => {
    const position = positions.find((item) => normalizeObjectId(item.poolId) === normalizeObjectId(plan.poolId));
    return position ? [{ ...plan, positionId: position.objectId }] : [];
  });
}

async function getSpinStatus(wallet, eligiblePlans) {
  if (eligiblePlans.length === 0) return [];

  const planNames = eligiblePlans.map((plan) => plan.name);
  const { data: usageRows, error } = await supabase
    .from("staking_free_spin")
    .select("plan,last_used_at")
    .eq("wallet", wallet)
    .in("plan", planNames);

  if (error) throw error;

  const now = Date.now();
  const usageMap = Object.fromEntries((usageRows || []).map((row) => [row.plan, row.last_used_at]));

  return eligiblePlans.map((plan) => {
    const lastUsedAt = usageMap[plan.name] || null;
    const lastUsedMs = lastUsedAt ? new Date(lastUsedAt).getTime() : 0;
    const nextAvailableAt =
      plan.resetMode === "daily"
        ? getNextUtcDayIso(new Date(lastUsedMs || now))
        : new Date(lastUsedMs + STAKING_SPIN_COOLDOWN_MS).toISOString();
    const available = isSpinAvailable(lastUsedAt, plan);

    return {
      plan: plan.name,
      durationDays: plan.durationDays,
      resetMode: plan.resetMode,
      positionId: plan.positionId,
      available,
      nextAvailableAt: available ? null : nextAvailableAt,
    };
  });
}

async function consumeSpin(wallet, plan) {
  const nowIso = new Date().toISOString();
  const cutoffIso =
    plan.resetMode === "daily"
      ? new Date(startOfUtcDay()).toISOString()
      : new Date(Date.now() - STAKING_SPIN_COOLDOWN_MS).toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("staking_free_spin")
    .select("plan,last_used_at")
    .eq("wallet", wallet)
    .eq("plan", plan.plan)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { error: insertError } = await supabase.from("staking_free_spin").insert({
      wallet,
      plan: plan.plan,
      position_id: plan.positionId,
      last_used_at: nowIso,
      updated_at: nowIso,
    });

    if (insertError) {
      if (insertError.code === "23505") return false;
      throw insertError;
    }
    return true;
  }

  if (!isSpinAvailable(existing.last_used_at, plan)) {
    return false;
  }

  let updateQuery = supabase
    .from("staking_free_spin")
    .update({
      position_id: plan.positionId,
      last_used_at: nowIso,
      updated_at: nowIso,
    })
    .eq("wallet", wallet)
    .eq("plan", plan.plan);

  updateQuery =
    plan.resetMode === "daily"
      ? updateQuery.lt("last_used_at", cutoffIso)
      : updateQuery.lte("last_used_at", cutoffIso);

  const { data: updated, error: updateError } = await updateQuery.select("plan").maybeSingle();

  if (updateError) throw updateError;
  return Boolean(updated);
}

async function stakingFreeSpinHandler(req, res) {
  const wallet = req.method === "GET" ? req.query.wallet : req.body.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet richiesto" });

  try {
    const eligiblePlans = await getEligibleStakingPlans(wallet);
    const spinStatus = await getSpinStatus(wallet, eligiblePlans);
    const availablePlans = spinStatus.filter((plan) => plan.available);

    if (req.method === "GET") {
      return res.json({
        spinsLeft: availablePlans.length,
        eligiblePlans: spinStatus,
      });
    }

    const targetPlan = availablePlans[0];
    if (!targetPlan) {
      return res.status(403).json({
        message: eligiblePlans.length ? "Staking spin already used" : "No eligible Loyal or Whale staking position",
        spinsLeft: 0,
        eligiblePlans: spinStatus,
      });
    }

    const consumed = await consumeSpin(wallet, targetPlan);
    if (!consumed) {
      const refreshedStatus = await getSpinStatus(wallet, eligiblePlans);
      return res.status(403).json({
        message: "Staking spin already used",
        spinsLeft: refreshedStatus.filter((plan) => plan.available).length,
        eligiblePlans: refreshedStatus,
      });
    }

    const refreshedStatus = await getSpinStatus(wallet, eligiblePlans);
    return res.json({
      message: "Staking spin registrato",
      usedPlan: targetPlan.plan,
      spinsLeft: refreshedStatus.filter((plan) => plan.available).length,
      eligiblePlans: refreshedStatus,
    });
  } catch (err) {
    console.error("Errore staking free spin:", err);
    return res.status(500).json({ message: "Errore server" });
  }
}

export async function getStakingFreeSpin(req, res) {
  req.method = "GET";
  return stakingFreeSpinHandler(req, res);
}

export async function useStakingFreeSpin(req, res) {
  req.method = "POST";
  return stakingFreeSpinHandler(req, res);
}
