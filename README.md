# Solana Arbitrage Bot - PoC

Proof-of-concept Solana arbitrage bot using Jupiter for devnet trading.

## Setup

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your devnet wallet's `PRIVATE_KEY_BASE58` or `PRIVATE_KEY_JSON`.

3. **Generate a devnet wallet (if needed):**
   ```bash
   solana-keygen new --outfile devnet-key.json
   ```

4. **Run:**
   ```bash
   npm run dev          # Development (ts-node)
   npm run build        # Compile TypeScript
   npm start            # Run compiled code
   ```

## Architecture

- **src/utils/rpc.ts** - Solana RPC connection setup
- **src/utils/wallet.ts** - Load keypair from environment
- **src/arbitrage/jupiterClient.ts** - Jupiter API client for swap routes
- **src/arbitrage/priceDetection.ts** - Find arbitrage opportunities
- **src/arbitrage/transactionBuilder.ts** - Build and sign transactions
- **src/index.ts** - Main entry point

## Safety Notes

⚠️ **IMPORTANT:**
- Never use a real mainnet private key on shared machines
- Always test on **devnet** first
- Use `simulateTransaction` before sending real txs
- Implement rate limiting and respect RPC/exchange limits
- Add MEV protection (private RPC endpoints)

## TODO Features

- [ ] Triangular arbitrage detection
- [ ] Cross-DEX price comparison
- [ ] Atomic multi-instruction swaps
- [ ] Real slippage/fee modeling
- [ ] Dry-run / paper-trading mode
- [ ] Monitoring and alerts

## Example Usage

See `src/index.ts` for the main loop. The PoC demonstrates:
1. Loading wallet and Jupiter client
2. Querying swap routes
3. Detecting price discrepancies (TODO)
4. Executing atomic swaps (TODO)
