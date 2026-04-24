import { randomUUID } from "node:crypto";
import { keccak256, stringToBytes, stringToHex, zeroHash } from "viem";
import {
  publicClient,
  walletClient,
  serviceAccount,
  usdToMicro,
  usdToUsdcUnits,
  USDC_ADDRESS,
  SPENDING_POLICY_ADDRESS,
  ATTESTATION_ADDRESS,
} from "./arc.js";
import { spendingPolicyAbi, attestationAbi, erc20Abi } from "./abi.js";

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

interface TxResult {
  hash: `0x${string}`;
  totalPaid: number;
}

const streams = new Map<string, Stream>();

const PRICE_PER_TOKEN_USD: Record<string, number> = {
  "gemini-3-flash": 0.00005,
  "gemini-3-pro": 0.0003,
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

export async function billToken(streamId: string, _token: string): Promise<TxResult> {
  const stream = streams.get(streamId);
  if (!stream) throw new Error(`Unknown stream ${streamId}`);

  const amountUsd = stream.pricePerTokenUsd;
  if (stream.totalPaidUsd + amountUsd > stream.maxUsd) {
    throw new Error("Stream budget exhausted");
  }

  const amountMicroUsd = usdToMicro(amountUsd);

  if (walletClient && serviceAccount) {
    const allowed = await publicClient.readContract({
      address: SPENDING_POLICY_ADDRESS,
      abi: spendingPolicyAbi,
      functionName: "canCharge",
      args: [stream.userWallet, amountMicroUsd],
    });
    if (!allowed) throw new Error("SpendingPolicy rejected charge");

    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transferFrom",
      args: [stream.userWallet, serviceAccount.address, usdToUsdcUnits(amountUsd)],
    });

    await walletClient.writeContract({
      address: SPENDING_POLICY_ADDRESS,
      abi: spendingPolicyAbi,
      functionName: "charge",
      args: [stream.userWallet, amountMicroUsd],
    });

    stream.tokensBilled += 1;
    stream.totalPaidUsd += amountUsd;
    return { hash, totalPaid: stream.totalPaidUsd };
  }

  stream.tokensBilled += 1;
  stream.totalPaidUsd += amountUsd;
  return { hash: zeroHash, totalPaid: stream.totalPaidUsd };
}

export async function closeStream(streamId: string, qualityScore = 5): Promise<{
  tokens: number;
  totalPaid: number;
  attestationTx?: `0x${string}`;
} | undefined> {
  const stream = streams.get(streamId);
  if (!stream) return undefined;
  streams.delete(streamId);

  let attestationTx: `0x${string}` | undefined;
  if (walletClient && stream.tokensBilled > 0) {
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
  }

  return {
    tokens: stream.tokensBilled,
    totalPaid: stream.totalPaidUsd,
    attestationTx,
  };
}
