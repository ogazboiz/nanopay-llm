import { randomUUID } from "node:crypto";
import { keccak256, stringToBytes, stringToHex, zeroHash } from "viem";
import { publicClient, walletClient, usdToMicro, ATTESTATION_ADDRESS } from "./arc.js";
import { attestationAbi } from "./abi.js";
import { recordFeedback } from "./erc8004.js";

interface Stream {
  id: string;
  streamIdBytes: `0x${string}`;
  userWallet: `0x${string}`;
  providerId: `0x${string}`;
  model: string;
  pricePerTokenUsd: number;
  maxUsd: number;
  tokensBilled: number;
  totalPaidUsd: number;
  openedAt: number;
}

interface TokenResult {
  hash: `0x${string}`;
  totalPaid: number;
}

interface CloseResult {
  tokens: number;
  totalPaid: number;
  attestationTx?: `0x${string}`;
  reputationTx?: `0x${string}`;
}

const streams = new Map<string, Stream>();

const PRICE_PER_TOKEN_USD: Record<string, number> = {
  "gemini-3-flash-preview": 0.00005,
  "gemini-3-pro-preview": 0.0003,
};

export function providerIdFor(model: string): `0x${string}` {
  return keccak256(stringToBytes(model));
}

export async function openStream(opts: {
  userWallet: `0x${string}`;
  model: string;
  maxUsd: number;
}): Promise<string> {
  const id = randomUUID();
  const streamIdBytes = keccak256(stringToHex(id));
  const pricePerTokenUsd = PRICE_PER_TOKEN_USD[opts.model] ?? 0.0001;

  streams.set(id, {
    id,
    streamIdBytes,
    userWallet: opts.userWallet,
    providerId: providerIdFor(opts.model),
    model: opts.model,
    pricePerTokenUsd,
    maxUsd: opts.maxUsd,
    tokensBilled: 0,
    totalPaidUsd: 0,
    openedAt: Date.now(),
  });
  return id;
}

export async function billToken(streamId: string, _token: string): Promise<TokenResult> {
  const stream = streams.get(streamId);
  if (!stream) throw new Error(`Unknown stream ${streamId}`);

  const amountUsd = stream.pricePerTokenUsd;
  if (stream.totalPaidUsd + amountUsd > stream.maxUsd) {
    throw new Error("Stream budget exhausted");
  }

  stream.tokensBilled += 1;
  stream.totalPaidUsd += amountUsd;

  return { hash: zeroHash, totalPaid: stream.totalPaidUsd };
}

export async function closeStream(
  streamId: string,
  qualityScore = 5,
): Promise<CloseResult | undefined> {
  const stream = streams.get(streamId);
  if (!stream) return undefined;
  streams.delete(streamId);

  let attestationTx: `0x${string}` | undefined;
  if (
    walletClient &&
    ATTESTATION_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
    stream.tokensBilled > 0
  ) {
    try {
      attestationTx = await walletClient.writeContract({
        address: ATTESTATION_ADDRESS,
        abi: attestationAbi,
        functionName: "anchor",
        args: [
          stream.streamIdBytes,
          stream.userWallet,
          stream.providerId,
          BigInt(stream.tokensBilled),
          usdToMicro(stream.totalPaidUsd),
          qualityScore,
        ],
      });
    } catch (err) {
      console.warn("[attestation] anchor failed:", (err as Error).message);
    }
  }

  let reputationTx: `0x${string}` | undefined;
  if (stream.tokensBilled > 0) {
    const tag = `nanopay_stream_${stream.model.replace(/[^a-z0-9-]/gi, "_")}`;
    reputationTx = await recordFeedback({ score: qualityScore * 20, tag });
  }

  return {
    tokens: stream.tokensBilled,
    totalPaid: stream.totalPaidUsd,
    attestationTx,
    reputationTx,
  };
}

export { publicClient };
