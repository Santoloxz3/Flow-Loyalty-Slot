import { SuiGrpcClient } from "@mysten/sui/grpc";

const TESTNET_GRPC_URL = "https://fullnode.testnet.sui.io:443";

export function createSuiTestnetClient() {
  return new SuiGrpcClient({
    network: "testnet",
    baseUrl: TESTNET_GRPC_URL,
  });
}
