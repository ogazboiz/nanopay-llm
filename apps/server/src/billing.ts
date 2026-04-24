import { randomUUID } from "node:crypto";

interface Stream {
  id: string;
  userWallet: `0x${string}`;
  model: string;
  maxUsd: number;
  tokensBilled: number;
  totalPaid: number;
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

export async function openStream(opts: {
  userWallet: `0x${string}`;
  model: string;
  maxUsd: number;
}): Promise<string> {
  const id = randomUUID();
  streams.set(id, {
    id,
    userWallet: opts.userWallet,
    model: opts.model,
    maxUsd: opts.maxUsd,
    tokensBilled: 0,
    totalPaid: 0,
    openedAt: Date.now(),
  });
  return id;
}

export async function billToken(streamId: string, _token: string): Promise<TxResult> {
  const stream = streams.get(streamId);
  if (!stream) throw new Error(`Unknown stream ${streamId}`);

  const pricePerToken = PRICE_PER_TOKEN_USD[stream.model] ?? 0.0001;
  if (stream.totalPaid + pricePerToken > stream.maxUsd) {
    throw new Error("Stream budget exhausted");
  }

  stream.tokensBilled += 1;
  stream.totalPaid += pricePerToken;

  return {
    hash: `0x${"0".repeat(64)}` as `0x${string}`,
    totalPaid: stream.totalPaid,
  };
}

export async function closeStream(streamId: string): Promise<Stream | undefined> {
  const stream = streams.get(streamId);
  streams.delete(streamId);
  return stream;
}
