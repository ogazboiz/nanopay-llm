export type HexAddress = `0x${string}`;

export interface LLMProvider {
  id: string;
  displayName: string;
  model: string;
  pricePerTokenUsd: number;
  endpoint: string;
  wallet: HexAddress;
}

export interface StreamOpenRequest {
  userWallet: HexAddress;
  model: string;
  prompt: string;
  maxUsd: number;
}

export interface StreamTokenEvent {
  token: string;
  tx: HexAddress;
  totalPaid: number;
}

export interface StreamDoneEvent {
  streamId: string;
  tokensBilled: number;
  totalPaid: number;
  attestationTx?: HexAddress;
}

export interface SpendingPolicy {
  owner: HexAddress;
  dailyCapUsd: number;
  perStreamCapUsd: number;
  perTxCapUsd: number;
  spentTodayUsd: number;
}
