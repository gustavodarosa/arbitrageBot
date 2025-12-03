import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import { Jupiter, RouteInfo } from "@jup-ag/core";
import { tryJitoBundleSend } from "./jitoBundler";
import { estimatePriorityFee } from "./priorityFee";
import { logTx } from "../logging/logger";
import JSBI from "@jup-ag/core/node_modules/jsbi";

export type ExecutorFullOptions = {
  useJito?: boolean;
  simulateOnly?: boolean;
};

export async function executorFull(
  connection: Connection,
  jupiter: Jupiter,
  wallet: Keypair,
  routeAB: RouteInfo,
  routeBA: RouteInfo,
  opts?: ExecutorFullOptions
) {
  const start = Date.now();
  const useJito = opts?.useJito || (process.env.JITO_RPC_URL ? true : false);
  const simulateOnly = opts?.simulateOnly ?? true;

  try {
    // Build exchange tx for A->B
    const exchangeAB = await jupiter.exchange({
      routeInfo: routeAB,
      userPublicKey: wallet.publicKey,
      wrapUnwrapSOL: true,
    });

    if (!exchangeAB.transactions?.swapTransaction) {
      throw new Error("No swap transaction generated for AB route");
    }

    // Build exchange tx for B->A
    const exchangeBA = await jupiter.exchange({
      routeInfo: routeBA,
      userPublicKey: wallet.publicKey,
      wrapUnwrapSOL: true,
    });

    if (!exchangeBA.transactions?.swapTransaction) {
      throw new Error("No swap transaction generated for BA route");
    }

    // Combine both into single atomic transaction
    const tx = new Transaction();
    tx.add(...exchangeAB.transactions.swapTransaction.instructions);
    tx.add(...exchangeBA.transactions.swapTransaction.instructions);

    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.sign(wallet);
    const serialized = tx.serialize();

    // Simulate before execution
    console.log("🔍 Simulating transaction...");
    const simResult = await connection.simulateTransaction(tx, [wallet]);
    if (simResult.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simResult.value.err)}`);
    }
    console.log("✅ Simulation successful");

    // Use route's inputMint/outputMint or fallback to generic labels
    const pairLabel = `${(routeAB as any).inputMint || "A"}_${(routeAB as any).outputMint || "B"}`;

    if (simulateOnly) {
      console.log("📘 SIMULATE-ONLY MODE — transaction not executed");
      logTx({
        pair: pairLabel,
        status: "simulated",
        method: "simulate",
        latencyMs: Date.now() - start,
      });
      return { success: true, simulated: true, simResult };
    }

    // If Jito desired, try bundling
    if (useJito) {
      try {
        console.log("🚀 Attempting Jito bundle...");
        const bundleRes = await tryJitoBundleSend(
          connection,
          [serialized],
          { jitoRpcUrl: process.env.JITO_RPC_URL, priorityFeeLamports: await estimatePriorityFee(connection) }
        );
        console.log("✅ Bundle sent:", bundleRes);
        logTx({
          pair: pairLabel,
          status: "success",
          method: "jito",
          bundleSignature: bundleRes,
          latencyMs: Date.now() - start,
        });
        return { success: true, bundleSignature: bundleRes };
      } catch (err) {
        console.warn("⚠️ Jito failed, falling back to raw send:", err);
      }
    }

    // Fallback raw send
    console.log("🚀 Broadcasting raw transaction...");
    const sig = await connection.sendRawTransaction(serialized, {
      skipPreflight: true,
      maxRetries: 2,
    });
    console.log("✅ Transaction sent:", sig);

    await connection.confirmTransaction(sig, "confirmed");
    console.log("✅ Transaction confirmed");

    logTx({
      pair: pairLabel,
      status: "success",
      method: "raw",
      sig,
      latencyMs: Date.now() - start,
    });

    return { success: true, txSig: sig };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Executor error:", errorMsg);
    logTx({
      pair: "unknown",
      status: "failed",
      error: errorMsg,
      latencyMs: Date.now() - start,
    });
    return { success: false, error: errorMsg };
  }
}
