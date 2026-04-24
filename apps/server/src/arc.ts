import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcRpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const arcChainId = Number(process.env.ARC_CHAIN_ID ?? 5042002);

export const arc = defineChain({
  id: arcChainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [arcRpcUrl] } },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: arc, transport: http() });

const privateKey = process.env.SERVICE_WALLET_PRIVATE_KEY;
export const serviceAccount = privateKey
  ? privateKeyToAccount(privateKey as `0x${string}`)
  : undefined;

export const walletClient = serviceAccount
  ? createWalletClient({ account: serviceAccount, chain: arc, transport: http() })
  : undefined;

export const USDC_ADDRESS = (process.env.USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000") as `0x${string}`;
export const GATEWAY_WALLET_ADDRESS = (process.env.GATEWAY_WALLET_ADDRESS ?? "0x0077777d7EBA4688BDeF3E311b846F25870A19B9") as `0x${string}`;
export const GATEWAY_MINTER_ADDRESS = (process.env.GATEWAY_MINTER_ADDRESS ?? "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B") as `0x${string}`;
export const SPENDING_POLICY_ADDRESS = (process.env.SPENDING_POLICY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const ATTESTATION_ADDRESS = (process.env.ATTESTATION_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const SERVICE_REGISTRY_ADDRESS = (process.env.SERVICE_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export function usdToMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

export function usdToUsdcUnits(usd: number): bigint {
  return parseUnits(usd.toFixed(6), 6);
}
