import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import JSBI from "jsbi";
import { antiLossDoubleCheck } from "../utils/antiLossFilters";

export type ScannerOptions = {
  amountSol?: number; // amount in SOL to test per tick
  slippageBps?: number;
  minProfitUsd?: number; // threshold to execute
  tickMs?: number;
  concurrentPairs?: number;
  paper?: boolean; // if true, do not send txs
};

export function defaultOptions(): ScannerOptions {
  return {
    amountSol: 0.1,
    slippageBps: 50,
    minProfitUsd: 0.5,
    tickMs: 3000,
    concurrentPairs: 4,
    paper: process.env.PAPER === "true",
  };
}

// Basic triangular/cycle arbitrage detector for pairs X->Y->X.
export async function startArbScanner(
  connection: Connection,
  jupiter: any,
  wallet: Keypair,
  tokenPairs: Array<{ a: PublicKey; b: PublicKey }>,
  optsIn?: Partial<ScannerOptions>,
  executeCallback?: (info: any) => Promise<void>
) {
  const opts = { ...defaultOptions(), ...(optsIn || {}) };
  console.log("Arb scanner starting with options:", opts);

  async function checkPair(a: PublicKey, b: PublicKey) {
    try {
      const amountLamports = JSBI.BigInt(Math.floor((opts.amountSol || 0.1) * 1e9));

      // Quick initial check: A -> B -> A roundtrip
      const routesAB = await jupiter.computeRoutes({
        inputMint: a,
        outputMint: b,
        amount: amountLamports,
        slippageBps: opts.slippageBps || 50,
      });
      if (!routesAB.routes || !routesAB.routes.length) return null;
      const bestAB = routesAB.routes[0];

      // Check price impact filter (prevent high slippage pairs)
      if (bestAB.priceImpactPct > 0.5) {
        return null;
      }

      const amountB = bestAB.outAmount;
      const routesBA = await jupiter.computeRoutes({
        inputMint: b,
        outputMint: a,
        amount: amountB,
        slippageBps: opts.slippageBps || 50,
      });
      if (!routesBA.routes || !routesBA.routes.length) return null;
      const bestBA = routesBA.routes[0];

      // Check reverse price impact
      if (bestBA.priceImpactPct > 0.5) {
        return null;
      }

      const roundtripBack = bestBA.outAmount;
      const preliminaryProfit = JSBI.subtract(roundtripBack, amountLamports);

      // Only proceed if preliminary profit > 0
      if (JSBI.lessThanOrEqual(preliminaryProfit, JSBI.BigInt(0))) {
        return null;
      }

      // CRITICAL: Anti-loss double-check ensures real profit
      const finalRoutes = await antiLossDoubleCheck(jupiter, { baseMint: a, quoteMint: b }, amountLamports);
      if (!finalRoutes) {
        return null;
      }

      // Convert profit to number for reporting
      const profitLamports = Number(finalRoutes.profit);

      // Simple USD approximation (for USDC pairs)
      let profitUsd = 0;
      const USDC_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qjD7Z5iC5kS7FJ1B4K8Brq2Hf");
      if (b.equals(USDC_MAINNET)) {
        const outUsdc = Number(bestAB.outAmount) / 1e6;
        const recoveredSol = Number(roundtripBack) / 1e9;
        const initialSol = Number(amountLamports) / 1e9;
        const profitSol = recoveredSol - initialSol;
        profitUsd = profitSol * outUsdc / (Number(bestAB.outAmount) / (Number(amountLamports) / 1e9));
      }

      return {
        pair: `${a.toBase58()} <-> ${b.toBase58()}`,
        amountInA: Number(amountLamports),
        outAB: bestAB.outAmount,
        outBA: bestBA.outAmount,
        profitLamports,
        profitUsd,
        routeAB: bestAB.marketInfos.map((m: any) => m.label),
        routeBA: bestBA.marketInfos.map((m: any) => m.label),
        finalRoutes, // Include final validated routes
      };
    } catch (err) {
      console.error("checkPair error:", err);
      return null;
    }
  }

  // simple concurrency runner
  async function tick() {
    const now = Date.now();
    console.log(new Date(now).toISOString(), "Tick: scanning", tokenPairs.length, "pairs");

    const promises: Promise<any>[] = [];
    for (const p of tokenPairs) {
      promises.push(checkPair(p.a, p.b));
      // throttle concurrency
      if (promises.length >= (opts.concurrentPairs || 4)) {
        const results = await Promise.all(promises);
        for (const r of results) {
          if (r && r.profitLamports > 0) {
            console.log("Potential arb found:", r);
            if (!opts.paper && executeCallback) {
              // fire and forget execution
              executeCallback(r).catch((e) => console.error("executeCallback error:", e));
            }
          }
        }
        promises.length = 0; // reset
      }
    }
    // flush remaining
    if (promises.length) {
      const results = await Promise.all(promises);
      for (const r of results) {
        if (r && r.profitLamports > 0) {
          console.log("Potential arb found:", r);
          if (!opts.paper && executeCallback) {
            executeCallback(r).catch((e) => console.error("executeCallback error:", e));
          }
        }
      }
    }
  }

  // main loop
  while (true) {
    try {
      await tick();
      await new Promise((r) => setTimeout(r, opts.tickMs));
    } catch (err) {
      console.error("Scanner main loop error:", err);
      await new Promise((r) => setTimeout(r, opts.tickMs));
    }
  }
}
