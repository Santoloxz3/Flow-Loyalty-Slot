import "dotenv/config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { createClient } from "@supabase/supabase-js";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function freeSpinHandler(req, res) {
  const wallet = req.method === "GET" ? req.query.wallet : req.body.wallet;
  if (!wallet) return res.status(400).json({ message: "Wallet richiesto" });

  try {
    const owned = await client.getOwnedObjects({
      owner: wallet,
      options: { showType: true, showContent: true },
    });

    const userObjectIds = owned.data.map((o) => o.data?.objectId).filter(Boolean);
    if (userObjectIds.length === 0) return res.json({ spinsLeft: 0 });

    const { data: whitelist } = await supabase
      .from("nft_spin_whitelist")
      .select("*")
      .in("object_id", userObjectIds);

    if (!whitelist || whitelist.length === 0) return res.json({ spinsLeft: 0 });

    const today = new Date().toISOString().split("T")[0];

    const { data: spinUsage } = await supabase
      .from("nft_free_spin")
      .select("*")
      .eq("wallet", wallet)
      .eq("date", today);

    const usageMap = Object.fromEntries((spinUsage || []).map(row => [row.object_id, row.used_spins]));

    const spinData = whitelist.map(nft => {
      const used = usageMap[nft.object_id] || 0;
      const remaining = Math.max(0, nft.spins_per_day - used);
      return { object_id: nft.object_id, remaining };
    });

    const totalRemainingSpins = spinData.reduce((sum, s) => sum + s.remaining, 0);

    if (req.method === "GET") {
      return res.json({ spinsLeft: totalRemainingSpins });
    }
    console.log("🧪 whitelist:", whitelist);
    console.log("🧪 usageMap:", usageMap);
    console.log("🧪 spinData:", spinData);
	// Step 1: ricarica lo stato aggiornato dal DB
	const { data: spinUsageNow } = await supabase
	  .from("nft_free_spin")
	  .select("*")
	  .eq("wallet", wallet)
	  .eq("date", today);

	const latestUsageMap = Object.fromEntries((spinUsageNow || []).map(row => [row.object_id, row.used_spins]));


	// Step 2: trova il primo NFT disponibile
	let targetNFT = null;

	for (const nft of whitelist) {
	  const used = latestUsageMap[nft.object_id] || 0;
	  if (used < nft.spins_per_day) {
		targetNFT = { ...nft, used };
		break;
	  }
	}

	if (!targetNFT) {
	  return res.status(403).json({ message: "Nessuno spin disponibile" });
	}

	// Step 3: aggiorna su Supabase (usiamo upsert atomico)
	const newUsedSpins = targetNFT.used + 1;
	const newSpinsLeft = targetNFT.spins_per_day - newUsedSpins;

	const { error: upsertError } = await supabase
	  .from("nft_free_spin")
	  .upsert({
		wallet,
		object_id: targetNFT.object_id,
		date: today,
		used_spins: newUsedSpins,
		spins_left: newSpinsLeft,
	  }, { onConflict: ['wallet', 'object_id', 'date'] });

	if (upsertError) {
	  console.error("❌ Errore durante l'upsert:", upsertError);
	  return res.status(500).json({ message: "Errore durante l'uso dello spin" });
	}

	console.log(`🎯 Spin usato su ${targetNFT.object_id}: ${newUsedSpins}/${targetNFT.spins_per_day}`);

	// Step 4: rileggi lo stato aggiornato dopo update
	const { data: spinUsageAfter } = await supabase
	  .from("nft_free_spin")
	  .select("*")
	  .eq("wallet", wallet)
	  .eq("date", today);

	const usageMapAfter = Object.fromEntries((spinUsageAfter || []).map(row => [row.object_id, row.used_spins]));

	const totalLeftAfter = whitelist.reduce((sum, nft) => {
	  const used = usageMapAfter[nft.object_id] || 0;
	  return sum + Math.max(0, nft.spins_per_day - used);
	}, 0);

	return res.json({ message: "Spin utilizzato", spinsLeft: totalLeftAfter });


  } catch (err) {
    console.error("❌ Errore gestione free spin:", err);
    return res.status(500).json({ message: "Errore server" });
  }
}

export async function getFreeSpin(req, res) {
  req.method = "GET";
  return freeSpinHandler(req, res);
}

export async function useFreeSpin(req, res) {
  req.method = "POST";
  return freeSpinHandler(req, res);
}
