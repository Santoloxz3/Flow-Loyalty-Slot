import express from "express";
import cors from "cors";
import { withdraw, checkBackendBalance } from "./withdraw.mjs";
import { getFreeSpin, useFreeSpin } from "./freeSpin.mjs";
import { getHighBalanceSpin, useHighBalanceSpin } from "./highbalancespin.mjs";
const app = express();

app.use(cors());
app.use(express.json());
app.get("/check-backend-balance", checkBackendBalance);
// Rotta prelievo MBLUB
app.post("/withdraw", withdraw);

// Nuove rotte Free Spin
app.get("/free-spin", getFreeSpin);
app.post("/free-spin", useFreeSpin);

// Nuove rotte HightBalance
app.get("/high-balance-spin", getHighBalanceSpin);
app.post("/high-balance-spin", useHighBalanceSpin);

app.listen(3000, () => {
  console.log("🚀 Backend in ascolto su http://localhost:3000");
});
