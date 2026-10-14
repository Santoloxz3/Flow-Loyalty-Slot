import express from "express";
import cors from "cors";
import { withdraw, checkBackendBalance } from "./withdraw.mjs";
import { getFreeSpin, useFreeSpin } from "./freespin.mjs";
import { getHighBalanceSpin, useHighBalanceSpin } from "./highbalancespin.mjs";
import { getStakingFreeSpin, useStakingFreeSpin } from "./stakingfreespin.mjs";
import { getLoyaltyStatus, startLoyaltySpin } from "./loyalty.mjs";
import { getStakingBoost, claimStakingBoost } from "./stakingboost.mjs";
import balanceRoutes from "./balance.mjs";
const app = express();

app.use(cors());
app.use(express.json());
// Recovery modules are retained, but no legacy economy route is active by default.
if (process.env.FLOW_RUNTIME_MODE === "legacy") {
app.use("/balance", balanceRoutes);
app.get("/check-backend-balance", checkBackendBalance);
// Rotta prelievo FLOW
app.post("/withdraw", withdraw);

// Nuove rotte Free Spin
app.get("/free-spin", getFreeSpin);
app.post("/free-spin", useFreeSpin);

// Nuove rotte HightBalance
app.get("/high-balance-spin", getHighBalanceSpin);
app.post("/high-balance-spin", useHighBalanceSpin);

// Free spin da staking Loyal / Whale
app.get("/staking-free-spin", getStakingFreeSpin);
app.post("/staking-free-spin", useStakingFreeSpin);
}

// NFT loyalty XP system (new economy)
app.get("/loyalty/status", getLoyaltyStatus);
app.post("/loyalty/spin", startLoyaltySpin);

// Staking reward boost based on Total XP
app.get("/staking-boost", getStakingBoost);
app.post("/staking-boost/claim", claimStakingBoost);

app.get("/health", (_req, res) => res.json({
  network: "testnet",
  runtime: process.env.FLOW_RUNTIME_MODE === "legacy" ? "legacy" : "loyalty-v2",
  maintenanceCycleDays: 30,
  maintenanceRequiredXp: 1000,
}));

app.listen(Number(process.env.PORT || 3000), () => {
  console.log("🚀 Backend in ascolto su http://localhost:3000");
});
