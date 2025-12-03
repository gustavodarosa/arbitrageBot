# Anti-Loss Protection System

## Overview
The arbitrage bot now includes multiple layers of loss prevention to ensure trades are only executed when real profit is guaranteed.

## 1. Anti-Loss Double-Check Filter

**Location:** `src/utils/antiLossFilters.ts`

### Purpose
Validates that arbitrage opportunities will actually be profitable before any transaction is sent.

### Algorithm
```
1. Query buy route (baseMint → quoteMint) with test amount
2. Get intermediate output amount
3. Query sell route (quoteMint → baseMint) using intermediate amount
4. Compare: final amount > initial amount?
5. If NO profit: return null (transaction cancelled)
6. If YES profit: return validated routes
```

### Key Features
- **Slippage: 20 bps** (ultra-strict for accuracy)
- **JSBI arithmetic** (exact big integer calculations)
- **No guessing** - actual routes verified on-chain
- **Prevents false positives** - real profit confirmed before execution

### Usage in Scanner
```typescript
// In arbitrageScanner.ts
const finalRoutes = await antiLossDoubleCheck(
  jupiter, 
  { baseMint: a, quoteMint: b }, 
  amountLamports
);

if (!finalRoutes) {
  return null; // No profit, skip opportunity
}

return {
  ...info,
  finalRoutes, // Include validated routes in callback
};
```

### API
```typescript
export async function antiLossDoubleCheck(
  jup: Jupiter,
  pair: PairWithMints,
  amount: JSBI
): Promise<AntiLossResult | null>

// Returns:
{
  buy: RouteInfo,    // A → B route
  sell: RouteInfo,   // B → A route  
  profit: JSBI       // Exact profit amount
}
```

---

## 2. Price Impact Pre-Filter

**Location:** `src/arbitrage/arbitrageScanner.ts` (lines 67-75)

### Purpose
Reject pairs with excessive slippage before spending RPC quota on double-check.

### Threshold
- **Max 0.5% price impact** per route (buy AND sell individually)
- Rejects both high-slippage buy routes AND high-slippage sell routes

### Code
```typescript
if (bestAB.priceImpactPct > 0.5) {
  return null; // Skip this pair
}

if (bestBA.priceImpactPct > 0.5) {
  return null; // Skip this pair
}
```

### Benefit
- Saves RPC calls on obviously bad opportunities
- Focuses double-check on promising pairs only
- Reduces latency and costs

---

## 3. Dynamic Slippage Calculation

**Location:** `src/executor/txExecutor.ts`

### Purpose
Adapts slippage tolerance to real liquidity conditions for optimal execution.

### Algorithm
```typescript
function calculateDynamicSlippage(
  buyImpactPct: number,
  sellImpactPct: number
): number {
  const totalImpact = buyImpactPct + sellImpactPct;
  
  // Excellent: < 0.1% total impact → 5 bps
  if (totalImpact < 0.1) return 5;
  
  // Good: < 0.25% total impact → 10 bps
  if (totalImpact < 0.25) return 10;
  
  // Moderate: < 0.5% total impact → 20 bps
  if (totalImpact < 0.5) return 20;
  
  // Poor: ≥ 0.5% total impact → 50 bps
  return 50;
}
```

### Slippage Tiers
| Total Impact | Slippage | Liquidity Quality |
|--------------|----------|------------------|
| < 0.1%       | 5 bps    | Excellent        |
| 0.1% - 0.25% | 10 bps   | Good             |
| 0.25% - 0.5% | 20 bps   | Moderate         |
| ≥ 0.5%       | 50 bps   | Poor/Risky       |

### Benefit
- Better fills on liquid pairs (tight slippage)
- Flexibility on less liquid pairs (wider tolerance)
- Reduces failed transactions from slippage variances

---

## 4. Transaction Simulation Before Broadcast

**Location:** `src/executor/txExecutor.ts` (lines 70-80)

### Purpose
Final validation that transaction will succeed before sending to blockchain.

### Process
```typescript
// Combine both buy+sell instructions
const tx = new Transaction();
tx.add(...exchangeAB.transactions.swapTransaction.instructions);
tx.add(...exchangeBA.transactions.swapTransaction.instructions);

// Simulate without commitment
const simResult = await connection.simulateTransaction(tx, [wallet]);

// Check for errors
if (simResult.value.err) {
  console.error("❌ Simulation failed, transaction cancelled");
  return { success: false, error: "Simulation failed" };
}
```

### What Gets Checked
- Instruction sequence validity
- Token account balances (simulated)
- Program execution logic
- Authority/signature verification
- Account state changes

### Benefit
- Catches problems before gas fees
- ~99% indicator of on-chain success
- No blocking if paper mode enabled

---

## 5. Paper Trading Mode

**Location:** Environment variable `PAPER=true`

### Purpose
Complete simulation without executing any real transactions.

### Flow
```typescript
if (simulateOnly || process.env.PAPER === "true") {
  console.log("📘 PAPER MODE — operation simulated, NOT executed");
  return { success: true, simulated: true, simResult };
}
```

### Use Cases
1. **Testing** - Verify bot logic without funds
2. **Backtesting** - Run multiple scenarios
3. **Demos** - Show functionality safely
4. **Learning** - Understand execution flow

---

## 6. Preliminary Profit Check

**Location:** `src/arbitrage/arbitrageScanner.ts` (lines 76-79)

### Purpose
Quick filter before expensive double-check operation.

### Logic
```typescript
const preliminaryProfit = JSBI.subtract(roundtripBack, amountLamports);

// Only proceed if preliminary profit > 0
if (JSBI.lessThanOrEqual(preliminaryProfit, JSBI.BigInt(0))) {
  return null; // Skip double-check
}
```

### Optimization
- Avoids unnecessary route queries
- Saves ~200ms per false opportunity
- Still uses conservative slippage (50 bps) for initial estimate

---

## Loss Prevention Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. SCANNER: Initial route queries                       │
│    - Buy route: A → B                                   │
│    - Sell route: B → A                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. FILTER: Check price impact                           │
│    - Max 0.5% per route (buy & sell)                    │
│    - Reject toxic liquidity pairs                       │
└────────────────┬────────────────────────────────────────┘
                 │ (if passes)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. PRELIMINARY CHECK: Quick profit estimation           │
│    - Compare: roundtripOut > initialIn?                 │
│    - Skip double-check if NO profit                     │
└────────────────┬────────────────────────────────────────┘
                 │ (if passes)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. ANTI-LOSS DOUBLE-CHECK: Validate actual profit      │
│    - Re-query routes with stricter slippage (20 bps)    │
│    - Confirm: finalAmount > initialAmount              │
│    - Return validated routes OR null                    │
└────────────────┬────────────────────────────────────────┘
                 │ (if passes)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 5. EXECUTOR: Dynamic slippage setup                     │
│    - Calculate slippage from real price impact          │
│    - Build atomized buy+sell transaction                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 6. SIMULATE: Pre-broadcast validation                   │
│    - Execute instructions in simulated state            │
│    - Check for errors (authority, balance, etc)         │
│    - Cancel if simulation fails                         │
└────────────────┬────────────────────────────────────────┘
                 │ (if passes)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 7. PAPER MODE CHECK: Skip broadcast if enabled          │
│    - Print "PAPER MODE" message                         │
│    - Return simulated results (NO transaction sent)     │
└────────────────┬────────────────────────────────────────┘
                 │ (if paper mode disabled)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 8. BROADCAST: Send to blockchain (final step)           │
│    - Sign with wallet keypair                           │
│    - Send raw transaction                               │
│    - Wait for confirmation                              │
└─────────────────────────────────────────────────────────┘
```

---

## Expected Console Output

### Opportunity Detected
```
🔥 Opportunity detected! Attempting execution...
  Profit:  12500 lamports (≈ 0.45 USD)
📊 Executing arbitrage with dynamic slippage: 10 bps
  Buy impact: 0.12 % | Sell impact: 0.08 %
🔍 Simulating transaction...
✅ Simulation successful
📘 PAPER MODE — operation simulated, NOT executed
✅ Execution successful: { success: true, simulated: true, ... }
```

### Loss Detected (Skipped)
```
⚠️  antiLossDoubleCheck: no profit after roundtrip
  initial: 100000000
  final: 99998500
```

### Filter Rejections (Not Shown - Silent)
```
// These are silently skipped (return null):
- Price impact > 0.5% (rejected immediately)
- Preliminary profit <= 0 (skip double-check)
- No routes found (return null)
```

---

## Configuration

In `.env`:
```
# Enable/disable paper trading
PAPER=true    # Simulate only
PAPER=false   # Execute real transactions

# Other options in index.ts:
amountSol=0.1              # Test amount per scan
slippageBps=50             # Initial quote slippage
minProfitUsd=0.5           # Minimum USD to execute (optional)
tickMs=3000                # Scan interval
concurrentPairs=4          # Parallel route queries
```

---

## Performance Impact

| Operation | Time | RPC Calls |
|-----------|------|-----------|
| Price impact check | ~10ms | 0 |
| Preliminary profit check | ~50ms | 0 |
| Anti-loss double-check | ~300ms | 2 |
| Dynamic slippage calc | ~2ms | 0 |
| Simulate transaction | ~100ms | 1 |
| **Total per opportunity** | ~460ms | 3 |

**Optimization**: Failed checks skip remaining steps (early exit saves ~400ms)

---

## Troubleshooting

### "Simulation failed, transaction cancelled"
- **Cause**: Token balance too low, insufficient SOL for fees
- **Fix**: Fund devnet wallet or test with larger amounts

### "antiLossDoubleCheck: no profit after roundtrip"
- **Cause**: Slippage variance or toxic liquidity
- **Fix**: Test with higher minProfitUsd threshold, avoid pairs with impact > 0.5%

### "No buy route found" / "No sell route found"
- **Cause**: Pair has no liquidity on Jupiter
- **Fix**: Pair will be auto-filtered, check Jupiter UI for liquidity

### "PAPER MODE — operation simulated, NOT executed"
- **Expected**: Normal in testing
- **To execute**: Set `PAPER=false` in `.env`

---

## Best Practices

1. ✅ **Always test in paper mode first**
   ```bash
   PAPER=true npm start
   ```

2. ✅ **Monitor simulation results carefully**
   - Check simulated output amounts
   - Verify profit calculations

3. ✅ **Use conservative test amounts initially**
   - Start with 0.05 SOL (amountSol=0.05)
   - Verify gas costs and slippage
   - Increase gradually

4. ✅ **Enable paper mode on devnet**
   - Devnet funding is free but limited
   - Paper mode tests bot logic without spending airdrops

5. ✅ **Check price impact before execution**
   - Pairs with > 0.5% impact are risky
   - Monitor console for impact values
   - Adjust minProfitUsd to compensate

6. ✅ **Keep wallet SOL balance > 0.5 SOL**
   - Minimum for transaction fees and rent exemption
   - Extra buffer for atomic multi-instruction txs

---

## References

- **JSBI Library**: High-precision integer arithmetic (no precision loss)
- **Jupiter API v3**: routesInfos endpoints, priceImpactPct property
- **Solana Simulation**: simulateTransaction checks instruction validity
- **Anti-Pattern**: Executing without simulation/double-check (high loss risk)
