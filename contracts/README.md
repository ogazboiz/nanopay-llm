# NanoPay Contracts

Solidity contracts for NanoPay LLM on Arc.

## Contracts

- `ServiceRegistry.sol` — on-chain catalog of LLM provider endpoints with prices.
- `SpendingPolicy.sol` — per-user daily, per-stream, and per-tx spending caps enforced on-chain.
- `Attestation.sol` — on-chain receipt for each closed stream with token count, total paid, and quality score.

## Build

```sh
forge build
forge test
```

## Deploy

Populate `.env` with `ARC_RPC_URL` and `DEPLOYER_PRIVATE_KEY`, then run `forge script` (scripts to be added).
