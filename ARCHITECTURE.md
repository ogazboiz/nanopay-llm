# Architecture

## Flow: per-token streaming billing

```
User wallet ──► apps/web (Next.js chat UI)
                  │ POST /stream
                  ▼
               apps/server (Fastify)
                  │  1. openStream → creates stream record, reserves budget
                  │  2. streamChat(Gemini) → async iterator of tokens
                  │  3. per token:
                  │       - check SpendingPolicy.canCharge on Arc
                  │       - fire USDC nanopayment via Circle Nanopayments
                  │       - SSE frame back to client { token, tx, totalPaid }
                  │  4. closeStream → Attestation.anchor on Arc
                  ▼
                Arc L1 (EVM)
                  - USDC transfers
                  - ServiceRegistry (provider catalog)
                  - SpendingPolicy (budget guard)
                  - Attestation (receipts)
```

## Components

### apps/server
Fastify HTTP server. Opens SSE streams. Proxies Gemini. Fires per-token USDC nanopayments on Arc. Closes with an on-chain receipt attestation.

### apps/web
Next.js UI. User signs in with Circle Wallet, sets a per-stream cap, types a prompt, watches tokens stream in while the live counter shows tx count and USD paid.

### contracts
- `ServiceRegistry`: register LLM endpoints with per-token USDC prices.
- `SpendingPolicy`: daily, per-stream, and per-tx caps. Reverts if the stream tries to overspend.
- `Attestation`: records closed streams with token count, total paid, and quality score.

### packages/mcp
MCP server that exposes `stream_chat` and `list_models` tools. Any MCP-compatible agent (Claude Code, Cursor, custom agents) can call NanoPay endpoints with per-token billing.

### packages/cli
Command-line tool for registering new LLM providers in `ServiceRegistry` and managing spending policies.

### packages/shared
Shared TypeScript types for requests, events, providers, and policies.

## Agent-to-agent chain

A reasoning agent (Gemini 3 Pro) running on behalf of a user can sub-call a drafting agent (Gemini 3 Flash). Each hop opens its own stream with its own SpendingPolicy. Pro pays for its output tokens, Flash pays for its output tokens, all billed per token on Arc. The reasoning agent's policy caps total spend across hops.

## x402 per-request mode

For non-streaming endpoints (embeddings, single completions, tool outputs), the server ships an x402 facilitator that charges per request in USDC. Same wallet, same spending policy, different billing cadence.

## Why Arc

Per-token settlement is only economically viable if the settlement cost is an order of magnitude below the value settled. A Gemini Flash output token is worth roughly $0.0001. Ethereum gas per tx is around $2. Arc delivers sub-cent fees and sub-second finality. That gap is what makes this project possible.
