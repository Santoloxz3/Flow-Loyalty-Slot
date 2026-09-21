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
import { fromBase64 } from "@mysten/sui/utils";
import { ToastContainer, toast } from "react-toastify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";

const FLOW_COIN_TYPE = "0xd0486273be1484fe7881d3ffe2806c1d6437897a88ee496f8e4ff7348728d008::flow::FLOW";
const SLOT_WALLET_ADDRESS = "0xcdd3d0e5856712698a65fb2d375c3bdd5c80ca1c7c9d3dc219904269f1624f01";
const BACKEND_URL = "https://flow-loyalty-backend-pr-1.onrender.com"; // PR preview only; restore production URL before merge
const FLOW_ON_SUI_URL = "https://flowonsui.netlify.app";
const STAKE_PATH = "/stake";
const TESTNET_GRPC_URL = "https://fullnode.testnet.sui.io:443";
const FLOW_DECIMALS = 1_000_000_000n;
const STAKING_REWARD_PRECISION = 1_000_000_000_000n;
const SUI_CLOCK_OBJECT_ID = "0x6";
const FLOW_STAKING_PACKAGE_ID = import.meta.env.VITE_FLOW_STAKING_PACKAGE_ID || "";
const DEFAULT_FLOW_STAKING_POOL_ID = import.meta.env.VITE_FLOW_STAKING_POOL_ID || "";
const DEFAULT_STAKING_POOL_IDS = {
  Flexible: "0xb914f28e385b0d193c13e9cb9d6621466a209fd98376098aff97bc799b0bd234",
  Loyal: "0x0aac4a32e17c57b45b83f1aa4c4ea8014e3601d63258c4e40ec7257e7c8a20f4",
  Whale: "0xd2a17cf5c2554e8d16d19c6a0f3720fbc13663aefedcb528422c1b9dc675d40d",
};
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
  { name: "Flexible", duration: "0 days", boost: "1.0x", min: 10000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_FLEXIBLE_ID || DEFAULT_FLOW_STAKING_POOL_ID || DEFAULT_STAKING_POOL_IDS.Flexible },
  { name: "Loyal", duration: "30 days", boost: "1.4x", min: 25000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_LOYAL_ID || DEFAULT_STAKING_POOL_IDS.Loyal },
  { name: "Whale", duration: "90 days", boost: "2.2x", min: 100000, poolId: import.meta.env.VITE_FLOW_STAKING_POOL_WHALE_ID || DEFAULT_STAKING_POOL_IDS.Whale },
];

const STAKING_RESEARCH = [
  "Stake $FLOW without mixing staked funds with the slot.",
  "NFT Free Spins build Total XP and can unlock temporary Staking Reward Boosts.",
  "Your boost applies to staking rewards only: principal and lock rules stay unchanged.",
];

const LOYALTY_TIER_UI = [
  { name: "STARTER", xp: 0, boost: 0 },
  { name: "FLOWER", xp: 500, boost: 5 },
  { name: "HOLDER", xp: 1500, boost: 10 },
  { name: "WHALE", xp: 4000, boost: 15 },
  { name: "LEGEND", xp: 10000, boost: 20 },
  { name: "FLOW GOD", xp: 25000, boost: 25 },
];

const SHORTCUT_ICONS = {
  flow: "/shortcuts/flowonsui.jpg",
  stake: "/shortcuts/stake.jpg",
  slot: "/shortcuts/slot.jpg",
};

const SHORTCUT_TEXT = {
  flow: "Web Site",
  stake: "FlowLoyaltyStake",
  slot: "FlowLoyaltySlot",
};

const PremiumShortcutLink = ({ href, label, type, external = false }) => (
  <a
    href={href}
    className={`premium-shortcut premium-shortcut-${type}`}
    title={label}
    aria-label={label}
    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
  >
    <img src={SHORTCUT_ICONS[type]} alt="" aria-hidden="true" />
    <span className="shortcut-caption" aria-hidden="true">{SHORTCUT_TEXT[type]}</span>
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

const formatBoostRemaining = (expiresAt) => {
  if (!expiresAt) return "No active boost";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h remaining`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return hours > 0 ? `${hours}h remaining` : `${minutes}m remaining`;
};

const calculatePendingStakeRewards = (position, stats) => {
  if (!position || !stats) return null;

  try {
    const amount = BigInt(position.amountBase || "0");
    const rewardDebt = BigInt(position.rewardDebt || "0");
    let accRewardPerShare = BigInt(stats.accRewardPerShare || "0");
    const totalStaked = BigInt(stats.totalStakedBase || "0");
    const rewardPerSecond = BigInt(stats.rewardPerSecondBase || "0");
    const lastRewardTime = Number(stats.lastRewardTime || 0);
    const now = Math.floor(Date.now() / 1000);

    if (now > lastRewardTime && totalStaked > 0n) {
      const elapsed = BigInt(now - lastRewardTime);
      const reward = elapsed * rewardPerSecond;
      accRewardPerShare += (reward * STAKING_REWARD_PRECISION) / totalStaked;
    }

    const accumulated = (amount * accRewardPerShare) / STAKING_REWARD_PRECISION;
    const pending = accumulated > rewardDebt ? accumulated - rewardDebt : 0n;
    return Number(pending) / Number(FLOW_DECIMALS);
  } catch (error) {
    return null;
  }
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
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [slotReady, setSlotReady] = useState(false);
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [lastLoyaltySpin, setLastLoyaltySpin] = useState(null);
  const [loyaltyDiagnostics, setLoyaltyDiagnostics] = useState(null);
  const [stakingSpinsLeft, setStakingSpinsLeft] = useState(0);
  const [stakingSpinPlan, setStakingSpinPlan] = useState("");
  const [highBalanceCanSpin, setHighBalanceCanSpin] = useState(false);
  const lastSpinGrantedRef = useRef(false);
  const pendingFreeSpinSourceRef = useRef("nft");
  const pendingLoyaltySpinRef = useRef(null);
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
  const [lastStakingBoostResult, setLastStakingBoostResult] = useState(null);
  const activeStakingPlan = STAKING_PLANS.find((plan) => plan.name === selectedStakingPlan) ?? STAKING_PLANS[0];
  const isStakingAdminWallet = account?.address?.toLowerCase() === FLOW_STAKING_ADMIN_ADDRESS.toLowerCase();
  const activePoolStats = stakingPoolStats[activeStakingPlan.name];
  const projectedStakeApr = getProjectedApr(activePoolStats, stakingAmount);
  const pendingStakeRewards = calculatePendingStakeRewards(stakingPosition, activePoolStats);
  const activeStakingBoost = Math.max(0, Number(loyaltyProfile?.activeStakingBoost || 0));
  const pendingBoostReward = pendingStakeRewards === null
    ? null
    : (pendingStakeRewards * activeStakingBoost) / 100;
  const pendingTotalReward = pendingStakeRewards === null
    ? null
    : pendingStakeRewards + (pendingBoostReward || 0);
  const currentTotalXp = Math.max(0, Number(loyaltyProfile?.totalXp || 0));
  const currentTierLabel = String(loyaltyProfile?.currentTier || "starter").replaceAll("_", " ").toUpperCase();
  const nextLoyaltyTier = LOYALTY_TIER_UI.find((tier) => tier.xp > currentTotalXp) || null;
  const xpToNextTier = nextLoyaltyTier ? Math.max(0, nextLoyaltyTier.xp - currentTotalXp) : 0;
  const currentTierFloor = [...LOYALTY_TIER_UI].reverse().find((tier) => currentTotalXp >= tier.xp)?.xp || 0;
  const nextTierProgress = nextLoyaltyTier
    ? Math.min(100, Math.max(0, ((currentTotalXp - currentTierFloor) / Math.max(1, nextLoyaltyTier.xp - currentTierFloor)) * 100))
    : 100;
  const boostRemainingLabel = activeStakingBoost > 0
    ? formatBoostRemaining(loyaltyProfile?.boostExpiresAt)
    : "No active boost";
  const stakingSpinButtonText = stakingSpinPlan === "Whale"
    ? `🐳 Whale Staking Spin (${stakingSpinsLeft})`
    : stakingSpinPlan === "Loyal"
      ? `🍀 Loyal Staking Spin (${stakingSpinsLeft})`
      : `🔒 Staking Spin (${stakingSpinsLeft})`;
  const isFlexibleStakingPlan = activeStakingPlan.name === "Flexible";
  const isStakingUnlockLocked = Boolean(
    stakingPosition?.unlockTime &&
    !isFlexibleStakingPlan &&
    stakingPosition.unlockTime > Math.floor(Date.now() / 1000)
  );

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

    const [{ chainIdentifier }, { systemState }] = await Promise.all([
      client.core.getChainIdentifier(),
      client.core.getCurrentSystemState(),
    ]);
    const currentEpoch = BigInt(systemState.epoch);
    transaction.setExpiration({
      $kind: "ValidDuring",
      ValidDuring: {
        minEpoch: String(currentEpoch),
        maxEpoch: String(currentEpoch + 1n),
        minTimestamp: null,
        maxTimestamp: null,
        chain: chainIdentifier,
        nonce: Math.floor(Math.random() * 0x100000000),
      },
    });

    const walletTransaction = {
      async toJSON() {
        return transaction.toJSON({ client });
      },
      setSenderIfNotSet(address) {
        transaction.setSenderIfNotSet(address);
      },
    };

    const assertExecuted = async (result) => {
      const digest = result?.Transaction?.digest || result?.digest;
      const executed = digest
        ? await client.waitForTransaction({ digest, include: { effects: true }, timeout: 30_000 })
        : result;
      const status = executed?.Transaction?.status || executed?.effects?.status || result?.effects?.status;
      const failed = status && status.success === false;

      if (failed) {
        throw new Error(status.error || "Transaction failed on Sui testnet.");
      }

      return executed;
    };

    const signTransactionFeature = currentWallet.features["sui:signTransaction"];
    if (signTransactionFeature) {
      const { bytes, signature } = await signTransactionFeature.signTransaction({
        transaction: walletTransaction,
        account,
        chain: "sui:testnet",
      });
      const executed = await client.executeTransaction({
        transaction: fromBase64(bytes),
        signatures: [signature],
        include: { effects: true },
      });
      return assertExecuted(executed);
    }

    const signAndExecuteFeature = currentWallet.features["sui:signAndExecuteTransaction"];
    if (signAndExecuteFeature) {
      const executed = await signAndExecuteFeature.signAndExecuteTransaction({
        transaction: walletTransaction,
        account,
        chain: "sui:testnet",
      });
      return assertExecuted(executed);
    }

    const legacyFeature = currentWallet.features["sui:signAndExecuteTransactionBlock"];
    if (legacyFeature) {
      const transactionBlock = Transaction.from(await transaction.toJSON({ client }));
      const executed = await legacyFeature.signAndExecuteTransactionBlock({
        transactionBlock,
        account,
        chain: "sui:testnet",
        options: {
          showRawEffects: true,
          showRawInput: true,
        },
      });
      return assertExecuted(executed);
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
        fetchStakingFreeSpins();
      }, delay);
    });
  };

  const fetchFreeSpins = async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`${BACKEND_URL}/loyalty/status?wallet=${account.address}`);
      const data = await res.json();
      if (!res.ok) {
        const detail = data.diagnosticError ? `${data.message}: ${data.diagnosticError}` : data.message;
        throw new Error(detail || "Unable to load loyalty status");
      }
      setFreeSpinsLeft(data.spinsLeft ?? 0);
      setLoyaltyProfile(data.profile ?? null);
      setLoyaltyDiagnostics(data.diagnostics ?? null);
      console.info("[loyalty] diagnostics", data.diagnostics ?? null);
    } catch (err) {
      console.error("Error retrieving NFT loyalty status:", err);
      setFreeSpinsLeft(0);
      setLoyaltyDiagnostics({ error: err?.message || String(err) });
    }
  };

  const fetchStakingFreeSpins = async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`${BACKEND_URL}/staking-free-spin?wallet=${account.address}`);
      const data = await res.json();
      setStakingSpinsLeft(res.ok ? data.spinsLeft ?? 0 : 0);
      const availablePlan = Array.isArray(data.eligiblePlans)
        ? data.eligiblePlans.find((plan) => plan.available && plan.plan === "Whale") ||
          data.eligiblePlans.find((plan) => plan.available)
        : null;
      setStakingSpinPlan(res.ok && data.spinsLeft > 0 ? availablePlan?.plan || "" : "");
    } catch (err) {
      console.error("Error retrieving staking free spins:", err);
      setStakingSpinsLeft(0);
      setStakingSpinPlan("");
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

  const handleLoyaltySpin = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    if (freeSpinsLeft <= 0) return toast.error("No NFT Free Spins available.");
    if (!slotReady) return toast.info("Open the slot first: press Play in the game frame.");

    const iframe = document.querySelector("iframe");
    if (!iframe?.contentWindow) return toast.error("Slot not active.");

    setLoading(true);
    try {
      const requestId =
        globalThis.crypto?.randomUUID?.() ||
        `${account.address}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const timestamp = Date.now();
      const authMessage =
        `Authorize FLOW NFT loyalty spin for wallet: ${account.address}, request: ${requestId}, timestamp: ${timestamp}`;
      const signed = await signMessageWithWallet(new TextEncoder().encode(authMessage));

      const res = await fetch(`${BACKEND_URL}/loyalty/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: account.address,
          requestId,
          timestamp,
          signature: signed.signature,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || "NFT Free Spin unavailable");
        await fetchFreeSpins();
        return;
      }

      pendingLoyaltySpinRef.current = result;
      setLastLoyaltySpin(result);
      setFreeSpinsLeft(result.spinsLeft ?? 0);
      setLoyaltyProfile(result.profile ?? null);
      lastSpinGrantedRef.current = true;
      pendingFreeSpinSourceRef.current = "nft";

      iframe.contentWindow.postMessage(
        {
          type: "FREE_SPIN_AVAILABLE_NFT",
          roll: result.roll,
          resultCode: result.resultCode,
          spinId: result.spinId,
        },
        "*",
      );
    } catch (error) {
      console.error("[loyalty] spin start failed:", error);
      toast.error("Unable to start NFT Free Spin.");
    } finally {
      setLoading(false);
    }
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
            totalStakedBase: String(fields.total_staked || "0"),
            rewardPerSecondBase: String(fields.reward_per_second || "0"),
            accRewardPerShare: String(fields.acc_reward_per_share || "0"),
            lastRewardTime: Number(fields.last_reward_time || 0),
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
            amountBase: String(fields.amount || "0"),
            rewardDebt: String(fields.reward_debt || "0"),
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
      await fetchStakingFreeSpins();
      scheduleBalanceRefresh();
      scheduleStakingRefresh();
    } catch (error) {
      console.error("[staking] Stake failed", error);
      toast.error(error?.message || "Stake failed.");
    } finally {
      setStakingLoading(false);
    }
  };

  const processStakingBoostForDigest = async (digest, actionLabel) => {
    if (!digest) {
      const result = {
        status: "warning",
        action: actionLabel,
        message: "Staking transaction completed, but no digest was returned for XP boost verification.",
      };
      setLastStakingBoostResult(result);
      return result;
    }

    try {
      const boostRes = await fetch(`${BACKEND_URL}/staking-boost/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account.address, digest }),
      });
      const boostData = await boostRes.json();

      if (!boostRes.ok) {
        const result = {
          status: "warning",
          action: actionLabel,
          digest,
          message: boostData.message || "XP boost could not be processed.",
        };
        setLastStakingBoostResult(result);
        return result;
      }

      const result = {
        status: "success",
        action: actionLabel,
        digest,
        alreadyProcessed: Boolean(boostData.alreadyProcessed),
        boostPercent: Number(boostData.boostPercent || 0),
        baseRewardFlow: Number(boostData.baseRewardFlow || 0),
        bonusFlow: Number(boostData.bonusFlow || 0),
        finalRewardFlow: Number(
          boostData.finalRewardFlow ??
          (Number(boostData.baseRewardFlow || 0) + Number(boostData.bonusFlow || 0))
        ),
        bonusTx: boostData.bonusTx || null,
        message: boostData.message || null,
      };
      setLastStakingBoostResult(result);
      return result;
    } catch (boostError) {
      console.warn("[staking-boost] unable to process bonus", boostError);
      const result = {
        status: "warning",
        action: actionLabel,
        digest,
        message: boostError?.message || "Unable to contact XP boost service.",
      };
      setLastStakingBoostResult(result);
      return result;
    }
  };

  const handleClaimRewards = async () => {
    if (!connected || !account?.address) return toast.error("Connect to the wallet.");
    if (!stakingPosition?.id) return toast.error("No staking position to claim.");

    setStakingLoading(true);
    setLastStakingBoostResult(null);
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

      const executed = await executeTransactionWithWallet(tx);
      const claimDigest = executed?.Transaction?.digest || executed?.digest || null;
      const boostResult = await processStakingBoostForDigest(claimDigest, "Claim");

      if (boostResult?.status === "success") {
        const bonusText = boostResult.bonusFlow > 0
          ? ` + ${formatFlowAmount(boostResult.bonusFlow, 6)} FLOW XP boost`
          : "";
        toast.success(`Rewards claimed.${bonusText}`);
      } else {
        toast.warning(`Rewards claimed on-chain. ${boostResult?.message || "XP boost requires review."}`);
      }

      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      await fetchStakingPosition();
      await fetchStakingFreeSpins();
      await fetchFreeSpins();
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
    if (isStakingUnlockLocked) return toast.error("This staking position is still locked.");

    setStakingLoading(true);
    setLastStakingBoostResult(null);
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

      const executed = await executeTransactionWithWallet(tx);
      const unstakeDigest = executed?.Transaction?.digest || executed?.digest || null;
      const boostResult = await processStakingBoostForDigest(unstakeDigest, "Unstake");

      if (boostResult?.status === "success") {
        const bonusText = boostResult.bonusFlow > 0
          ? ` + ${formatFlowAmount(boostResult.bonusFlow, 6)} FLOW XP boost`
          : "";
        toast.success(`Unstake completed.${bonusText}`);
      } else {
        toast.warning(`Unstake completed on-chain. ${boostResult?.message || "XP boost requires review."}`);
      }

      await fetchBalances({ silent: true });
      await fetchStakingPoolStats();
      await fetchStakingPosition();
      await fetchStakingFreeSpins();
      await fetchFreeSpins();
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
    { src: "/slot/images/Glass.png", payout: " +10 Total XP" },
    { src: "/slot/images/Moon.png", payout: " +20 Total XP" },
    { src: "/slot/images/Bag.png", payout: " +40 Total XP" },
    { src: "/slot/images/Flow1.png", payout: " +60 Total XP" },
    { src: "/slot/images/jolly1.png", payout: "👑 +200 Total XP" },
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
    fetchStakingFreeSpins();
	fetchHighBalanceSpin();


    const handleMessage = async (event) => {
      const data = event.data;
      if (!data || !data.type) return;
	  
      console.log("📩 Messaggio ricevuto da iframe:", data);

      if (data.type === "SLOT_READY") {
        setSlotReady(true);
        console.info("Slot ready for backend-authorized NFT spins.");
        return;
      }
	  
      if (data.type === "SPIN_REQUEST") {
        // Legacy frame request: ignore silently. NFT spins are started only
        // through handleLoyaltySpin after backend authorization.
        console.info("Legacy frame spin ignored in NFT/XP mode.");
        return;
      }

      if (data.type === "SPIN_WIN") {
        if (!lastSpinGrantedRef.current || !pendingLoyaltySpinRef.current) {
          console.warn("SPIN_WIN received without an authorized NFT loyalty spin. Ignored.");
          return;
        }

        lastSpinGrantedRef.current = false;
        const reward = pendingLoyaltySpinRef.current;
        pendingLoyaltySpinRef.current = null;

        if (reward.bonusXp > 0) {
          if (!isMuted) {
            const winAudio = new Audio("/slot/win-sound.wav");
            winAudio.volume = 0.45;
            winAudio.play().catch(() => {});
          }
          setFlashWin(true);
          setGlowWin(true);
          setTimeout(() => setFlashWin(false), 1000);
          setTimeout(() => setGlowWin(false), 2000);
        }

        setLastLoyaltySpin(reward);
        setLoyaltyProfile(reward.profile ?? null);
        setSpinLog((prev) => [
          ...prev,
          `${reward.resultCode?.toUpperCase?.() || "SPIN"}: +${reward.loyaltyXp} Loyalty XP +${reward.bonusXp} Bonus XP = +${reward.spinTotalXp} Total XP`,
        ]);

        if (reward.tierUnlocked && reward.profile?.activeStakingBoost > 0) {
          toast.success(
            `${String(reward.profile.currentTier || "").replaceAll("_", " ").toUpperCase()} unlocked · +${reward.profile.activeStakingBoost}% Staking Reward Boost`,
          );
        } else {
          toast.success(`+${reward.spinTotalXp} XP`);
        }

        await fetchFreeSpins();
      }


	  if (data.type === "REQUEST_BALANCE") {
	    const safeBalance = slotBalance ?? 0;
	    console.log("📤 Il gioco ha chiesto il saldo. Invio:", safeBalance);
	    postBalanceToGame(safeBalance);
	  }
	  
      console.log("✅ React ha ricevuto FREE_SPIN_USED, sto aggiornando Supabase");

      if (data.type === "FREE_SPIN_USED_NFT") {
        // The spin is already consumed atomically by /loyalty/spin before animation starts.
        // Keep this legacy GDevelop message only as a UI refresh hook.
        pendingFreeSpinSourceRef.current = "nft";
        await fetchFreeSpins();
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
        fetchStakingFreeSpins();
        fetchFreeSpins();
      }
    };

    const handleFocusRefresh = () => {
      fetchBalances({ silent: true });
      fetchStakingPoolStats();
      fetchStakingPosition();
      fetchStakingFreeSpins();
      fetchFreeSpins();
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
          <button className="btn panel-wallet-button" onClick={handleDisconnect}>
            Disconnect {currentWallet?.name ? `(${currentWallet.name})` : ""}
          </button>
        ) : (
          <button
            className="btn panel-wallet-button"
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
            <div className={`wallet-box loyalty-wallet-box ${flashWin ? "flash-win" : ""}`}>
              <p><strong>Wallet:</strong><br />{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
              <p className="wallet-balance-line"><span className="wallet-line-icon" aria-hidden="true">👛</span><strong> FLOW Wallet:</strong> {FLOWBalance ?? "--"}</p>
              <div className="loyalty-summary-card">
                <div className="loyalty-summary-row">
                  <span>Total XP</span>
                  <strong>{loyaltyProfile?.totalXp ?? 0}</strong>
                </div>
                <div className="loyalty-summary-row">
                  <span>Loyalty XP</span>
                  <strong>{loyaltyProfile?.loyaltyXp ?? 0}</strong>
                </div>
                <div className="loyalty-summary-row">
                  <span>Bonus XP</span>
                  <strong>{loyaltyProfile?.bonusXp ?? 0}</strong>
                </div>
                <div className="loyalty-summary-row">
                  <span>Tier</span>
                  <strong>{String(loyaltyProfile?.currentTier || "starter").replaceAll("_", " ").toUpperCase()}</strong>
                </div>
                <div className="loyalty-summary-row">
                  <span>Staking Reward Boost</span>
                  <strong>
                    {loyaltyProfile?.activeStakingBoost > 0
                      ? `+${loyaltyProfile.activeStakingBoost}%`
                      : "None"}
                  </strong>
                </div>
                {loyaltyProfile?.boostExpiresAt && loyaltyProfile?.activeStakingBoost > 0 ? (
                  <small className="loyalty-boost-expiry">
                    Active until {new Date(loyaltyProfile.boostExpiresAt).toLocaleString()}
                  </small>
                ) : null}
              </div>

              {lastLoyaltySpin ? (
                <div className="loyalty-last-spin">
                  <strong>{String(lastLoyaltySpin.resultCode || "spin").replaceAll("_", " ").toUpperCase()}</strong>
                  <span>
                    +{lastLoyaltySpin.loyaltyXp} Loyalty XP · +{lastLoyaltySpin.bonusXp} Bonus XP ·
                    {" "}+{lastLoyaltySpin.spinTotalXp} Total XP
                  </span>
                </div>
              ) : null}

              {freeSpinsLeft === 0 && loyaltyDiagnostics ? (
                <div className="loyalty-diagnostics">
                  <strong>Preview NFT diagnostics</strong>
                  {"error" in loyaltyDiagnostics ? (
                    <span>{loyaltyDiagnostics.error}</span>
                  ) : (
                    <>
                      <span>Wallet objects seen: {loyaltyDiagnostics.ownedObjectCount ?? 0}</span>
                      <span>Whitelist matches: {loyaltyDiagnostics.whitelistMatches?.length ?? 0}</span>
                      <span>Rarity matches: {loyaltyDiagnostics.rarityMatches?.length ?? 0}</span>
                      <span>Eligible NFTs: {loyaltyDiagnostics.eligibleMatches?.length ?? 0}</span>
                    </>
                  )}
                </div>
              ) : null}

              <div className="loyalty-action-stack">
                <button
                  className="btn btn-free-spin glow-effect"
                  onClick={handleLoyaltySpin}
                  disabled={loading || freeSpinsLeft <= 0 || !slotReady}
                >
                  🎁 NFT Free Spin ({freeSpinsLeft})
                </button>

                {!slotReady ? (
                  <small className="slot-ready-hint">Press Play in the slot frame before using a Free Spin.</small>
                ) : null}

                <button className="btn btn-log" onClick={() => setShowLogModal(true)}>
                  📜 XP Logs
                </button>
              </div>
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
              setSlotReady(false);
			  syncBalanceToGame(slotBalance ?? 0);
		    }}
		  />
        </div>
      </div>

      <ToastContainer position="bottom-right" theme="dark" />
	  {showInfoModal && (
	    <div className="log-modal-backdrop" onClick={() => setShowInfoModal(false)}>
		  <div className="log-modal" onClick={(e) => e.stopPropagation()}>
		    <h2>🏆 XP Paytable</h2>
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
            <h2>📋 XP Log</h2>
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
          <p className="staking-kicker">NFT loyalty × Sui staking</p>
          <h2 id="staking-title">$FLOW Loyalty Staking</h2>
          <p>
            Stake $FLOW as usual and let your NFT activity work on top of it. Total XP can unlock
            temporary Staking Reward Boosts that increase the reward paid after a verified claim or unstake.
          </p>

          <div className="staking-loyalty-card" aria-label="Loyalty staking status">
            <div className="staking-loyalty-head">
              <div>
                <span>Your loyalty status</span>
                <strong>{currentTierLabel}</strong>
              </div>
              <div className={`staking-boost-badge ${activeStakingBoost > 0 ? "active" : ""}`}>
                {activeStakingBoost > 0 ? `+${activeStakingBoost}%` : "No boost"}
              </div>
            </div>

            <div className="staking-loyalty-metrics">
              <div>
                <span>Total XP</span>
                <strong>{currentTotalXp.toLocaleString()}</strong>
              </div>
              <div>
                <span>Staking Reward Boost</span>
                <strong>{activeStakingBoost > 0 ? `+${activeStakingBoost}%` : "None"}</strong>
              </div>
              <div>
                <span>Boost remaining</span>
                <strong>{boostRemainingLabel}</strong>
              </div>
            </div>

            <div className="staking-tier-progress" aria-label="Progress to next loyalty tier">
              <div className="staking-tier-progress-track">
                <span style={{ width: `${nextTierProgress}%` }} />
              </div>
              <small>
                {nextLoyaltyTier
                  ? `${xpToNextTier.toLocaleString()} XP to ${nextLoyaltyTier.name} · +${nextLoyaltyTier.boost}% boost`
                  : "Maximum loyalty tier reached"}
              </small>
            </div>
          </div>

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
                fetchFreeSpins();
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
            <div className={activeStakingBoost > 0 ? "boosted" : ""}>
              <span>XP boost</span>
              <strong>{activeStakingBoost > 0 ? `+${activeStakingBoost}% active` : "Not active"}</strong>
              <small>{activeStakingBoost > 0 ? boostRemainingLabel : "Earn Total XP in the slot"}</small>
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

          <div className="staking-position-card">
            <div className="staking-position-head">
              <div>
                <span>Position</span>
                <strong>{activeStakingPlan.name}</strong>
              </div>
              <small>{stakingPosition ? "Active position" : "No active position"}</small>
            </div>

            <div className="staking-position-meta">
              <div>
                <span>Lock</span>
                <strong>{activeStakingPlan.duration}</strong>
              </div>
              <div>
                <span>Reward weight</span>
                <strong>{getRewardWeightLabel(activeStakingPlan.name)}</strong>
              </div>
              <div>
                <span>Total staked</span>
                <strong>{activePoolStats ? `${formatFlowAmount(activePoolStats.totalStaked, 2)} FLOW` : "--"}</strong>
              </div>
              <div>
                <span>Your stake</span>
                <strong>{stakingPosition ? `${stakingPosition.amount} FLOW` : "--"}</strong>
              </div>
              <div>
                <span>Unlock</span>
                <strong>
                  {stakingPosition?.unlockTime && !isFlexibleStakingPlan
                    ? new Date(stakingPosition.unlockTime * 1000).toLocaleDateString()
                    : isFlexibleStakingPlan && stakingPosition ? "Any time" : "--"}
                </strong>
              </div>
            </div>

            <div className="staking-reward-breakdown" aria-label="Staking reward preview">
              <div>
                <span>Base reward</span>
                <strong>{pendingStakeRewards !== null ? `${formatFlowAmount(pendingStakeRewards, 6)} FLOW` : "--"}</strong>
              </div>
              <div className={activeStakingBoost > 0 ? "reward-boost-row active" : "reward-boost-row"}>
                <span>XP boost {activeStakingBoost > 0 ? `(+${activeStakingBoost}%)` : ""}</span>
                <strong>{pendingBoostReward !== null ? `+${formatFlowAmount(pendingBoostReward, 6)} FLOW` : "--"}</strong>
              </div>
              <div className="staking-reward-total">
                <span>Total claimable</span>
                <strong>{pendingTotalReward !== null ? `${formatFlowAmount(pendingTotalReward, 6)} FLOW` : "--"}</strong>
              </div>
              <small>
                The XP bonus is paid separately only after the backend verifies the successful on-chain staking reward transaction.
              </small>
            </div>
          </div>

          {lastStakingBoostResult ? (
            <div className={`staking-boost-result ${lastStakingBoostResult.status}`}>
              <div>
                <span>Last {lastStakingBoostResult.action || "staking"} result</span>
                <strong>
                  {lastStakingBoostResult.status === "success"
                    ? lastStakingBoostResult.bonusFlow > 0
                      ? `+${formatFlowAmount(lastStakingBoostResult.bonusFlow, 6)} FLOW boost paid`
                      : "No boost due"
                    : "Boost needs attention"}
                </strong>
              </div>
              {lastStakingBoostResult.status === "success" ? (
                <small>
                  Base {formatFlowAmount(lastStakingBoostResult.baseRewardFlow, 6)} FLOW ·
                  {" "}Boost {lastStakingBoostResult.boostPercent || 0}% ·
                  {" "}Total {formatFlowAmount(lastStakingBoostResult.finalRewardFlow, 6)} FLOW
                  {lastStakingBoostResult.alreadyProcessed ? " · already processed" : ""}
                </small>
              ) : (
                <small>{lastStakingBoostResult.message}</small>
              )}
            </div>
          ) : null}

          <p className="staking-pool-note">{stakingPoolStatus}</p>
          <p className={`staking-status ${isStakingConfigured ? "ready" : ""}`}>{stakingStatus}</p>

          <div className="staking-actions">
            <button type="button" onClick={handleStake} disabled={stakingLoading || !isStakingConfigured}>
              {stakingLoading ? "Working..." : "Stake"}
            </button>
            <button type="button" onClick={handleClaimRewards} disabled={stakingLoading || !stakingPosition}>
              Claim rewards
            </button>
            <button type="button" onClick={handleUnstake} disabled={stakingLoading || !stakingPosition || isStakingUnlockLocked}>
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
