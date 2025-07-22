import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// GET /balance?wallet=...
router.get("/", async (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet richiesto" });

  const { data, error } = await supabase
    .from("balances")
    .select("balance")
    .eq("wallet", wallet)
    .single();

  if (error && error.code !== "PGRST116") {
    return res.status(500).json({ message: "Errore Supabase", error });
  }

  return res.json({ balance: data?.balance ?? 0 });
});

// POST /balance/update
router.post("/update", async (req, res) => {
  const { wallet, amountToAdd } = req.body;
  if (!wallet || typeof amountToAdd !== "number") {
    return res.status(400).json({ message: "Dati mancanti" });
  }

  const { data: existing } = await supabase
    .from("balances")
    .select("balance")
    .eq("wallet", wallet)
    .single();

  const newBalance = existing ? existing.balance + amountToAdd : amountToAdd;

  if (existing) {
    await supabase.from("balances").update({ balance: newBalance }).eq("wallet", wallet);
  } else {
    await supabase.from("balances").insert({ wallet, balance: newBalance });
  }

  return res.json({ balance: newBalance });
});

// POST /balance/set
router.post("/set", async (req, res) => {
  const { wallet, newBalance } = req.body;
  if (!wallet || typeof newBalance !== "number") {
    return res.status(400).json({ message: "Dati mancanti" });
  }

  await supabase.from("balances").update({ balance: newBalance }).eq("wallet", wallet);
  return res.json({ balance: newBalance });
});

// POST /balance/spin
router.post("/spin", async (req, res) => {
  const { wallet, cost } = req.body;
  if (!wallet || typeof cost !== "number") {
    return res.status(400).json({ message: "Dati mancanti" });
  }

  const { data: existing, error } = await supabase
    .from("balances")
    .select("balance")
    .eq("wallet", wallet)
    .single();

  if (error || !existing) {
    return res.status(400).json({ message: "Saldo non trovato" });
  }

  if (existing.balance < cost) {
    return res.status(403).json({ message: "Saldo insufficiente" });
  }

  const newBalance = existing.balance - cost;

  const { error: updateError } = await supabase
    .from("balances")
    .update({ balance: newBalance })
    .eq("wallet", wallet);

  if (updateError) {
    return res.status(500).json({ message: "Errore aggiornamento saldo" });
  }

  return res.json({ newBalance });
});


export default router;
