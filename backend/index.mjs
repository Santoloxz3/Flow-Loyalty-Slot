import express from "express";
import cors from "cors";
import { withdraw, checkBackendBalance } from "./withdraw.mjs";
import { getFreeSpin, useFreeSpin } from "./freespin.mjs";
import { getHighBalanceSpin, useHighBalanceSpin } from "./highbalancespin.mjs";
import { getStakingFreeSpin, useStakingFreeSpin } from "./stakingfreespin.mjs";
import balanceRoutes from "./balance.mjs";
const app = express();

app.use(cors());
app.use(express.json());
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

app.listen(3000, () => {
  console.log("🚀 Backend in ascolto su http://localhost:3000");
});
