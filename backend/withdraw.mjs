import "dotenv/config";
import express from "express";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { createClient } from "@supabase/supabase-js";
import { Ed25519Keypair, Ed25519PublicKey } from "@mysten/sui.js/keypairs/ed25519";
import { verifyPersonalMessage } from "@mysten/sui.js/verify";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let keypair;
try {
  const keyBytes = Buffer.from(process.env.PRIVATE_KEY, "base64").subarray(0, 32);
  keypair = Ed25519Keypair.fromSecretKey(keyBytes);
  console.log("🔑 Wallet derivato dalla PRIVATE_KEY:", keypair.getPublicKey().toSuiAddress());
} catch (e) {
  console.error("❌ Errore caricamento chiave privata:", e);
}

async function isSignatureValid(signature, message, expectedWalletAddress) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const result = await verifyPersonalMessage(messageBytes, signature);

    const publicKey =
      result instanceof Ed25519PublicKey ? result :
      result?.publicKey instanceof Ed25519PublicKey ? result.publicKey :
      null;

    if (!publicKey) {
      console.error("❌ Nessuna chiave pubblica restituita:", result);
      return false;
    }

    const recoveredAddress = publicKey.toSuiAddress();
    if (recoveredAddress !== expectedWalletAddress) {
      console.error("❌ Firma valida ma da wallet diverso:", recoveredAddress);
      return false;
    }

    console.log("✅ Firma verificata per wallet:", recoveredAddress);
    return true;
  } catch (err) {
    console.error("❌ Errore durante la verifica della firma:", err);
    return false;
  }
}

export async function withdraw(req, res) {
  const { wallet, message, signature } = req.body;

  console.log("🛂 Dati ricevuti:", {
    wallet,
    message,
    signature: signature?.slice(0, 10) + "...",
  });

  if (!wallet || !message || !signature) {
    return res.status(400).json({ message: "Dati di autenticazione mancanti" });
  }

  // Estrai nonce e timestamp dal messaggio firmato
  const match = message.match(/^Authorize withdrawal for wallet: (0x[\da-fA-F]+), nonce: (\d+), timestamp: (\d+)$/);
  if (!match || match[1] !== wallet) {
    return res.status(400).json({ message: "Formato messaggio non valido o wallet non corrispondente" });
  }
  const nonce = match[2];
  const timestamp = parseInt(match[3]);

  // Controllo timestamp massimo (es. 5 min)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return res.status(400).json({ message: "Timestamp non valido o scaduto" });
  }

  // Controllo nonce non riutilizzato
  const { data: usedNonce } = await supabase
    .from("used_nonces")
    .select("nonce")
    .eq("wallet", wallet)
    .eq("nonce", nonce)
    .single();

  if (usedNonce) {
    return res.status(400).json({ message: "Nonce già utilizzato" });
  }

  const isValid = await isSignatureValid(signature, message, wallet);
  if (!isValid) {
    return res.status(401).json({ message: "Firma non valida o wallet non corrispondente" });
  }

  // Salva nonce usato
  await supabase.from("used_nonces").insert([{ wallet, nonce, timestamp: new Date().toISOString() }]);

  try {
    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet", wallet)
      .eq("status", "pending");

    if (txs.length > 0) {
      return res.status(429).json({ message: "Prelievo già in corso" });
    }

    const { data: balanceData, error } = await supabase
      .from("balances")
      .select("balance")
      .eq("wallet", wallet)
      .single();

    if (error || !balanceData || balanceData.balance <= 0) {
      return res.status(400).json({ message: "Saldo insufficiente o mancante" });
    }

    const balance = BigInt(balanceData.balance);
    const amount = balance * 1_000_000_000n;

    const coins = await client.getCoins({
      owner: keypair.getPublicKey().toSuiAddress(),
      coinType: process.env.FLOW_COIN_TYPE,
    });

	// ✅ Controllo saldo minimo richiesto nel wallet backend
	const totalAvailable = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
	const MIN_REQUIRED = 10_000_000_000n; // 10 FLOW = 10e9 nanos
	if (totalAvailable < MIN_REQUIRED) {
	  return res.status(500).json({ message: "Il wallet dei premi non ha fondi sufficienti per effettuare prelievi." });
	}


    if (!coins.data.length) {
      return res.status(500).json({ message: "FLOW non disponibili nel backend" });
    }

	let txId = null;

	try {
	  const { data: inserted } = await supabase.from("transactions").insert([
		{
		  wallet,
		  amount: Number(balance),
		  status: "pending",
		  timestamp: new Date().toISOString(),
		},
	  ]).select();

	  txId = inserted?.[0]?.id;

	  const txb = new TransactionBlock();
	  const [coin] = txb.splitCoins(
		txb.object(coins.data[0].coinObjectId),
		[txb.pure(amount)]
	  );
	  txb.transferObjects([coin], txb.pure(wallet));

	  const result = await client.signAndExecuteTransactionBlock({
		signer: keypair,
		transactionBlock: txb,
		options: { showEffects: true },
	  });

	  await supabase.from("balances").update({ balance: 0 }).eq("wallet", wallet);
	  await supabase.from("transactions").update({
		status: "success",
		tx_hash: result.digest,
	  }).eq("id", txId);

	  return res.json({
		success: true,
		amount: Number(balance),
		tx: result.digest,
	  });
	} catch (err) {
	  console.error("❌ Errore prelievo:", err);

	  if (txId) {
		await supabase.from("transactions").update({
		  status: "failed",
		  error: err.toString(), // puoi anche rimuovere questa riga se la colonna non esiste
		}).eq("id", txId);
	  }

	  return res.status(500).json({ message: "Errore durante il prelievo" });
	}


    const txb = new TransactionBlock();
    const [coin] = txb.splitCoins(
      txb.object(coins.data[0].coinObjectId),
      [txb.pure(amount)]
    );
    txb.transferObjects([coin], txb.pure(wallet));

    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txb,
      options: { showEffects: true },
    });

    await supabase.from("balances").update({ balance: 0 }).eq("wallet", wallet);
    await supabase.from("transactions").update({
      status: "success",
      tx_hash: result.digest,
    }).eq("id", txId);

    return res.json({
      success: true,
      amount: Number(balance),
      tx: result.digest,
    });
  } catch (err) {
    console.error("❌ Errore prelievo:", err);
    return res.status(500).json({ message: err.toString() });
  }
}
export async function checkBackendBalance(req, res) {
  try {
    const coins = await client.getCoins({
      owner: keypair.getPublicKey().toSuiAddress(),
      coinType: process.env.FLOW_COIN_TYPE,
    });

    const total = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
    return res.json({ balance: total.toString() }); // in nanos
  } catch (err) {
    console.error("❌ Errore controllo balance backend:", err);
    return res.status(500).json({ message: "Errore durante controllo saldo backend" });
  }
}
