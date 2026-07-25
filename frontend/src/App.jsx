import React, { useEffect, useState, useRef } from "react";
import { WalletProvider, useWallet, ConnectButton } from "@suiet/wallet-kit";
import "@suiet/wallet-kit/style.css";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";

const FLOW_COIN_TYPE = "0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW";
const SLOT_WALLET_ADDRESS = "0xcdd3d0e5856712698a65fb2d375c3bdd5c80ca1c7c9d3dc219904269f1624f01";
const BACKEND_URL = "https://flow-loyalty-backend.onrender.com";
const TESTNET_GRPC_URL = "https://fullnode.testnet.sui.io:443";
const client = new SuiGrpcClient({ network: "testnet", baseUrl: TESTNET_GRPC_URL });

async function fetchAllCoins({ owner, coinType }) {
  const allCoins = [];
  let cursor;

  for (let page = 0; page < 50; page += 1) {
    const response = await client.listCoins({ owner, coinType, cursor });
    const pageCoins = response.objects || response.data || [];

    allCoins.push(...pageCoins);

    const nextCursor = response.nextCursor ?? response.cursor?.next;
    const hasNextPage = response.hasNextPage ?? Boolean(nextCursor);

    if (!hasNextPage || !nextCursor) break;
    cursor = nextCursor;
  }

  return allCoins;
}


function GameContainer() {
  const { connected, account, signAndExecuteTransaction, signTransaction, signPersonalMessage } = useWallet();
  const [suiBalance, setSuiBalance] = useState(null);
  const [FLOWBalance, setFLOWBalance] = useState(null);
  const [balanceStatus, setBalanceStatus] = useState("idle");
  const [balanceError, setBalanceError] = useState("");
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
  const lastSpinGrantedRef = useRef(false);
  const backgroundMusicRef = useRef(null);
 
  const isNightlyMobile = () => {
    if (typeof navigator === "undefined") return false;
    return /Nightly/i.test(navigator.userAgent) && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  };

  const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));


  const postBalanceToGame = (balance) => {
    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "UPDATE_BALANCE", balance }, "*");
  };

  const fetchFreeSpins = async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`${BACKEND_URL}/free-spin?wallet=${account.address}`);
      const data = await res.json();
      setFreeSpinsLeft(data.spinsLeft ?? 0);
    } catch (err) {
      console.error("Error retrieving free spins:", err);
    }
  };

  const fetchHighBalanceSpin = async () => {
    if (!account?.address) return;
    try {
  	  const res = await fetch(`${BACKEND_URL}/high-balance-spin?wallet=${account.address}`);
	  const data = await res.json();
	  setHighBalanceCanSpin(data.canSpin ?? false);
    } catch (err) {
	  console.error("Error retrieving high balance spin:", err);
    }
  };



  const loadSlotBalance = async (wallet) => {
    try {
	  const res = await fetch(`${BACKEND_URL}/balance?wallet=${wallet}`);
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
      const res = await fetch(`${BACKEND_URL}/balance/update`, {
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
    if (!account?.address) {
      setSuiBalance(null);
      setFLOWBalance(null);
      setBalanceStatus("idle");
      setBalanceError("");
      return;
    }

    setBalanceStatus("loading");
    setBalanceError("");

    try {
      console.info("[wallet] Fetching balances from Sui testnet gRPC", {
        address: account.address,
      });

      const [suiBalanceResponse, flowBalanceResponse] = await Promise.all([
        client.getBalance({ owner: account.address }),
        client.getBalance({ owner: account.address, coinType: FLOW_COIN_TYPE }),
      ]);

      const nextSuiBalance = Number(suiBalanceResponse.balance?.balance || "0") / 1e9;
      const nextFlowBalance = Number(flowBalanceResponse.balance?.balance || "0") / 1e9;

      setSuiBalance(nextSuiBalance);
      setFLOWBalance(nextFlowBalance);
      await loadSlotBalance(account.address);
      setBalanceStatus("ready");
      console.info("[wallet] Balances loaded", {
        address: account.address,
        sui: nextSuiBalance,
        flow: nextFlowBalance,
      });
    } catch (error) {
      console.error("[wallet] Failed to fetch balances", {
        address: account.address,
        error,
      });
      setSuiBalance(null);
      setFLOWBalance(null);
      setBalanceStatus("error");
      setBalanceError("Unable to load SUI/FLOW balances from Sui testnet. Reconnect Nightly or retry in a moment.");
      toast.error("Unable to fetch SUI/FLOW balances");
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
      const signed = await signPersonalMessage({ message: encodedMessage });

      const res = await fetch(`${BACKEND_URL}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address, message, signature: signed.signature }),
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
	  const res = await fetch(`${BACKEND_URL}/check-backend-balance`);
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
    if (!connected || !account?.address) return toast.error("Connect to the wallet");
    const amount = depositMultiplier * 10000;
    const amountBigInt = BigInt(amount * 1e9);
    const minGasBudget = 50_000_000n;
    setLoading(true);
    try {
      let availableGas = null;
      try {
        const suiGasBalance = await client.getBalance({ owner: account.address });
        availableGas = BigInt(suiGasBalance.totalBalance || "0");
        console.info("[deposit] SUI gas balance", {
          address: account.address,
          balanceMist: availableGas.toString(),
          minGasBudget: minGasBudget.toString(),
        });
      } catch (gasError) {
        console.warn("[deposit] Unable to pre-check SUI gas balance, continuing with transaction build", gasError);
      }

      const flowBalanceResponse = await client.getBalance({
        owner: account.address,
        coinType: FLOW_COIN_TYPE,
      });
      const expectedTotalBalance = BigInt(flowBalanceResponse.balance?.balance || "0");

      const flowCoins = [...await fetchAllCoins({
        owner: account.address,
        coinType: FLOW_COIN_TYPE,
      })].sort(
        (a, b) => Number(BigInt(b.balance) - BigInt(a.balance)),
      );

      if (!flowCoins.length) {
        toast.error("No FLOW coins found in the wallet.");
        return;
      }

      const totalAvailable = flowCoins.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
      console.info("[deposit] FLOW coin objects loaded", {
        address: account.address,
        requestedAmount: amountBigInt.toString(),
        expectedTotalBalance: expectedTotalBalance.toString(),
        totalAvailable: totalAvailable.toString(),
        objects: flowCoins.map((coin) => ({
          objectId: coin.objectId,
          balance: coin.balance,
        })),
      });

      if (expectedTotalBalance > totalAvailable) {
        console.warn("[deposit] FLOW balance mismatch between getBalance and listCoins", {
          address: account.address,
          expectedTotalBalance: expectedTotalBalance.toString(),
          totalAvailable: totalAvailable.toString(),
          coinType: FLOW_COIN_TYPE,
        });
      }

      if (totalAvailable < amountBigInt) {
        toast.error(`Insufficient FLOW balance for ${amount} FLOW deposit.`);
        return;
      }

      const selectedCoins = [];
      let collectedBalance = 0n;
      for (const coin of flowCoins) {
        selectedCoins.push(coin);
        collectedBalance += BigInt(coin.balance);
        if (collectedBalance >= amountBigInt) break;
      }

      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(minGasBudget);
      const primaryCoin = tx.object(selectedCoins[0].objectId);

      if (selectedCoins.length > 1) {
        tx.mergeCoins(
          primaryCoin,
          selectedCoins.slice(1).map((coin) => tx.object(coin.objectId)),
        );
      }

      const [splitCoin] = tx.splitCoins(primaryCoin, [amountBigInt]);
      tx.transferObjects([splitCoin], SLOT_WALLET_ADDRESS);

      if (isNightlyMobile()) {
        console.info("[deposit] Nightly mobile detected, using sign + execute fallback");
        const preparedBytes = await tx.build({ client });
        const signedTx = await signTransaction({ transaction: Transaction.from(preparedBytes) });
        const execution = await client.executeTransaction({
          transaction: base64ToBytes(signedTx.bytes),
          signatures: [signedTx.signature],
          include: { effects: true },
        });

        if (execution.$kind === "FailedTransaction") {
          throw new Error(
            execution.FailedTransaction.status?.error?.message || "Transaction execution failed on Nightly mobile.",
          );
        }
      } else {
        await signAndExecuteTransaction({ transaction: tx });
      }

      await updateSlotBalance(account.address, amount);
      await fetchBalances();
      toast.success(`Deposit completed: ${amount} $FLOW`);
    } catch (e) {
      console.error("❌ Errore durante il deposito:", e);
      const message = e?.message || String(e || "");
      toast.error(
        /gas|sui|fee|budget|mist/i.test(message)
          ? "Not enough SUI in the wallet to pay the network fee."
          : message || "Deposit failed. Check SUI gas, FLOW balance, or Nightly mobile execution.",
      );
    } finally {
      setLoading(false);
    }
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
    const handleFirstClick = () => {
	  if (backgroundMusicRef.current) {
		backgroundMusicRef.current.volume = 0.2;  
	    backgroundMusicRef.current.play().catch((err) => {
		  console.warn("⚠️ Autoplay bloccato o fallito:", err);
	    });
	  }
	  document.removeEventListener("click", handleFirstClick);
    };

    document.addEventListener("click", handleFirstClick);

    return () => {
	  document.removeEventListener("click", handleFirstClick);
    };
  }, []);



  useEffect(() => {
    // Nightly mobile may reject or mis-handle an automatic personal-sign request
    // triggered immediately after connect. Treat an active connection as ready here
    // and request a signature only for explicit protected actions like withdraw.
    setIsWalletReady(Boolean(connected && account?.address));
  }, [connected, account]);

  useEffect(() => {
    if (!connected || !account?.address) {
      setIsWalletReady(false);
      setSuiBalance(null);
      setFLOWBalance(null);
      setBalanceStatus("idle");
      setBalanceError("");
      return;
    }
    fetchBalances();
    fetchFreeSpins();
	fetchHighBalanceSpin();


    const handleMessage = async (event) => {
      const data = event.data;
      if (!data || !data.type) return;
	  
      console.log("📩 Messaggio ricevuto da iframe:", data);
	  
	  if (data.type === "SPIN_REQUEST") {
	    try {
			  const latestRes = await fetch(`${BACKEND_URL}/balance?wallet=${account.address}`);
		  const latestData = await latestRes.json();
		  const latestBalance = latestData.balance ?? 0;
          const SPIN_COST = 10000;
		  if (latestBalance < SPIN_COST) {
		    toast.error("Invalid spin due to insufficient balance.");
		    await loadSlotBalance(account.address);
		    return;
		  }

			  const res = await fetch(`${BACKEND_URL}/balance/spin`, {
		    method: "POST",
		    headers: { "Content-Type": "application/json" },
		    body: JSON.stringify({ wallet: account.address, cost: SPIN_COST }),
		  });

		  let data;
		  try {
		    data = await res.json(); // parsing protetto
		  } catch (parseErr) {
		    console.error("❌ Errore parsing JSON:", parseErr);
		    toast.error("Invalid response from the server");
		    await loadSlotBalance(account.address);
		    return;
		  }

		  if (!res.ok) {
		    toast.error(`Spin denied: ${data.message || "Unknown error"}`);
		    await loadSlotBalance(account.address);
		    return;
		}

		  setSlotBalance(data.newBalance);
		  postBalanceToGame(data.newBalance);
		  console.log("✅ SPIN_GRANTED autorizzato");
		  event.source?.postMessage({ type: "SPIN_GRANTED", newBalance: data.newBalance }, "*");
		  lastSpinGrantedRef.current = true;

	    } catch (err) {
		  console.error("❌ ERRORE INTERNO DURANTE SPIN:", err?.message || err, err);
		  toast.error("Unexpected error during spin.");
		  await loadSlotBalance(account.address);
		  return;
	    }
	  }

	  if (data.type === "SPIN_WIN") {
	    if (!lastSpinGrantedRef.current) {
		  console.warn("⚠️ SPIN_WIN ricevuto senza autorizzazione. Ignorato.");
		  return;
	    }
	    lastSpinGrantedRef.current = false;	  
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
			  const res = await fetch(`${BACKEND_URL}/free-spin`, {
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
			  const res = await fetch(`${BACKEND_URL}/high-balance-spin`, {
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
	    <audio ref={backgroundMusicRef} src="/slot/flow-theme.mp3" loop />
        {isWalletReady ? (
          <>
            <div className={`wallet-box ${flashWin ? "flash-win" : ""}`}>
              <p><strong>Wallet:</strong><br />{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
              <p><span className="wallet-line-icon" aria-hidden="true">👛</span><strong> FLOW Wallet:</strong> {balanceStatus === "loading" ? "Fetching..." : (FLOWBalance ?? "--")}</p>
              <p><span className="wallet-line-icon" aria-hidden="true">🎰</span><strong> FLOW Slot:</strong> {slotBalance}</p>
              {balanceError ? <p className="wallet-warning">{balanceError}</p> : null}
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
                    lastSpinGrantedRef.current = true;; // ✅ AUTORIZZA PRIMA DEL MESSAGGIO					
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

					  // Verifica lato backend se può ancora spinare
					  try {
					    const res = await fetch(`${BACKEND_URL}/high-balance-spin?wallet=${account.address}`);
					    const data = await res.json();

					    if (!res.ok || !data.canSpin) {
						  toast.error("Spin already used today");
						  setHighBalanceCanSpin(false); // Nascondi il pulsante
						  return;
					    }

					    lastSpinGrantedRef.current = true; // ✅ AUTORIZZA PRIMA DEL MESSAGGIO
					    console.log("🎰 Inviato FREE_SPIN_AVAILABLE_BAL");					  
					    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "FREE_SPIN_AVAILABLE_BAL" }, "*");

					  } catch (err) {
					    console.error("Errore durante il check dello spin:", err);
					    toast.error("Errore durante la verifica dello spin");
					  }
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
		    title="Flow Loyalty Slot"
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
