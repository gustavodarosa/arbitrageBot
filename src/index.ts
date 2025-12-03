import "dotenv/config";
import { makeConnection } from "./utils/rpc";
import { loadKeypairFromEnv } from "./utils/wallet";
import { makeJupiter } from "./arbitrage/jupiterClient";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { startArbScanner } from "./arbitrage/arbitrageScanner";
import { executorFull } from "./execution/executorFull";
import { generateAutomaticPairsAdvanced } from "./utils/pairGeneratorAdvanced";
import { analyzeTokenRisk } from "./utils/riskEngine";
import { rankPairsByLiquidityAndSpread } from "./utils/ranking";
import { startDashboard } from "./monitor/dashboardServer";

async function main() {
  console.log("Starting Solana arbitrage POC (devnet). Use carefully.");
  const keypair = loadKeypairFromEnv();
  const connection = makeConnection();

  console.log("Wallet pubkey:", keypair.publicKey.toBase58());

  // Start dashboard for monitoring
  const dashboardPort = Number(process.env.DASH_PORT || 3001);
  startDashboard(dashboardPort);

  // Load Jupiter client
  const jupiter = await makeJupiter();

  if (!jupiter) {
    console.warn("Jupiter client unavailable — skipping pair generation, ranking, and scanner startup.");
    console.log("Application running in limited mode (dashboard + wallet only).");
    return;
  }

  // Generate token pairs automatically from registry with advanced filtering
  console.log("Generating candidate pairs automatically (this may take a few seconds)...");
  const generated = await generateAutomaticPairsAdvanced(jupiter, 0.05, 200);

  // Assess risk and filter
  const safePairs: typeof generated = [];
  for (const gp of generated) {
    const info = (gp as any).tokenInfo;
    const risk = analyzeTokenRisk(info);
    if (!risk.safe) continue;
    safePairs.push(gp);
  }
  console.log(`After risk filtering: ${safePairs.length} pairs.`);

  // Rank by liquidity
  const ranked = await rankPairsByLiquidityAndSpread(jupiter, safePairs, 0.05, 120);
  console.log("Top ranked pairs:");
  ranked.slice(0, 20).forEach((r, i) => {
    console.log(i + 1, r.pair.tokenInfo?.symbol || r.pair.b.toBase58().slice(0, 8), "impact:", r.priceImpactPct, "score:", r.score.toFixed(2));
  });

  const pairs = ranked.map(r => ({ a: r.pair.a, b: r.pair.b }));
  console.log(`Using ${pairs.length} pairs for scanner.`);

  // start scanner, pass callback to execute when an arb is found
  startArbScanner(connection, jupiter, keypair, pairs, undefined, async (info) => {
    try {
      console.log("🔥 Opportunity detected! Attempting execution...");
      console.log("  Profit: ", info.profitLamports, "lamports (≈", info.profitUsd.toFixed(2), "USD)");

      // Use pre-validated routes from scanner if available
      if (info.finalRoutes) {
        const paper = process.env.PAPER === "true" || process.env.NODE_ENV !== "production";
        const res = await executorFull(connection, jupiter, keypair, info.finalRoutes.buy, info.finalRoutes.sell, {
          useJito: process.env.JITO_RPC_URL ? true : false,
          simulateOnly: paper,
        });

        if (res.success) {
          console.log("✅ Execution successful:", res);
        } else {
          console.error("❌ Execution failed:", res.error);
        }
      } else {
        console.log("⚠️ No pre-validated routes from scanner, computing fresh routes...");
        
        // Fallback: re-compute routes for execution
        const mints = info.pair.split(" <-> ");
        const inputMint = new PublicKey(mints[0]);
        const outputMint = new PublicKey(mints[1]);

        const routesAB = await jupiter.computeRoutes({
          inputMint,
          outputMint,
          amount: info.amountInA,
          slippageBps: 50,
        });

        if (!routesAB.routes || !routesAB.routes[0]) {
          console.error("❌ No route AB found on recompute");
          return;
        }

        const routesBA = await jupiter.computeRoutes({
          inputMint: outputMint,
          outputMint: inputMint,
          amount: routesAB.routes[0].outAmount,
          slippageBps: 50,
        });

        if (!routesBA.routes || !routesBA.routes[0]) {
          console.error("❌ No route BA found on recompute");
          return;
        }

        const paper = process.env.PAPER === "true" || process.env.NODE_ENV !== "production";
        const res = await executorFull(connection, jupiter, keypair, routesAB.routes[0], routesBA.routes[0], {
          useJito: process.env.JITO_RPC_URL ? true : false,
          simulateOnly: paper,
        });

        if (res.success) {
          console.log("✅ Execution successful:", res);
        } else {
          console.error("❌ Execution failed:", res.error);
        }
      }
    } catch (err) {
      console.error("❌ Error in execute callback:", err);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
