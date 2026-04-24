# Deploy

## Backend → Railway

1. https://railway.app → New Project → Deploy from GitHub → select `nanopay-llm`.
2. Service settings:
   - Root: `/`
   - Builder: Nixpacks (auto from [railway.json](./railway.json))
   - Start command: auto from config
3. Environment variables (copy from your local `apps/server/.env`):
   ```
   GEMINI_API_KEY=...
   ARC_RPC_URL=https://rpc.testnet.arc.network
   ARC_CHAIN_ID=5042002
   SELLER_ADDRESS=0x8c13B1D1f6D2f93537E9E108b0A4Ec2a50C6621C
   DEMO_BUYER_PRIVATE_KEY=0x...
   SERVICE_WALLET_PRIVATE_KEY=0x...
   GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com
   USDC_ADDRESS=0x3600000000000000000000000000000000000000
   GATEWAY_WALLET_ADDRESS=0x0077777d7EBA4688BDeF3E311b846F25870A19B9
   GATEWAY_MINTER_ADDRESS=0x0022222ABE238Cc2C7Bb1f21003F0a260052475B
   ERC8004_REGISTER_ON_STARTUP=1
   PORT=8787
   ```
4. Deploy. Copy the public URL (e.g. `https://nanopay-llm.up.railway.app`).

## Frontend → Vercel

1. https://vercel.com → New Project → Import `nanopay-llm`.
2. Framework preset: **Next.js**
3. Root directory: `apps/web`
4. Build command: (auto from [vercel.json](./vercel.json))
5. Environment variable:
   ```
   NEXT_PUBLIC_SERVER_URL=https://<your-railway-url>
   ```
6. Deploy. Vercel gives you `https://nanopay-llm.vercel.app`.

## Contracts → Arc Testnet (optional)

```sh
cd contracts
git init -q && forge install foundry-rs/forge-std && rm -rf .git
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
```

The script deploys `ServiceRegistry`, `SpendingPolicy`, `Attestation`. It does **NOT** redeploy ERC-8004 — we use the canonical Arc addresses.

## Post-deploy checklist

- [ ] `/health` returns `ok: true` with correct addresses
- [ ] Click all 4 demo modes — each verifies a live x402 authorization
- [ ] Stress mode completes 50+ authorizations successfully
- [ ] Activity feed shows events with Arcscan links
- [ ] Update README's "Live demo" link
- [ ] Update SUBMISSION.md's "Live demo" link
- [ ] Record 90-second video (script in SUBMISSION.md)
