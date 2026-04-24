import { keccak256, toHex, parseAbiItem, stringToHex } from "viem";
import { publicClient, walletClient, serviceAccount } from "./arc.js";

export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;
export const VALIDATION_REGISTRY = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as const;

const identityAbi = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const reputationAbi = [
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "score", type: "int128" },
      { name: "kind", type: "uint8" },
      { name: "tag", type: "string" },
      { name: "ipfsUri1", type: "string" },
      { name: "ipfsUri2", type: "string" },
      { name: "ipfsUri3", type: "string" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const AGENT_METADATA_URI =
  process.env.ERC8004_METADATA_URI ??
  "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";

let cachedAgentId: bigint | undefined;

export async function getAgentIdForService(): Promise<bigint | undefined> {
  if (cachedAgentId !== undefined) return cachedAgentId;
  if (!serviceAccount) return undefined;

  try {
    const latest = await publicClient.getBlockNumber();
    const span = 10000n;
    const fromBlock = latest > span ? latest - span : 0n;
    const logs = await publicClient.getLogs({
      address: IDENTITY_REGISTRY,
      event: parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      ),
      args: { to: serviceAccount.address },
      fromBlock,
      toBlock: latest,
    });
    if (logs.length > 0) {
      cachedAgentId = logs[logs.length - 1].args.tokenId as bigint;
      return cachedAgentId;
    }
  } catch (err) {
    console.warn("[erc8004] getAgentId lookup failed:", (err as Error).message);
  }
  return undefined;
}

export async function registerAgentIfNeeded(): Promise<{
  agentId?: bigint;
  registerTx?: `0x${string}`;
  metadataUri: string;
}> {
  const existing = await getAgentIdForService();
  if (existing !== undefined) return { agentId: existing, metadataUri: AGENT_METADATA_URI };
  if (!walletClient || !serviceAccount) return { metadataUri: AGENT_METADATA_URI };

  try {
    const hash = await walletClient.writeContract({
      address: IDENTITY_REGISTRY,
      abi: identityAbi,
      functionName: "register",
      args: [AGENT_METADATA_URI],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    cachedAgentId = undefined;
    const id = await getAgentIdForService();
    return { agentId: id, registerTx: hash, metadataUri: AGENT_METADATA_URI };
  } catch (err) {
    console.warn("[erc8004] register failed:", (err as Error).message);
    return { metadataUri: AGENT_METADATA_URI };
  }
}

export async function recordFeedback(opts: {
  score: number;
  tag: string;
}): Promise<`0x${string}` | undefined> {
  const agentId = await getAgentIdForService();
  if (agentId === undefined || !walletClient) return undefined;
  try {
    const dataHash = keccak256(toHex(opts.tag));
    const hash = await walletClient.writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [agentId, BigInt(Math.max(0, Math.min(100, opts.score))), 0, opts.tag, "", "", "", dataHash],
    });
    return hash;
  } catch (err) {
    console.warn("[erc8004] giveFeedback failed:", (err as Error).message);
    return undefined;
  }
}

export async function lookupTokenURI(agentId: bigint): Promise<string | undefined> {
  try {
    return (await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityAbi,
      functionName: "tokenURI",
      args: [agentId],
    })) as string;
  } catch {
    return undefined;
  }
}

export { stringToHex };
