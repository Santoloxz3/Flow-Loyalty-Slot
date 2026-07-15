import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

export const TESTNET_GRPC_URL = "https://fullnode.testnet.sui.io:443";

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: TESTNET_GRPC_URL }),
});
