import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { Jupiter, RouteInfo } from "@jup-ag/core";

export type ExecOptions = {
  simulateOnly?: boolean; // if true, do not broadcast
};

/**
 * Calculate dynamic slippage based on combined price impact.
 * Lower impact = stricter slippage (for better execution quality).
 *
 * @param buyImpactPct Price impact of buy route (0-100, e.g., 0.25 = 0.25%)
 * @param sellImpactPct Price impact of sell route (0.25 = 0.25%)
 * @returns Slippage in basis points (5-50 bps)
 */
export function calculateDynamicSlippage(buyImpactPct: number, sellImpactPct: number): number {
  const totalImpact = (buyImpactPct ?? 0) + (sellImpactPct ?? 0);

  // Excellent liquidity: 5 bps (0.05% tolerance)
  if (totalImpact < 0.1) return 5;
  // Good liquidity: 10 bps (0.1%)
  if (totalImpact < 0.25) return 10;
  // Moderate liquidity: 20 bps (0.2%)
  if (totalImpact < 0.5) return 20;
  // Poor liquidity: 50 bps (0.5%) — higher risk
  return 50;
}

// Execute a prepared Jupiter route: try to build exchange txs via Jupiter SDK, sign and send.
export async function executeArbitrage(
  connection: Connection,
  jupiter: Jupiter,
  wallet: Keypair,
  routeAB: RouteInfo, // route object from jupiter for A->B
  routeBA: RouteInfo, // route object from jupiter for B->A
  opts?: ExecOptions
) {
  const simulateOnly = opts?.simulateOnly ?? true;

  // Calculate dynamic slippage based on combined price impact
  const slippageBps = calculateDynamicSlippage(
    routeAB.priceImpactPct ?? 0,
    routeBA.priceImpactPct ?? 0
  );

  console.log("📊 Executing arbitrage with dynamic slippage:", slippageBps, "bps");
  console.log("  Buy impact:", routeAB.priceImpactPct, "% | Sell impact:", routeBA.priceImpactPct, "%");
  console.log("  simulateOnly=", simulateOnly);

  try {
    // Build exchange tx for A->B
    const exchangeAB = await jupiter.exchange({
      routeInfo: routeAB,
      userPublicKey: wallet.publicKey,
      wrapUnwrapSOL: true,
    });

    // Build exchange tx for B->A
    const exchangeBA = await jupiter.exchange({
      routeInfo: routeBA,
      userPublicKey: wallet.publicKey,
      wrapUnwrapSOL: true,
    });

    if (!exchangeAB.transactions?.swapTransaction || !exchangeBA.transactions?.swapTransaction) {
      console.error("❌ Failed to build swap transactions");
      return { success: false, error: "No swap transaction generated" };
    }

    // Combine both swaps into single transaction (for atomic execution)
    const tx = new Transaction();
    tx.add(...exchangeAB.transactions.swapTransaction.instructions);
    tx.add(...exchangeBA.transactions.swapTransaction.instructions);

    // CRITICAL: Simulate before execution (anti-loss filter)
    console.log("🔍 Simulating transaction...");
    const simResult = await connection.simulateTransaction(tx, [wallet]);

    if (simResult.value.err) {
      console.error("❌ Simulation failed, transaction cancelled:", simResult.value.err);
      return { success: false, error: "Simulation failed", simResult };
    }

    console.log("✅ Simulation successful");

    if (simulateOnly || process.env.PAPER === "true") {
      console.log("📘 PAPER MODE — operation simulated, NOT executed");
      return { success: true, simulated: true, simResult };
    }

    // Sign and broadcast
    console.log("🚀 Broadcasting transaction...");
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.sign(wallet);

    const signed = tx.serialize();
    const sig = await connection.sendRawTransaction(signed, { 
      skipPreflight: true, 
      maxRetries: 2 
    });

    console.log("✅ Transaction sent:", sig);

    // Wait for confirmation
    const conf = await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Transaction confirmed");

    return { success: true, txSig: sig, conf };
  } catch (err) {
    console.error("❌ executeArbitrage error:", err);
    return { success: false, error: String(err) };
  }
}

