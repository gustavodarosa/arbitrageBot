import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import { tryJitoBundleSend } from "./jitoBundler";
import { estimatePriorityFee } from "./priorityFee";
import { logTx } from "../logging/logger";


export type ExecutorFullOptions = {
  useJito?: boolean;
  simulateOnly?: boolean;
};

export async function executorFull(
  connection: Connection,
  jupiter: any,
  wallet: Keypair,
  routeAB: any,
  routeBA: any,
  opts?: ExecutorFullOptions
) {
  const start = Date.now();
  const useJito = opts?.useJito || (process.env.JITO_RPC_URL ? true : false);
  const simulateOnly = opts?.simulateOnly ?? true;

  try {
    // Build exchange txs for A->B and B->A using available helpers.
    let tx: Transaction | null = null;

    async function buildTxFromSwapResponse(swapResp: any) {
      // Common shape: swapTransaction.transaction (base64) or transaction (base64)
      const base64 = swapResp?.swapTransaction?.transaction || swapResp?.transaction || swapResp?.swapTransaction?.tx || null;
      if (!base64) return null;
      try {
        const buf = Buffer.from(base64, "base64");
        const t = Transaction.from(buf);
        return t;
      } catch (e) {
        // fallback: if instructions array present
        if (swapResp?.swapTransaction?.instructions) {
          const t2 = new Transaction();
          t2.add(...swapResp.swapTransaction.instructions);
          return t2;
        }
        return null;
      }
    }

    // try first with existing SDK helper
    let exchangeAB: any = null;
    let exchangeBA: any = null;
    if (typeof jupiter.exchange === "function") {
      exchangeAB = await jupiter.exchange({ routeInfo: routeAB, userPublicKey: wallet.publicKey, wrapUnwrapSOL: true });
      exchangeBA = await jupiter.exchange({ routeInfo: routeBA, userPublicKey: wallet.publicKey, wrapUnwrapSOL: true });
      tx = new Transaction();
      tx.add(...exchangeAB.transactions.swapTransaction.instructions);
      tx.add(...exchangeBA.transactions.swapTransaction.instructions);
    } else if (typeof jupiter.createSwap === "function") {
      // Use REST swap helper to get tx bytes
      const swapAB = await jupiter.createSwap({ inputMint: (routeAB as any)._raw?.inTokenMint || (routeAB as any).inputMint || (routeAB as any).inAmount, outputMint: (routeAB as any)._raw?.outTokenMint || (routeAB as any).outputMint || (routeAB as any).outAmount, amount: (routeAB as any).inAmount ?? (routeAB as any).amount, slippageBps: Math.floor((opts?.useJito ? 50 : 50)), userPublicKey: wallet.publicKey.toBase58(), wrapUnwrapSOL: true });
      const swapBA = await jupiter.createSwap({ inputMint: (routeBA as any)._raw?.inTokenMint || (routeBA as any).inputMint || (routeBA as any).inAmount, outputMint: (routeBA as any)._raw?.outTokenMint || (routeBA as any).outputMint || (routeBA as any).outAmount, amount: (routeBA as any).inAmount ?? (routeBA as any).amount, slippageBps: Math.floor((opts?.useJito ? 50 : 50)), userPublicKey: wallet.publicKey.toBase58(), wrapUnwrapSOL: true });

      const t1 = await buildTxFromSwapResponse(swapAB);
      const t2 = await buildTxFromSwapResponse(swapBA);
      if (t1 && t2) {
        tx = new Transaction();
        tx.add(...t1.instructions);
        tx.add(...t2.instructions);
      }
    }

    if (!tx) {
      if (simulateOnly) {
        console.log("📘 SIMULATE-ONLY MODE — unable to build txs from Jupiter, returning simulated success");
        return { success: true, simulated: true };
      }
      throw new Error("No swap transaction generated for routes and not in simulateOnly mode");
    }

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
