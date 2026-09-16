import React, { useEffect, useState, useRef } from "react";
import {
  WalletProvider,
  SuiClientProvider,
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { ToastContainer, toast } from "react-toastify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";

const FLOW_COIN_TYPE = "0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW";
const SLOT_WALLET_ADDRESS = "0xcdd3d0e5856712698a65fb2d375c3bdd5c80ca1c7c9d3dc219904269f1624f01";
const BACKEND_URL = "https://flow-loyalty-backend.onrender.com";
const FLOW_ON_SUI_URL = "https://flowonsui.netlify.app";
const STAKE_PATH = "/stake";
const TESTNET_GRPC_URL = "https://fullnode.testnet.sui.io:443";
const FLOW_DECIMALS = 1_000_000_000n;
const SUI_CLOCK_OBJECT_ID = "0x6";
const FLOW_STAKING_PACKAGE_ID = import.meta.env.VITE_FLOW_STAKING_PACKAGE_ID || "";
const DEFAULT_FLOW_STAKING_POOL_ID = import.meta.env.VITE_FLOW_STAKING_POOL_ID || "";
const FLOW_STAKING_ADMIN_ADDRESS = "0xe8ec5bf9587b55547f0f58bcb3c7341e90dff8d1a10abbfe2b4728e52a7813e8";
const FLOW_STAKING_ADMIN_CAP_IDS = {
  Flexible: "0x5540cf578ef5f5c81017c7d7d4b6bde5aa82266085c69a35cc81d75f4cc14ee8",
  Loyal: "0x9b0ea9266bc882982dbdb148b87a9c2537f897ba8697d7f715da0b4a2d15619a",
  Whale: "0x6f153e6d615c519d1b3fcce02ee3f8098ba8587459ae651764eaea915fd77f55",
};
const DEFAULT_STAKING_REWARD_RATES = {
  Flexible: 1_000_000,
  Loyal: 2_000_000,
  Whale: 3_000_000,
};
const DEFAULT_STAKING_REWARD_FUNDING = {
  Flexible: 10_000,
  Loyal: 20_000,
  Whale: 30_000,
};
const EMPTY_POOL_APR_BENCHMARK = 100_000;
const U64_MAX_VALUE = 18_446_744_073_709_551_615n;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_YEAR = 31_536_000;
const client = new SuiGrpcClient({ network: "testnet", baseUrl: TESTNET_GRPC_URL });
const queryClient = new QueryClient();
const networkConfig = {
  testnet: { url: "https://fullnode.testnet.sui.io:443" },
};
const createStubSuiClient = () => ({});

const STAKING_PLANS = [
  { name: "Flexible", duration: "0 days", boost: "1.0x", min: 10000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_FLEXIBLE_ID || DEFAULT_FLOW_STAKING_POOL_ID },
  { name: "Loyal", duration: "30 days", boost: "1.4x", min: 25000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_LOYAL_ID || DEFAULT_FLOW_STAKING_POOL_ID },
  { name: "Whale", duration: "90 days", boost: "2.2x", min: 100000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_WHALE_ID || DEFAULT_FLOW_STAKING_POOL_ID },
];

const STAKING_RESEARCH = [
  "Local Move draft added: generic $FLOW pool, position object, lock duration and reward funding.",
  "Reference code had gaps around admin-cap and position-pool checks; the draft guards both.",
  "Keep this in preview until Move tests, testnet rehearsal and independent audit are complete.",
];

const PremiumShortcutIcon = ({ type }) => {
  if (type === "stake") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 10V8a5 5 0 0 1 10 0v2" />
        <rect x="5" y="10" width="14" height="10" rx="3" />
        <path d="M12 14v3" />
        <path d="M9 4.7 12 3l3 1.7" />
      </svg>
    );
  }

  if (type === "slot") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="4" width="14" height="16" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
        <path d="M18 9h2v5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3 4 8l8 13 8-13-8-5Z" />
      <path d="M4 8h16M8.5 8 12 21 15.5 8M8.5 8 12 3l3.5 5" />
    </svg>
  );
};

const PremiumShortcutLink = ({ href, label, type, external = false }) => (
  <a
    href={href}
    className={`premium-shortcut premium-shortcut-${type}`}
    title={label}
    aria-label={label}
    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
  >
    <PremiumShortcutIcon type={type} />
    <span className="sr-only">{label}</span>
  </a>
);

const WalletActionShortcuts = ({ currentPage }) => (
  <div className="wallet-action-shortcuts" aria-label="Quick links">
    <PremiumShortcutLink href={FLOW_ON_SUI_URL} label="Open FlowOnSui" type="flow" external />
    {currentPage === "stake" ? (
      <PremiumShortcutLink href="/" label="Open Flow Loyalty Slot" type="slot" />
    ) : (
      <PremiumShortcutLink href={STAKE_PATH} label="Open staking page" type="stake" />
    )}
  </div>
);

const parseU64Input = (value, label, { allowZero = false } = {}) => {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const parsed = BigInt(normalized);
  if (!allowZero && parsed === 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }
  if (parsed > U64_MAX_VALUE) {
    throw new Error(`${label} is too large.`);
  }

  return parsed;
};

const parseFlowAmountInput = (value, label) => {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,9})?$/.test(normalized)) {
    throw new Error(`${label} must be a FLOW amount with up to 9 decimals.`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = `${fraction}000000000`.slice(0, 9);
  const parsed = BigInt(whole) * FLOW_DECIMALS + BigInt(paddedFraction);
  if (parsed === 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
};

const formatFlowAmount = (value, maximumFractionDigits = 2) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits,
  });

const formatApr = (apr) => {
  if (apr === null || apr === undefined) return "--";
  if (!Number.isFinite(apr)) return "--";
  if (apr >= 1000) return `${apr.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`;
  if (apr >= 100) return `${apr.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return `${apr.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
};

const formatMultiplier = (value) => {
  if (!Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;
};

const formatCompactFlow = (value) => {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}k`;
  return String(value);
};

const getProjectedApr = (stats, stakeAmount) => {
  const amount = Number(stakeAmount || 0);
  if (!stats || !amount || amount <= 0) return null;
  const projectedTotalStaked = stats.totalStaked + amount;
  if (projectedTotalStaked <= 0) return null;
  return ((stats.rewardPerDay * 365) / projectedTotalStaked) * 100;
};

function GameContainer() {
  const account = useCurrentAccount();
  const walletState = useCurrentWallet();
  const { isConnected: connected, currentWallet } = walletState;
  const wallets = useWallets();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const { mutateAsync: disconnectWallet } = useDisconnectWallet();
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
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectingWalletName, setConnectingWalletName] = useState("");
  const [spinLog, setSpinLog] = useState([]);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0); // ✅ NUOVO STATO
  const [highBalanceCanSpin, setHighBalanceCanSpin] = useState(false);
  const lastSpinGrantedRef = useRef(false);
  const backgroundMusicRef = useRef(null);
  const balancePostTimersRef = useRef([]);
  const balanceRefreshTimersRef = useRef([]);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("flow-slot-muted") === "1";
  });
  const [selectedStakingPlan, setSelectedStakingPlan] = useState(STAKING_PLANS[0].name);
  const [stakingAmount, setStakingAmount] = useState(10000);
  const [stakingPosition, setStakingPosition] = useState(null);
  const [stakingLoading, setStakingLoading] = useState(false);
  const [stakingStatus, setStakingStatus] = useState("Connect wallet and configure pool IDs.");
  const [stakingPoolStats, setStakingPoolStats] = useState({});
  const [stakingPoolStatus, setStakingPoolStatus] = useState("Loading pool stats.");
  const [adminRewardRates, setAdminRewardRates] = useState(DEFAULT_STAKING_REWARD_RATES);
  const [adminRewardFunding, setAdminRewardFunding] = useState(DEFAULT_STAKING_REWARD_FUNDING);
  const [stakingAdminLoading, setStakingAdminLoading] = useState(false);
  const [stakingAdminStatus, setStakingAdminStatus] = useState("Connect admin wallet to manage rewards.");
  const activeStakingPlan = STAKING_PLANS.find((plan) => plan.name === selectedStakingPlan) ?? STAKING_PLANS[0];
  const isStakingAdminWallet = account?.address?.toLowerCase() === FLOW_STAKING_ADMIN_ADDRESS.toLowerCase();
  const activePoolStats = stakingPoolStats[activeStakingPlan.name];
  const projectedStakeApr = getProjectedApr(activePoolStats, stakingAmount);

  const clearTimers = (timersRef) => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  };

  const getWalletConnectionMessage = (walletName, error) => {
    const message = error?.message || "";
    if (/set up your wallet/i.test(message)) {
      return `${walletName}: open the wallet extension and finish setup before connecting.`;
    }
    if (/reject|denied|cancel/i.test(message)) {
      return `${walletName}: connection was cancelled in the wallet.`;
    }
    if (message) {
      return message;
    }
    return `${walletName}: open/unlock the wallet extension, finish setup, then retry.`;
  };

  const handleConnectWallet = async (wallet) => {
    setConnectingWalletName(wallet.name);
    try {
      await connectWallet({ wallet, silent: false });
      setShowWalletModal(false);
    } catch (error) {
      console.error("Error connecting wallet:", {
        wallet: wallet.name,
        message: error?.message,
        error,
      });
      toast.error(getWalletConnectionMessage(wallet.name, error));
    } finally {
      setConnectingWalletName("");
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsWalletReady(false);
      await disconnectWallet();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast.error("Wallet disconnect failed");
    }
  };

  const signMessageWithWallet = async (messageBytes) => {
    if (!currentWallet || !account) {
      throw new Error("No wallet connected.");
    }

    const signPersonalMessageFeature = currentWallet.features["sui:signPersonalMessage"];
    if (signPersonalMessageFeature) {
      return signPersonalMessageFeature.signPersonalMessage({
        message: messageBytes,
        account,
        chain: "sui:testnet",
      });
    }

    const signMessageFeature = currentWallet.features["sui:signMessage"];
    if (signMessageFeature) {
      const { messageBytes: bytes, signature } = await signMessageFeature.signMessage({
        message: messageBytes,
        account,
      });
      return { bytes, signature };
    }

    throw new Error("The connected wallet does not support personal message signing.");
  };

  const executeTransactionWithWallet = async (transaction) => {
    if (!currentWallet || !account) {
      throw new Error("No wallet connected.");
    }

    const walletTransaction = {
      async toJSON() {
        return transaction.toJSON({ client });
      },
      setSenderIfNotSet(address) {
        transaction.setSenderIfNotSet(address);
      },
    };

    const signAndExecuteFeature = currentWallet.features["sui:signAndExecuteTransaction"];
    if (signAndExecuteFeature) {
      return signAndExecuteFeature.signAndExecuteTransaction({
        transaction: walletTransaction,
        account,
        chain: "sui:testnet",
      });
    }

    const legacyFeature = currentWallet.features["sui:signAndExecuteTransactionBlock"];
    if (legacyFeature) {
      const transactionBlock = Transaction.from(await transaction.toJSON({ client }));
      return legacyFeature.signAndExecuteTransactionBlock({
        transactionBlock,
        account,
        chain: "sui:testnet",
        options: {
          showRawEffects: true,
          showRawInput: true,
        },
      });
    }

    throw new Error("The connected wallet does not support transaction execution.");
  };
 
  const postBalanceToGame = (balance) => {
    document.querySelector("iframe")?.contentWindow?.postMessage({ type: "UPDATE_BALANCE", balance }, "*");
  };

  const syncBalanceToGame = (balance) => {
    clearTimers(balancePostTimersRef);
    postBalanceToGame(balance);
    [400, 1500].forEach((delay) => {
      const timerId = window.setTimeout(() => postBalanceToGame(balance), delay);
      balancePostTimersRef.current.push(timerId);
    });
  };

  const scheduleBalanceRefresh = () => {
    clearTimers(balanceRefreshTimersRef);
    [1500, 5000, 12000].forEach((delay) => {
      const timerId = window.setTimeout(() => {
        fetchBalances({ silent: true });
      }, delay);
      balanceRefreshTimersRef.current.push(timerId);
    });
  };

  const scheduleStakingRefresh = () => {
    [1500, 5000, 12000].forEach((delay) => {
      window.setTimeout(() => {
        fetchStakingPoolStats();
        fetchStakingPosition();
      }, delay);
    });
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
	  syncBalanceToGame(balance);
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
      syncBalanceToGame(data.balance);
    } catch (err) {
      console.error("Error updating balance:", err);
    }
  };


  const fetchBalances = async ({ silent = false } = {}) => {
    const walletAddress = account?.address;
    if (!walletAddress) {
      setSuiBalance(null);
      setFLOWBalance(null);
      setBalanceStatus("idle");
      setBalanceError("");
      return;
    }

    if (!silent) {
      const hasKnownBalances = suiBalance !== null || FLOWBalance !== null;
      setBalanceStatus(hasKnownBalances ? "refreshing" : "loading");
    }
    setBalanceError("");

    try {
      console.info("[wallet] Fetching balances from Sui testnet gRPC", {
        address: walletAddress,
        silent,
      });

      const [suiBalanceResponse, flowBalanceResponse] = await Promise.all([
        client.getBalance({ owner: walletAddress }),
        client.getBalance({ owner: walletAddress, coinType: FLOW_COIN_TYPE }),
      ]);

      const nextSuiBalance = Number(suiBalanceResponse.balance?.balance || "0") / 1e9;
      const nextFlowBalance = Number(flowBalanceResponse.balance?.balance || "0") / 1e9;

      setSuiBalance(nextSuiBalance);
      setFLOWBalance(nextFlowBalance);
      await loadSlotBalance(walletAddress);
      setBalanceStatus("ready");
      console.info("[wallet] Balances loaded", {
        address: walletAddress,
        sui: nextSuiBalance,
        flow: nextFlowBalance,
      });
    } catch (error) {
      console.error("[wallet] Failed to fetch balances", {
        address: walletAddress,
        error,
      });
      if (!silent) {
        setSuiBalance(null);
        setFLOWBalance(null);
        setBalanceStatus("error");
        setBalanceError("Unable to load SUI/FLOW balances from Sui testnet. Reconnect Nightly or retry in a moment.");
        toast.error("Unable to fetch SUI/FLOW balances");
      }
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
      const signed = await signMessageWithWallet(encodedMessage);

      const res = await fetch(`${BACKEND_URL}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address, message, signature: signed.signature }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(`Withdrawal completed: ${result.amount} $FLOW`);
        await loadSlotBalance(account.address);
        await fetchBalances({ silent: true });
        scheduleBalanceRefresh();
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
      const coinBalance = BigInt(flowBalanceResponse.balance?.coinBalance || "0");
      const addressBalance = BigInt(flowBalanceResponse.balance?.addressBalance || "0");

      console.info("[deposit] FLOW coin objects loaded", {
        address: account.address,
        requestedAmount: amountBigInt.toString(),
        expectedTotalBalance: expectedTotalBalance.toString(),
        coinBalance: coinBalance.toString(),
        addressBalance: addressBalance.toString(),
      });

      if (expectedTotalBalance < amountBigInt) {
        toast.error(`Insufficient FLOW balance for ${amount} FLOW deposit.`);
        return;
      }

      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(minGasBudget);
      const depositCoin = tx.coin({
        balance: amountBigInt,
        type: FLOW_COIN_TYPE,
      });
      tx.transferObjects([depositCoin], SLOT_WALLET_ADDRESS);

      await executeTransactionWithWallet(tx);

      await updateSlotBalance(account.address, amount);
      await fetchBalances({ silent: true });
      scheduleBalanceRefresh();
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

  const isStakingConfigured = Boolean(FLOW_STAKING_PACKAGE_ID && activeStakingPlan.poolId);

  const getPlanAprLabel = (plan) => {
    const stats = stakingPoolStats[plan.name];
    if (!stats) return "Live APR";
    if (!stats.totalStaked) {
      const firstStakeApr = getProjectedApr(stats, Math.max(EMPTY_POOL_APR_BENCHMARK, plan.min));
      return firstStakeApr === null ? "Pool empty" : `~${formatApr(firstStakeApr)}`;
    }
    return formatApr(stats.estimatedApr);
  };

  const getPlanCardSubLabel = (plan) => {
    const stats = stakingPoolStats[plan.name];
    if (stats && !stats.totalStaked) {
      return `${plan.duration} / ${formatCompactFlow(Math.max(EMPTY_POOL_APR_BENCHMARK, plan.min))} est.`;
    }
    return plan.duration;
  };

  const getRewardWeightLabel = (planName) => {
    const flexibleRewardPerDay = stakingPoolStats.Flexible?.rewardPerDay;
    const planRewardPerDay = stakingPoolStats[planName]?.rewardPerDay;
    if (!flexibleRewardPerDay || !planRewardPerDay) {
      return STAKING_PLANS.find((plan) => plan.name === planName)?.boost || "--";
    }
    return formatMultiplier(planRewardPerDay / flexibleRewardPerDay);
  };

  const fetchStakingPoolStats = async () => {
    if (!FLOW_STAKING_PACKAGE_ID) {
      setStakingPoolStats({});
      setStakingPoolStatus("Staking package is not configured.");
      return;
    }

    try {
      const entries = await Promise.all(
        STAKING_PLANS.map(async (plan) => {
          if (!plan.poolId) return [plan.name, null];

          const response = await client.getObject({
            objectId: plan.poolId,
            include: { json: true },
          });
          const fields = response.object?.json || {};
          const totalStakedBase = Number(fields.total_staked || 0);
          const rewardPerSecondBase = Number(fields.reward_per_second || 0);
          const rewardBalanceBase = Number(fields.reward_balance || 0);
          const totalStaked = totalStakedBase / Number(FLOW_DECIMALS);
          const rewardPerDay = (rewardPerSecondBase * SECONDS_PER_DAY) / Number(FLOW_DECIMALS);
          const rewardBalance = rewardBalanceBase / Number(FLOW_DECIMALS);
          const estimatedApr = totalStakedBase > 0
            ? ((rewardPerSecondBase * SECONDS_PER_YEAR) / totalStakedBase) * 100
            : null;

          return [plan.name, {
            paused: Boolean(fields.paused),
            totalStaked,
            rewardPerDay,
            rewardBalance,
            estimatedApr,
          }];
        }),
      );

      setStakingPoolStats(Object.fromEntries(entries.filter(([, stats]) => stats)));
      setStakingPoolStatus("Live pool stats loaded from Sui testnet.");
    } catch (error) {
      console.error("[staking] Failed to load pool stats", error);
      setStakingPoolStatus("Unable to load live APR from Sui testnet.");
    }
  };

  const fetchStakingPosition = async () => {
    if (!account?.address) {
      setStakingPosition(null);
      setStakingStatus("Connect wallet to load staking position.");
      return;
    }
    if (!isStakingConfigured) {
      setStakingPosition(null);
      setStakingStatus("Set staking package and pool IDs to enable live staking.");
      return;
    }

    try {
      const response = await client.listOwnedObjects({
        owner: account.address,
        type: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::StakePosition`,
        include: { json: true },
        limit: 50,
      });
      const positions = response.objects
        .map((item) => {
          const fields = item.json;
          if (!fields) return null;
          return {
            id: item.objectId,
            poolId: fields.pool_id,
            amount: Number(fields.amount || 0) / Number(FLOW_DECIMALS),
            unlockTime: Number(fields.unlock_time || 0),
          };
        })
        .filter(Boolean);
      const activePosition = positions.find((position) => position.poolId === activeStakingPlan.poolId) || null;

      setStakingPosition(activePosition);
      setStakingStatus(activePosition ? "Active staking position loaded." : "No active position for this plan.");
    } catch (error) {
      console.error("[staking] Failed to load position", error);
      setStakingStatus("Unable to load staking position from Sui testnet.");
    }
  };

  const handleStake = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    if (!isStakingConfigured) return toast.error("Staking contract IDs are not configured yet.");

    const amountBigInt = BigInt(stakingAmount) * FLOW_DECIMALS;
    setStakingLoading(true);
    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(50_000_000n);
      const stakeCoin = tx.coin({
        balance: amountBigInt,
        type: FLOW_COIN_TYPE,
      });

      const position = tx.moveCall({
        target: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::stake`,
        typeArguments: [FLOW_COIN_TYPE],
        arguments: [tx.object(activeStakingPlan.poolId), stakeCoin, tx.object(SUI_CLOCK_OBJECT_ID)],
      });
      tx.transferObjects([position], account.address);

      await executeTransactionWithWallet(tx);
      toast.success(`Staked ${stakingAmount} $FLOW`);
      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      await fetchStakingPosition();
      scheduleBalanceRefresh();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking] Stake failed", error);
      toast.error(error?.message || "Stake failed.");
    } finally {
      setStakingLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    if (!stakingPosition?.id) return toast.error("No staking position to claim.");

    setStakingLoading(true);
    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(50_000_000n);
      const reward = tx.moveCall({
        target: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::claim_rewards`,
        typeArguments: [FLOW_COIN_TYPE],
        arguments: [tx.object(activeStakingPlan.poolId), tx.object(stakingPosition.id), tx.object(SUI_CLOCK_OBJECT_ID)],
      });
      tx.transferObjects([reward], account.address);

      await executeTransactionWithWallet(tx);
      toast.success("Rewards claimed.");
      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      await fetchStakingPosition();
      scheduleBalanceRefresh();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking] Claim failed", error);
      toast.error(error?.message || "Claim failed.");
    } finally {
      setStakingLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    if (!stakingPosition?.id) return toast.error("No staking position to unstake.");

    setStakingLoading(true);
    try {
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(50_000_000n);
      const [principal, reward] = tx.moveCall({
        target: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::unstake`,
        typeArguments: [FLOW_COIN_TYPE],
        arguments: [tx.object(activeStakingPlan.poolId), tx.object(stakingPosition.id), tx.object(SUI_CLOCK_OBJECT_ID)],
      });
      tx.transferObjects([principal, reward], account.address);

      await executeTransactionWithWallet(tx);
      toast.success("Unstake completed.");
      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      await fetchStakingPosition();
      scheduleBalanceRefresh();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking] Unstake failed", error);
      toast.error(error?.message || "Unstake failed. Check lock time or rewards balance.");
    } finally {
      setStakingLoading(false);
    }
  };

  const requireStakingAdmin = () => {
    if (!connected || !account?.address) {
      throw new Error("Connect the admin wallet.");
    }
    if (!isStakingAdminWallet) {
      throw new Error("Connected wallet is not the staking admin wallet.");
    }
    if (!FLOW_STAKING_PACKAGE_ID) {
      throw new Error("Staking package ID is not configured.");
    }
  };

  const handleAdminRewardRateChange = (planName, value) => {
    setAdminRewardRates((current) => ({ ...current, [planName]: value }));
  };

  const handleAdminRewardFundingChange = (planName, value) => {
    setAdminRewardFunding((current) => ({ ...current, [planName]: value }));
  };

  const handleSetStakingRewardRates = async () => {
    setStakingAdminLoading(true);
    try {
      requireStakingAdmin();

      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(50_000_000n);

      STAKING_PLANS.forEach((plan) => {
        const adminCapId = FLOW_STAKING_ADMIN_CAP_IDS[plan.name];
        if (!adminCapId || !plan.poolId) {
          throw new Error(`${plan.name} admin cap or pool is missing.`);
        }

        tx.moveCall({
          target: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::set_reward_rate`,
          typeArguments: [FLOW_COIN_TYPE],
          arguments: [
            tx.object(adminCapId),
            tx.object(plan.poolId),
            tx.pure.u64(parseU64Input(adminRewardRates[plan.name], `${plan.name} reward rate`, { allowZero: true })),
            tx.object(SUI_CLOCK_OBJECT_ID),
          ],
        });
      });

      await executeTransactionWithWallet(tx);
      setStakingAdminStatus("Reward rates updated on Sui testnet.");
      toast.success("Staking reward rates updated.");
      await fetchStakingPoolStats();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking-admin] Reward rate update failed", error);
      setStakingAdminStatus(error?.message || "Reward rate update failed.");
      toast.error(error?.message || "Reward rate update failed.");
    } finally {
      setStakingAdminLoading(false);
    }
  };

  const handleFundStakingRewards = async () => {
    setStakingAdminLoading(true);
    try {
      requireStakingAdmin();

      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(50_000_000n);

      STAKING_PLANS.forEach((plan) => {
        const adminCapId = FLOW_STAKING_ADMIN_CAP_IDS[plan.name];
        if (!adminCapId || !plan.poolId) {
          throw new Error(`${plan.name} admin cap or pool is missing.`);
        }

        const rewardCoin = tx.coin({
          balance: parseFlowAmountInput(adminRewardFunding[plan.name], `${plan.name} reward funding`),
          type: FLOW_COIN_TYPE,
        });

        tx.moveCall({
          target: `${FLOW_STAKING_PACKAGE_ID}::flow_staking::fund_rewards`,
          typeArguments: [FLOW_COIN_TYPE],
          arguments: [tx.object(adminCapId), tx.object(plan.poolId), rewardCoin],
        });
      });

      await executeTransactionWithWallet(tx);
      setStakingAdminStatus("Reward pools funded on Sui testnet.");
      toast.success("Staking reward pools funded.");
      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      scheduleBalanceRefresh();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking-admin] Reward funding failed", error);
      setStakingAdminStatus(error?.message || "Reward funding failed.");
      toast.error(error?.message || "Reward funding failed.");
    } finally {
      setStakingAdminLoading(false);
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
        backgroundMusicRef.current.muted = isMuted;
        if (isMuted) return;
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
  }, [isMuted]);

  useEffect(() => {
    if (!backgroundMusicRef.current) return;
    backgroundMusicRef.current.muted = isMuted;
    window.localStorage.setItem("flow-slot-muted", isMuted ? "1" : "0");
    if (!isMuted) {
      backgroundMusicRef.current.play().catch(() => {});
    }
  }, [isMuted]);



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
	      if (!isMuted) {
            const winAudio = new Audio("/slot/win-sound.wav");
            winAudio.volume = 0.45;
		    winAudio.play().catch(() => {});
          }

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
  }, [connected, account, slotBalance, isMuted]);

  useEffect(() => {
    if (slotBalance !== null) {
	  console.log("📤 React invia balance aggiornato al gioco:", slotBalance);
	  syncBalanceToGame(slotBalance);
    }
  }, [slotBalance]);

  useEffect(() => {
    if (!connected || !account?.address) return undefined;

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        fetchBalances({ silent: true });
        fetchStakingPoolStats();
        fetchStakingPosition();
      }
    };

    const handleFocusRefresh = () => {
      fetchBalances({ silent: true });
      fetchStakingPoolStats();
      fetchStakingPosition();
    };

    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("focus", handleFocusRefresh);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("focus", handleFocusRefresh);
    };
  }, [connected, account?.address]);

  useEffect(() => {
    fetchStakingPosition();
  }, [account?.address, selectedStakingPlan]);

  useEffect(() => {
    fetchStakingPoolStats();
  }, []);

  useEffect(() => () => {
    clearTimers(balancePostTimersRef);
    clearTimers(balanceRefreshTimersRef);
  }, []);

  const canShowWalletPanel = Boolean(isWalletReady && connected && account?.address);
  const isStakePage = window.location.pathname.replace(/\/+$/, "").toLowerCase() === STAKE_PATH;

  return (
    <main className={`flow-page ${isStakePage ? "flow-page-stake" : ""}`}>
    <section className="app-container" aria-label="Flow slot game">
      <div className="left-panel">
        <WalletActionShortcuts currentPage="slot" />
        {connected ? (
          <button className="btn" onClick={handleDisconnect}>
            Disconnect {currentWallet?.name ? `(${currentWallet.name})` : ""}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (wallets.length === 0) {
                toast.error("No Sui wallet found on this device.");
                return;
              }
              setShowWalletModal(true);
            }}
          >
            Connect Wallet
          </button>
        )}
	    <audio ref={backgroundMusicRef} src="/slot/flow-theme.mp3" loop />
        <button
          type="button"
          className="music-toggle panel-music-toggle"
          onClick={() => setIsMuted((prev) => !prev)}
          aria-label={isMuted ? "Attiva musica" : "Disattiva musica"}
          title={isMuted ? "Attiva musica" : "Disattiva musica"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
        {canShowWalletPanel ? (
          <>
            <div className={`wallet-box ${flashWin ? "flash-win" : ""}`}>
              <p><strong>Wallet:</strong><br />{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
              <p className="wallet-balance-line"><span className="wallet-line-icon" aria-hidden="true">👛</span><strong> FLOW Wallet:</strong> {FLOWBalance ?? "--"}</p>
              <p className="slot-balance-line"><span className="wallet-line-icon" aria-hidden="true">🎰</span><strong> FLOW Slot:</strong> {slotBalance}</p>
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
			  syncBalanceToGame(slotBalance ?? 0);
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

      {showWalletModal && (
        <div className="log-modal-backdrop" onClick={() => setShowWalletModal(false)}>
          <div className="log-modal wallet-select-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Connect Wallet</h2>
            <p className="wallet-select-hint">Open and unlock the wallet extension before selecting it.</p>
            <div className="wallet-select-list">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id ?? wallet.name}
                  type="button"
                  className="wallet-select-option"
                  onClick={() => handleConnectWallet(wallet)}
                  disabled={Boolean(connectingWalletName)}
                >
                  {wallet.icon ? <img src={wallet.icon} alt="" /> : <span className="wallet-fallback-icon">◆</span>}
                  <span>{wallet.name}</span>
                  {connectingWalletName === wallet.name ? <small>Connecting...</small> : null}
                </button>
              ))}
            </div>
            <button className="btn btn-close" onClick={() => setShowWalletModal(false)}>✖ Close</button>
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
    </section>

    <section className="staking-section staking-page" id="staking" aria-labelledby="staking-title">
      <div className="staking-topbar" aria-label="Staking navigation">
        <div className="staking-topbar-actions">
          <WalletActionShortcuts currentPage="stake" />
          {connected ? (
            <button className="staking-connect-button" onClick={handleDisconnect}>
              Disconnect {currentWallet?.name ? `(${currentWallet.name})` : ""}
            </button>
          ) : (
            <button
              className="staking-connect-button"
              type="button"
              onClick={() => {
                if (wallets.length === 0) {
                  toast.error("No Sui wallet found on this device.");
                  return;
                }
                setShowWalletModal(true);
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
      <div className="staking-shell">
        <div className="staking-copy">
          <p className="staking-kicker">Sui testnet staking</p>
          <h2 id="staking-title">$FLOW Staking Vault</h2>
          <p>
            A staking layer for players who want to lock $FLOW, earn scheduled rewards and unlock
            extra loyalty multipliers without mixing slot balance and staked funds.
          </p>
          <div className="staking-research">
            {STAKING_RESEARCH.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="staking-panel" aria-label="Staking panel">
          <div className="staking-panel-head">
            <div>
              <span>Wallet FLOW</span>
              <strong>{FLOWBalance ?? "--"}</strong>
            </div>
            <button
              type="button"
              className="staking-link"
              onClick={() => {
                fetchBalances();
                fetchStakingPoolStats();
                fetchStakingPosition();
              }}
            >
              Refresh
            </button>
          </div>

          <div className="staking-plan-grid" role="tablist" aria-label="Staking plans">
            {STAKING_PLANS.map((plan) => (
              <button
                key={plan.name}
                type="button"
                className={`staking-plan ${selectedStakingPlan === plan.name ? "active" : ""}`}
                onClick={() => {
                  setSelectedStakingPlan(plan.name);
                  setStakingAmount(Math.max(stakingAmount, plan.min));
                }}
              >
                <span>{plan.name}</span>
                <strong>{getPlanAprLabel(plan)}</strong>
                <small>{getPlanCardSubLabel(plan)}</small>
              </button>
            ))}
          </div>

          <div className="staking-pool-metrics" aria-live="polite">
            <div>
              <span>{activePoolStats?.totalStaked ? "Estimated APR" : "First stake APR"}</span>
              <strong>
                {activePoolStats?.totalStaked
                  ? formatApr(activePoolStats.estimatedApr)
                  : formatApr(projectedStakeApr)}
              </strong>
              {!activePoolStats?.totalStaked && activePoolStats && (
                <small>Based on your amount</small>
              )}
            </div>
            <div>
              <span>Emission / day</span>
              <strong>
                {activePoolStats ? `${formatFlowAmount(activePoolStats.rewardPerDay, 2)} FLOW` : "--"}
              </strong>
            </div>
            <div>
              <span>Pool rewards</span>
              <strong>
                {activePoolStats ? `${formatFlowAmount(activePoolStats.rewardBalance, 2)} FLOW` : "--"}
              </strong>
            </div>
            <div>
              <span>APY</span>
              <strong>Manual claim</strong>
            </div>
          </div>

          <label className="staking-input-label" htmlFor="staking-amount">
            Amount to stake
          </label>
          <div className="staking-amount-row">
            <button type="button" onClick={() => setStakingAmount((value) => Math.max(activeStakingPlan.min, value - 10000))}>-</button>
            <input
              id="staking-amount"
              type="number"
              min={activeStakingPlan.min}
              step="10000"
              value={stakingAmount}
              onChange={(event) => setStakingAmount(Math.max(activeStakingPlan.min, Number(event.target.value) || activeStakingPlan.min))}
            />
            <button type="button" onClick={() => setStakingAmount((value) => value + 10000)}>+</button>
          </div>

          <div className="staking-summary">
            <span>Lock</span>
            <strong>{activeStakingPlan.duration}</strong>
            <span>{activePoolStats?.totalStaked ? "Live APR" : "APR after stake"}</span>
            <strong>
              {activePoolStats?.totalStaked
                ? formatApr(activePoolStats.estimatedApr)
                : formatApr(projectedStakeApr)}
            </strong>
            <span>Reward weight</span>
            <strong>{getRewardWeightLabel(activeStakingPlan.name)}</strong>
            <span>Total staked</span>
            <strong>{activePoolStats ? `${formatFlowAmount(activePoolStats.totalStaked, 2)} FLOW` : "--"}</strong>
            <span>Staked</span>
            <strong>{stakingPosition ? `${stakingPosition.amount} $FLOW` : "--"}</strong>
            <span>Unlock</span>
            <strong>
              {stakingPosition?.unlockTime
                ? new Date(stakingPosition.unlockTime * 1000).toLocaleDateString()
                : "--"}
            </strong>
          </div>

          <p className="staking-pool-note">{stakingPoolStatus}</p>
          <p className={`staking-status ${isStakingConfigured ? "ready" : ""}`}>{stakingStatus}</p>

          <div className="staking-actions">
            <button type="button" onClick={handleStake} disabled={stakingLoading || !isStakingConfigured}>
              Stake
            </button>
            <button type="button" onClick={handleClaimRewards} disabled={stakingLoading || !stakingPosition}>
              Claim
            </button>
            <button type="button" onClick={handleUnstake} disabled={stakingLoading || !stakingPosition}>
              Unstake
            </button>
          </div>

          {isStakingAdminWallet && (
            <div className="staking-admin-panel" aria-label="Staking admin controls">
              <div className="staking-admin-head">
                <span>Admin wallet</span>
                <strong>Rewards control</strong>
              </div>

              <div className="staking-admin-grid">
                {STAKING_PLANS.map((plan) => (
                  <div className="staking-admin-row" key={`admin-${plan.name}`}>
                    <span>{plan.name}</span>
                    <label>
                      Rate / sec
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        value={adminRewardRates[plan.name]}
                        onChange={(event) => handleAdminRewardRateChange(plan.name, event.target.value)}
                      />
                    </label>
                    <label>
                      Fund FLOW
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={adminRewardFunding[plan.name]}
                        onChange={(event) => handleAdminRewardFundingChange(plan.name, event.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <p className="staking-admin-status">{stakingAdminStatus}</p>
              <div className="staking-admin-actions">
                <button type="button" onClick={handleSetStakingRewardRates} disabled={stakingAdminLoading}>
                  Set Rates
                </button>
                <button type="button" onClick={handleFundStakingRewards} disabled={stakingAdminLoading}>
                  Fund Pools
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer position="bottom-right" theme="dark" />
      {showWalletModal && (
        <div className="log-modal-backdrop" onClick={() => setShowWalletModal(false)}>
          <div className="log-modal wallet-select-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Connect Wallet</h2>
            <p className="wallet-select-hint">Open and unlock the wallet extension before selecting it.</p>
            <div className="wallet-select-list">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id ?? wallet.name}
                  type="button"
                  className="wallet-select-option"
                  onClick={() => handleConnectWallet(wallet)}
                  disabled={Boolean(connectingWalletName)}
                >
                  {wallet.icon ? <img src={wallet.icon} alt="" /> : <span className="wallet-fallback-icon">◆</span>}
                  <span>{wallet.name}</span>
                  {connectingWalletName === wallet.name ? <small>Connecting...</small> : null}
                </button>
              ))}
            </div>
            <button className="btn btn-close" onClick={() => setShowWalletModal(false)}>✖ Close</button>
          </div>
        </div>
      )}
    </section>
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet" createClient={createStubSuiClient}>
        <WalletProvider preferredWallets={["Nightly", "Slush", "Sui Wallet"]}>
          <GameContainer />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
