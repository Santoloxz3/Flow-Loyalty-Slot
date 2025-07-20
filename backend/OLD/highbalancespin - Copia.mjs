import "dotenv/config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { createClient } from "@supabase/supabase-js";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MBLUB_COIN_TYPE = process.env.MBLUB_COIN_TYPE; // oppure hardcodato

export async function highBalanceSpinHandler(req, res) {
  const wallet = req.method === "GET" ? req.query.wallet : req.body.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet richiesto" });

  try {
    const balances = await client.getAllBalances({ owner: wallet });
    const mblub = balances.find((b) => b.coinType === MBLUB_COIN_TYPE);
    const balance = mblub ? BigInt(mblub.totalBalance) : 0n;

    const threshold = 50_000_000n * 1_000_000_000n; // 50M MBLUB

    if (balance < threshold) {
      return res.status(403).json({ message: "Saldo insufficiente per spin giornaliero" });
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await supabase
      .from("high_balance_spin")
      .select("used_spin")
      .eq("wallet", wallet)
      .eq("date", today)
      .single();

    if (req.method === "GET") {
      return res.json({ canSpin: !existing });
    }

    if (existing?.used_spin) {
      return res.status(403).json({ message: "Spin già usato oggi" });
    }

    const { error } = await supabase.from("high_balance_spin").upsert({
      wallet,
      date: today,
      used_spin: true,
    }, { onConflict: ['wallet', 'date'] });

    if (error) {
      console.error("Errore Supabase:", error);
      return res.status(500).json({ message: "Errore Supabase" });
    }

    return res.json({ message: "Spin registrato", canSpin: false });
  } catch (err) {
    console.error("Errore spin high balance:", err);
    return res.status(500).json({ message: "Errore server" });
  }
}

export async function getHighBalanceSpin(req, res) {
  req.method = "GET";
  return highBalanceSpinHandler(req, res);
}

export async function useHighBalanceSpin(req, res) {
  req.method = "POST";
  return highBalanceSpinHandler(req, res);
}
