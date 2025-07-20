import React, { useEffect, useState } from "react";
import { WalletProvider, useWallet, ConnectButton } from "@suiet/wallet-kit";
import "@suiet/wallet-kit/style.css";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";

const SUI_NODE_URL = getFullnodeUrl("testnet");
const client = new SuiClient({ url: SUI_NODE_URL });

const MBLUB_COIN_TYPE = "0xd354912d329057e23693d5e8871926cdaa70fa00dfb26a50271868158bfc8f24::mutantblub::MUTANTBLUB";
const SLOT_WALLET_ADDRESS = "0xcdd3d0e5856712698a65fb2d375c3bdd5c80ca1c7c9d3dc219904269f1624f01";

function GameContainer() {
  const { connected, account, signAndExecuteTransactionBlock, signMessage } = useWallet();
  const [mblubBalance, setMblubBalance] = useState(null);
  const [depositMultiplier, setDepositMultiplier] = useState(1);
  const [slotBalance, setSlotBalance] = useState(0);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flashWin, setFlashWin] = useState(false);
  const [glowWin, setGlowWin] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [spinLog, setSpinLog] = useState([]);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0); // ✅ NUOVO STATO
  const [highBalanceCanSpin, setHighBalanceCanSpin] = useState(false);

  const postBalanceToGame = (balance) => {
    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "UPDATE_BALANCE", balance }, "*");
  };

  const fetchFreeSpins = async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`http://localhost:3000/free-spin?wallet=${account.address}`);
      const data = await res.json();
      setFreeSpinsLeft(data.spinsLeft ?? 0);
    } catch (err) {
      console.error("Errore nel recupero spin gratuiti:", err);
    }
  };

  const fetchHighBalanceSpin = async () => {
    if (!account?.address) return;
    try {
  	  const res = await fetch(`http://localhost:3000/high-balance-spin?wallet=${account.address}`);
	  const data = await res.json();
	  setHighBalanceCanSpin(data.canSpin ?? false);
    } catch (err) {
	  console.error("Errore nel recupero dello spin high balance:", err);
    }
  };



  const loadSlotBalance = async (wallet) => {
    try {
	  const res = await fetch(`http://localhost:3000/balance?wallet=${wallet}`);
	  const data = await res.json();
	  const balance = data.balance ?? 0;
	  setSlotBalance(balance);
	  setTimeout(() => postBalanceToGame(balance), 2000);
    } catch (err) {
	  console.error("Errore nel caricamento saldo:", err);
    }
  };


  const updateSlotBalance = async (wallet, amountToAdd) => {
    try {
      const res = await fetch("http://localhost:3000/balance/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amountToAdd }),
      });
      const data = await res.json();
      setSlotBalance(data.balance);
      postBalanceToGame(data.balance);
    } catch (err) {
      console.error("Errore aggiornamento saldo:", err);
    }
  };


  const fetchBalances = async () => {
    try {
      const balances = await client.getAllBalances({ owner: account.address });
      const mblub = balances.find((b) => b.coinType === MBLUB_COIN_TYPE);
      setMblubBalance(mblub ? parseFloat(mblub.totalBalance) / 1e9 : 0);
      await loadSlotBalance(account.address);
    } catch (e) {
      toast.error("Errore nel recupero saldi");
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !account?.address) return toast.error("Connettiti al wallet.");
    setLoading(true);
    try {
      const nonce = Date.now().toString();
      const timestamp = Date.now();
      const message = `Authorize withdrawal for wallet: ${account.address}, nonce: ${nonce}, timestamp: ${timestamp}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await signMessage({ message: encodedMessage });
      const publicKeyHex = [...account.publicKey].map((b) => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("http://localhost:3000/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address, message, signature: signed.signature, publicKey: publicKeyHex }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(`Prelievo completato: ${result.amount} MBLUB`);
        await loadSlotBalance(account.address);
        await fetchBalances();
      } else {
        toast.error(result.message || "Errore durante il prelievo");
      }
    } catch (e) {
      toast.error("Errore imprevisto durante il prelievo");
    }
    setLoading(false);
  };

  const handleUseHighBalanceSpin = () => {
    const iframe = document.querySelector("iframe");
    if (!iframe || !iframe.contentWindow) {
	  toast.error("Slot non attiva.");
	  return;
    }

    console.log("🎰 High Balance Spin - invio FREE_SPIN_AVAILABLE all’iframe");
    iframe.contentWindow.postMessage({ type: "FREE_SPIN_AVAILABLE" }, "*");
  };

  const checkBackendBalanceOk = async () => {
    try {
	  const res = await fetch("http://localhost:3000/check-backend-balance");
	  const data = await res.json();
	  const backendBalance = BigInt(data.balance || "0");
	  const MIN_REQUIRED = 10_000_000_000n;
	  return backendBalance >= MIN_REQUIRED;
    } catch (err) {
	  console.error("❌ Errore fetch backend balance:", err);
	  return false;
    }
  };


  const handleDeposit = async () => {
    if (!connected || !account?.address) return toast.error("Connettiti al wallet.");
    const amount = depositMultiplier * 10000;
    const amountBigInt = BigInt(amount * 1e9);
    setLoading(true);
    try {
      const coins = await client.getCoins({ owner: account.address, coinType: MBLUB_COIN_TYPE });
      if (!coins.data.length) return toast.error("Saldo insufficiente.");
      const coinObjectId = coins.data[0].coinObjectId;

      const tx = new TransactionBlock();
      const coin = tx.object(coinObjectId);
      const [splitCoin] = tx.splitCoins(coin, [tx.pure(amountBigInt)]);
      tx.transferObjects([splitCoin], tx.pure(SLOT_WALLET_ADDRESS));

      await signAndExecuteTransactionBlock({ transactionBlock: tx });
      await updateSlotBalance(account.address, amount);
      await fetchBalances();
      toast.success(`Deposito effettuato: ${amount} MBLUB`);
    } catch (e) {
      toast.error("Errore durante il deposito");
    }
    setLoading(false);
  };

  const [showInfoModal, setShowInfoModal] = useState(false);

  const simboliVincita = [
    { src: "/images/Glass.png", payout: " 5000 $FLOW" },
    { src: "/images/Moon.png", payout: " 10000 $FLOW" },
    { src: "/images/Bag.png", payout: " 20000 $FLOW" },
    { src: "/images/Flow1.png", payout: " 30000 $FLOW" },
    { src: "/images/jolly1.png", payout: "👑 100000 $FLOW" },	
  ];



  useEffect(() => {
    const checkWallet = async () => {
      if (!connected || !account?.address) return setIsWalletReady(false);
      try {
        const msg = new TextEncoder().encode("wallet-check");
        const signature = await signMessage({ message: msg });
        setIsWalletReady(!!signature);
      } catch (err) {
        setIsWalletReady(false);
      }
    };
    checkWallet();
  }, [connected, account]);

  useEffect(() => {
    if (!connected || !account?.address) return;
    fetchBalances();
    fetchFreeSpins();
	fetchHighBalanceSpin();


    const handleMessage = async (event) => {
      const data = event.data;
      if (!data || !data.type) return;
	  
      console.log("📩 Messaggio ricevuto da iframe:", data);
	  
	  if (data.type === "SPIN_REQUEST") {
	    try {
		  const backendRes = await fetch("http://localhost:3000/check-backend-balance");
		  const backendData = await backendRes.json();

		  const backendBalance = BigInt(backendData.balance || "0");
		  const MIN_REQUIRED = 10_000_000_000n;

		  if (backendBalance < MIN_REQUIRED) {
		    toast.warning("Il wallet premi è attualmente senza fondi. Le vincite potrebbero non essere pagate.");
		    // Ma lasciamo proseguire lo spin normalmente
		  }
	    } catch (err) {
		  console.error("❌ Errore durante verifica saldo backend:", err);
		  toast.error("Errore nel controllo fondi premi.");
	    }

	    const SPIN_COST = 10000;
	    if (slotBalance < SPIN_COST) {
		  event.source?.postMessage({ type: "SPIN_DENIED", reason: "Saldo insufficiente" }, "*");
		  return;
	    }

	    try {
		  const newBalance = slotBalance - SPIN_COST;
		  await fetch("http://localhost:3000/balance/set", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address, newBalance }),
		  });
		  
		  setSlotBalance(newBalance);
		  postBalanceToGame(newBalance);
		  event.source?.postMessage({ type: "SPIN_GRANTED", newBalance }, "*");
		  		 
	    } catch (err) {
		  console.error("Errore imprevisto durante spin:", err);
		  event.source?.postMessage({ type: "SPIN_DENIED", reason: "Errore imprevisto" }, "*");
	    }

	    return;
	  }



	  if (data.type === "SPIN_WIN") {
	    const amount = Number(data.amount || 0);
	    if (amount > 0) {
	      const winAudio = new Audio("/win-sound.wav");
		  winAudio.play();

	  	  setFlashWin(true);
		  setGlowWin(true);

		  setTimeout(() => {
		    setFlashWin(false);
		  }, 1000);

		  setTimeout(() => {
		    setGlowWin(false);
		  }, 2000);

		  setSpinLog((prev) => [...prev, `✅ Win: +${amount} MBLUB`]);
		  await updateSlotBalance(account.address, amount);
	    } else {
		  setSpinLog((prev) => [...prev, `❌ No Win`]);
	    }
	  }


      if (data.type === "REQUEST_BALANCE") {
        postBalanceToGame(slotBalance);
      }
	  
      console.log("✅ React ha ricevuto FREE_SPIN_USED, sto aggiornando Supabase");

	  if (data.type === "FREE_SPIN_USED_NFT") {
	    try {
		  const res = await fetch("http://localhost:3000/free-spin", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address }),
		  });

		  const result = await res.json();
		  if (res.ok) {
		    setFreeSpinsLeft(result.spinsLeft ?? 0);
		  } else {
		    toast.error(result.message || "Errore nell'uso dello spin NFT");
		  }
	    } catch (err) {
		  console.error("Errore registrazione spin NFT:", err);
	    }
	  }

	  if (data.type === "FREE_SPIN_USED_BAL") {
	    try {
		  const res = await fetch("http://localhost:3000/high-balance-spin", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address }),
		  });

		  const result = await res.json();
		  if (res.ok) {
		    setHighBalanceCanSpin(false);
		  } else {
		    toast.error(result.message || "Errore nell'uso dello spin token");
		  }
	    } catch (err) {
		  console.error("Errore registrazione spin token:", err);
	    }
	  }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [connected, account, slotBalance]);

  return (
    <div className="app-container">
      <div className="left-panel">
        <ConnectButton />
        {isWalletReady ? (
          <>
            <div className={`wallet-box ${flashWin ? "flash-win" : ""}`}>
              <p><strong>Wallet:</strong><br />{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
              <p><strong>$FLOW WALLET:</strong> {mblubBalance ?? "..."}</p>
              <p><strong>$FLOW SLOT:</strong> {slotBalance}</p>
              {freeSpinsLeft > 0 && (
				<button
				  className="btn btn-free-spin glow-effect"
				  onClick={async () => {
					console.log("🟢 Click su Usa Spin Gratuito");
					const ok = await checkBackendBalanceOk();
					if (!ok) {
					  toast.error("Wallet premi vuoto. Attendi ricarica.");
					  return;
					}
					document.querySelector("iframe")?.contentWindow?.postMessage({ type: "FREE_SPIN_AVAILABLE_NFT" }, "*");
				  }}
				>
				  🎁 NFT Spin Available ({freeSpinsLeft})
				</button>
              )}
			  
            </div>
            <div className="controls">
              <button onClick={() => setDepositMultiplier((p) => Math.max(1, p - 1))} className="btn">➖</button>
              <span className="amount-display">{depositMultiplier * 10000} $FLOW</span>
              <button onClick={() => setDepositMultiplier((p) => p + 1)} className="btn">➕</button>
            </div>
			
            <button onClick={handleDeposit} className="btn btn-deposit" disabled={loading}>💸 Top Up </button>
            <button onClick={handleWithdraw} className="btn btn-withdraw" disabled={loading}>💰 Withdraw</button>
			<div style={{ display: "flex", gap: "2rem", width: "100%", justifyContent: "center" }}>
			  <button className="btn btn-log" onClick={() => setShowLogModal(true)}>
				📜 View Logs
			  </button>			  
			  {highBalanceCanSpin && (
			    <div className="tooltip-container">
				  <button
				    className="btn btn-free-spin btn-highspin glow-effect"
				    onClick={async () => {
					  const ok = await checkBackendBalanceOk();
					  if (!ok) {
					    toast.error("Wallet premi vuoto. Attendi ricarica.");
					    return;
					  }
					  console.log("🎰 Inviato FREE_SPIN_AVAILABLE_BAL");
					  document.querySelector("iframe")?.contentWindow?.postMessage({ type: "FREE_SPIN_AVAILABLE_BAL" }, "*");
				    }}
				  >
				    🐳
				  </button>
				  <span className="tooltip-text">Whale FREE spin</span>
			    </div>
			  )}

			</div>
          </>
        ) : (
          <div className="wallet-warning">❌ Wallet non autorizzato</div>
        )}
      </div>
	  <div className="floating-info">
	    <button className="btn btn-info" onClick={() => setShowInfoModal(true)} title="">
		  ℹ️
	    </button>
	  </div>

      <div className="center-panel">
        <h1 className="app-title neon-text">$Flow Loyalty Slot</h1>
        <div className="slot-frame-wrapper">
          <div className={`animated-border-glow ${glowWin ? "glow-win" : ""}`}></div>
          <iframe title="Slot Game" src="index.html" className="game-frame" />
        </div>
      </div>

      <ToastContainer position="bottom-right" theme="dark" />
	  {showInfoModal && (
	    <div className="log-modal-backdrop" onClick={() => setShowInfoModal(false)}>
		  <div className="log-modal" onClick={(e) => e.stopPropagation()}>
		    <h2>🏆 Paytable </h2>
		    <ul className="symbol-list">
			  {simboliVincita.map((s, i) => (
			    <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
				  <img src={s.src} alt="symbol" style={{ width: '40px', marginRight: '1rem' }} />
				  <span>{s.payout}</span>
			    </li>
			  ))}
		    </ul>
		    <button className="btn btn-close" onClick={() => setShowInfoModal(false)}>✖ Chiudi</button>
		  </div>
	    </div>
	  )}
	  
      {showLogModal && (
        <div className="log-modal-backdrop" onClick={() => setShowLogModal(false)}>
          <div className="log-modal" onClick={(e) => e.stopPropagation()}>
            <h2>📋 Log Vincite</h2>
            <ul>
              {spinLog.length === 0 && <li>(Nessun log disponibile)</li>}
              {spinLog.map((entry, idx) => (
                <li key={idx}>{entry}</li>
              ))}
            </ul>
            <button className="btn btn-close" onClick={() => setShowLogModal(false)}>✖ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <GameContainer />
    </WalletProvider>
  );
}

