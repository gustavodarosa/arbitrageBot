import "dotenv/config";
import { Keypair, PublicKey } from "@solana/web3.js";
import { executorFull } from "../src/execution/executorFull";
import { antiLossDoubleCheck } from "../src/utils/antiLossFilters";

// This script simulates multiple token pairs and forces one profitable arb
// to test the scanner+executor pipeline without network.

async function simulate() {
  const wallet = Keypair.generate();
  const mockJupiter: any = {
    computeRoutes: async ({ inputMint, outputMint, amount }: any) => {
      // Create deterministic fake routes: if pair matches a known profitable pair, return profitable outAmount
      const a = String(inputMint).slice(0,6);
      const b = String(outputMint).slice(0,6);
      const key = `${a}_${b}`;
      // profitable pair key
      const profitableKey = 'So1111_EPjFWd';
      if (key === profitableKey) {
        return { routes: [ { outAmount: String(Number(amount) * 2), inAmount: String(amount), priceImpactPct: 0.05, marketInfos: [{ label: 'MOCK_POOL'}], _raw: {} } ] };
      }
      // otherwise small/no liquidity
      return { routes: [ { outAmount: String(Math.max(0, Number(amount) - 1000)), inAmount: String(amount), priceImpactPct: 0.6, marketInfos: [{ label: 'MOCK_POOR'}], _raw: {} } ] };
    },
    createSwap: async (opts: any) => {
      // return a fake swap transaction encoded as base64 of empty tx
      return { swapTransaction: { transaction: Buffer.from([]).toString('base64') } };
    }
  };

  // Define mock pairs: include the profitable pair (SOL -> USDC)
  const SOL = new PublicKey('So11111111111111111111111111111111111111112');
  const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

  const pairs = [ { a: SOL, b: USDC }, /* more could be added */ ];

  console.log('Starting mock arbitrage run — scanning simulated pairs...');

  for (const p of pairs) {
    const amountLamports = 10000000; // sample amount
    const routesAB = await mockJupiter.computeRoutes({ inputMint: p.a, outputMint: p.b, amount: amountLamports, slippageBps: 50 });
    const bestAB = routesAB.routes[0];
    console.log('Simulated AB best outAmount=', bestAB.outAmount, 'impact=', bestAB.priceImpactPct);

    const routesBA = await mockJupiter.computeRoutes({ inputMint: p.b, outputMint: p.a, amount: bestAB.outAmount, slippageBps: 50 });
    const bestBA = routesBA.routes[0];
    console.log('Simulated BA best outAmount=', bestBA.outAmount, 'impact=', bestBA.priceImpactPct);

    // Simple profit check (number-based) instead of JSBI anti-loss to avoid type issues in mock
    const initial = Number(amountLamports);
    const afterRoundtrip = Number(bestBA.outAmount);
    const profit = afterRoundtrip - initial;
    if (!(profit > 0)) {
      console.log('No profit after roundtrip (mock) — skipping');
      continue;
    }

    console.log('Mock profit detected:', profit, 'smallest units');

    // call executorFull in simulateOnly mode with the mock routes
    const res = await executorFull({
      // minimal mock connection
      getRecentBlockhash: async () => ({ blockhash: 'mock' }),
      simulateTransaction: async () => ({ value: { err: null } }),
      sendRawTransaction: async () => 'mocksig',
      confirmTransaction: async () => ({})
    } as any, mockJupiter, wallet, {
      outAmount: bestAB.outAmount,
      inAmount: amountLamports,
      priceImpactPct: bestAB.priceImpactPct,
      marketInfos: bestAB.marketInfos,
      _raw: bestAB._raw,
    }, {
      outAmount: bestBA.outAmount,
      inAmount: bestBA.inAmount,
      priceImpactPct: bestBA.priceImpactPct,
      marketInfos: bestBA.marketInfos,
      _raw: bestBA._raw,
    }, { simulateOnly: true });

    console.log('Executor result:', res);
  }
}

simulate().catch((e)=>{ console.error('mock_arb_run failed', e); process.exit(1); });
