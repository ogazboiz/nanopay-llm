export const spendingPolicyAbi = [
  {
    type: "function",
    name: "canCharge",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "amountMicroUsd", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "charge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "amountMicroUsd", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const attestationAbi = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "streamId", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "providerId", type: "bytes32" },
      { name: "tokens", type: "uint256" },
      { name: "totalMicroUsd", type: "uint256" },
      { name: "qualityScore", type: "uint8" },
    ],
    outputs: [],
  },
] as const;

export const serviceRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "model", type: "string" },
      { name: "pricePerTokenMicroUsd", type: "uint256" },
      { name: "endpoint", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "providers",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "model", type: "string" },
      { name: "pricePerTokenMicroUsd", type: "uint256" },
      { name: "endpoint", type: "string" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
