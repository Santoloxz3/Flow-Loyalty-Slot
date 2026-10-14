// =========================
// slot-game.js (React-linked)
// =========================

let externalWalletSelector = null;

function connectWallet() {
  console.log("🟡 Tentativo di connessione al wallet via React...");
  if (typeof externalWalletSelector === "function") {
    externalWalletSelector();
    console.log("🟢 Selettore wallet React attivato.");
  } else {
    console.error("❌ Nessuna funzione React collegata per la selezione del wallet.");
    alert("Il selettore wallet non è pronto. Carica prima React.");
  }
}

function requestSpin() {
  console.log("🎰 Richiesta SPIN inviata a React...");
  window.parent.postMessage({ type: "SPIN_REQUEST" }, "*");
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "SPIN_GRANTED") {
    console.log("✅ SPIN APPROVATO. Procedo con animazione.");
    if (typeof window.onSpinApproved === "function") {
      window.onSpinApproved();
    }
  }

  if (event.data?.type === "SPIN_DENIED") {
    console.warn("❌ SPIN NEGATO:", event.data.reason);
    alert("Spin non disponibile: " + event.data.reason);
  }
});

console.log("🔁 slot-game.js caricato correttamente e pronto.");
window.onConnectButtonPressed = connectWallet;
window.requestSpin = requestSpin;
window.setExternalWalletSelector = (selectorFn) => {
  console.log("🔗 React ha registrato il selettore wallet.");
  externalWalletSelector = selectorFn;
};
