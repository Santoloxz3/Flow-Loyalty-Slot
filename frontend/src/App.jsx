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

const FLOW_COIN_TYPE = "0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW";
const SLOT_WALLET_ADDRESS = "0xcdd3d0e5856712698a65fb2d375c3bdd5c80ca1c7c9d3dc219904269f1624f01";

function GameContainer() {
  const { connected, account, signAndExecuteTransactionBlock, signMessage } = useWallet();
  const [FLOWBalance, setFLOWBalance] = useState(null);
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
      const res = await fetch(`https://flow-loyalty-backend.onrender.com/free-spin?wallet=${account.address}`);
      const data = await res.json();
      setFreeSpinsLeft(data.spinsLeft ?? 0);
    } catch (err) {
      console.error("Error retrieving free spins:", err);
    }
  };

  const fetchHighBalanceSpin = async () => {
    if (!account?.address) return;
    try {
  	  const res = await fetch(`https://flow-loyalty-backend.onrender.com/high-balance-spin?wallet=${account.address}`);
	  const data = await res.json();
	  setHighBalanceCanSpin(data.canSpin ?? false);
    } catch (err) {
	  console.error("Error retrieving high balance spin:", err);
    }
  };



  const loadSlotBalance = async (wallet) => {
    try {
	  const res = await fetch(`https://flow-loyalty-backend.onrender.com/balance?wallet=${wallet}`);
	  const data = await res.json();
	  const balance = data.balance ?? 0;
	  setSlotBalance(balance);
	  setTimeout(() => postBalanceToGame(balance), 2000);
    } catch (err) {
	  console.error("Error loading balance:", err);
    }
  };


  const updateSlotBalance = async (wallet, amountToAdd) => {
    try {
      const res = await fetch("https://flow-loyalty-backend.onrender.com/balance/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amountToAdd }),
      });
      const data = await res.json();
      setSlotBalance(data.balance);
      postBalanceToGame(data.balance);
    } catch (err) {
      console.error("Error updating balance:", err);
    }
  };


  const fetchBalances = async () => {
    try {
      const balances = await client.getAllBalances({ owner: account.address });
      const FLOW = balances.find((b) => b.coinType === FLOW_COIN_TYPE);
      setFLOWBalance(FLOW ? parseFloat(FLOW.totalBalance) / 1e9 : 0);
      await loadSlotBalance(account.address);
    } catch (e) {
      toast.error("Error fetching balances");
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    setLoading(true);
    try {
      const nonce = Date.now().toString();
      const timestamp = Date.now();
      const message = `Authorize withdrawal for wallet: ${account.address}, nonce: ${nonce}, timestamp: ${timestamp}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await signMessage({ message: encodedMessage });
      const publicKeyHex = [...account.publicKey].map((b) => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("https://flow-loyalty-backend.onrender.com/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address, message, signature: signed.signature, publicKey: publicKeyHex }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(`Withdrawal completed: ${result.amount} $FLOW`);
        await loadSlotBalance(account.address);
        await fetchBalances();
      } else {
        toast.error(result.message || "Error during withdrawal");
      }
    } catch (e) {
      toast.error("Unexpected error during withdrawal");
    }
    setLoading(false);
  };

  const handleUseHighBalanceSpin = () => {
    const iframe = document.querySelector("iframe");
    if (!iframe || !iframe.contentWindow) {
	  toast.error("Slot not active.");
	  return;
    }

    console.log("🎰 High Balance Spin - invio FREE_SPIN_AVAILABLE all’iframe");
    iframe.contentWindow.postMessage({ type: "FREE_SPIN_AVAILABLE" }, "*");
  };

  const checkBackendBalanceOk = async () => {
    try {
	  const res = await fetch("https://flow-loyalty-backend.onrender.com/check-backend-balance");
	  const data = await res.json();
	  const backendBalance = BigInt(data.balance || "0");
	  const MIN_REQUIRED = 50_000_000_000n; // 10 FLOW in nanos
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
      const coins = await client.getCoins({ owner: account.address, coinType: FLOW_COIN_TYPE });
      if (!coins.data.length) return toast.error("Insufficient balance.");
      const coinObjectId = coins.data[0].coinObjectId;

      const tx = new TransactionBlock();
      const coin = tx.object(coinObjectId);
      const [splitCoin] = tx.splitCoins(coin, [tx.pure(amountBigInt)]);
      tx.transferObjects([splitCoin], tx.pure(SLOT_WALLET_ADDRESS));

      await signAndExecuteTransactionBlock({ transactionBlock: tx });
      await updateSlotBalance(account.address, amount);
      await fetchBalances();
      toast.success(`Deposit completed: ${amount} $FLOW`);
    } catch (e) {
      toast.error("Error during deposit");
    }
    setLoading(false);
  };

  const [showInfoModal, setShowInfoModal] = useState(false);

  const simboliVincita = [
    { src: "/slot/images/Glass.png", payout: " 5000 $FLOW" },
    { src: "/slot/images/Moon.png", payout: " 10000 $FLOW" },
    { src: "/slot/images/Bag.png", payout: " 20000 $FLOW" },
    { src: "/slot/images/Flow1.png", payout: " 30000 $FLOW" },
    { src: "/slot/images/jolly1.png", payout: "👑 100000 $FLOW" },	
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
		  const backendRes = await fetch("https://flow-loyalty-backend.onrender.com/check-backend-balance");
		  const backendData = await backendRes.json();

		  const backendBalance = BigInt(backendData.balance || "0");
		  const MIN_REQUIRED = 50_000_000_000_000n;

		  if (backendBalance < MIN_REQUIRED) {
		    toast.warning("The reward wallet is currently out of funds. Will be refilled soon.");
		    // Ma lasciamo proseguire lo spin normalmente
		  }
	    } catch (err) {
		  console.error("❌ Errore durante verifica saldo backend:", err);
		  toast.error("Error checking reward funds.");
	    }

	    const SPIN_COST = 10000;
	    if (slotBalance < SPIN_COST) {
		  event.source?.postMessage({ type: "SPIN_DENIED", reason: "Insufficient balance" }, "*");
		  return;
	    }

	    try {
		  const newBalance = slotBalance - SPIN_COST;
		  await fetch("https://flow-loyalty-backend.onrender.com/balance/set", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address, newBalance }),
		  });
		  
		  setSlotBalance(newBalance);
		  postBalanceToGame(newBalance);
		  event.source?.postMessage({ type: "SPIN_GRANTED", newBalance }, "*");
		  		 
	    } catch (err) {
		  console.error("Unexpected error during spin:", err);
		  event.source?.postMessage({ type: "SPIN_DENIED", reason: "Errore imprevisto" }, "*");
	    }

	    return;
	  }



	  if (data.type === "SPIN_WIN") {
	    const amount = Number(data.amount || 0);
	    if (amount > 0) {
	      const winAudio = new Audio("/slot/win-sound.wav");
		  winAudio.play();

	  	  setFlashWin(true);
		  setGlowWin(true);

		  setTimeout(() => {
		    setFlashWin(false);
		  }, 1000);

		  setTimeout(() => {
		    setGlowWin(false);
		  }, 2000);

		  setSpinLog((prev) => [...prev, `✅ Win: +${amount} $FLOW`]);
		  await updateSlotBalance(account.address, amount);
	    } else {
		  setSpinLog((prev) => [...prev, `❌ No Win`]);
	    }
	  }


	  if (data.type === "REQUEST_BALANCE") {
	    const safeBalance = slotBalance ?? 0;
	    console.log("📤 Il gioco ha chiesto il saldo. Invio:", safeBalance);
	    postBalanceToGame(safeBalance);
	  }
	  
      console.log("✅ React ha ricevuto FREE_SPIN_USED, sto aggiornando Supabase");

	  if (data.type === "FREE_SPIN_USED_NFT") {
	    try {
		  const res = await fetch("https://flow-loyalty-backend.onrender.com/free-spin", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address }),
		  });

		  const result = await res.json();
		  if (res.ok) {
		    setFreeSpinsLeft(result.spinsLeft ?? 0);
		  } else {
		    toast.error(result.message || "Error using NFT spin");
		  }
	    } catch (err) {
		  console.error("Error recording NFT spin:", err);
	    }
	  }

	  if (data.type === "FREE_SPIN_USED_BAL") {
	    try {
		  const res = await fetch("https://flow-loyalty-backend.onrender.com/high-balance-spin", {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address }),
		  });

		  const result = await res.json();
		  if (res.ok) {
		    setHighBalanceCanSpin(false);
		  } else {
		    toast.error(result.message || "Error using token spin");
		  }
	    } catch (err) {
		  console.error("Error recording token spin:", err);
	    }
	  }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [connected, account, slotBalance]);

  useEffect(() => {
    if (slotBalance !== null) {
	  console.log("📤 React invia balance aggiornato al gioco:", slotBalance);
	  setTimeout(() => postBalanceToGame(slotBalance), 5000);
    }
  }, [slotBalance]);

  return (
    <div className="app-container">
      <div className="left-panel">
        <ConnectButton />
        {isWalletReady ? (
          <>
            <div className={`wallet-box ${flashWin ? "flash-win" : ""}`}>
              <p><strong>Wallet:</strong><br />{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
              <p><strong>$FLOW WALLET:</strong> {FLOWBalance ?? "..."}</p>
              <p><strong>$FLOW SLOT:</strong> {slotBalance}</p>
              {freeSpinsLeft > 0 && (
				<button
				  className="btn btn-free-spin glow-effect"
				  onClick={async () => {
					console.log("🟢 Click Free Spin");
					const ok = await checkBackendBalanceOk();
					if (!ok) {
					  toast.error("Reward wallet empty. Please wait for refill.");
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
					    toast.error("Reward wallet empty. Please wait for refill.");
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
          <div className="wallet-warning">❌ Unauthorized wallet</div>
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
		  <iframe
		    title="Slot Game"
		    src="/slot/index.html"
		    className="game-frame"
		    onLoad={() => {
		  	  console.log("📥 iframe caricato");
			  const checkBalanceReady = setInterval(() => {
			    if (slotBalance > 0) {
				  console.log("✅ Balance pronto, invio al gioco:", slotBalance);
				  postBalanceToGame(slotBalance);
				  clearInterval(checkBalanceReady);
			    } else {
				   console.log("⏳ In attesa che slotBalance sia > 0...");
			    }
			  }, 300); // controlla ogni 300ms
		    }}
		  />
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
		    <button className="btn btn-close" onClick={() => setShowInfoModal(false)}>✖ 	Close</button>
		  </div>
	    </div>
	  )}
	  
      {showLogModal && (
        <div className="log-modal-backdrop" onClick={() => setShowLogModal(false)}>
          <div className="log-modal" onClick={(e) => e.stopPropagation()}>
            <h2>📋 Win Log</h2>
            <ul>
              {spinLog.length === 0 && <li>(No log available)</li>}
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

