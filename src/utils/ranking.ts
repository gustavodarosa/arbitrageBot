import { Jupiter } from "@jup-ag/core";
import { GeneratedPair } from "./pairGeneratorAdvanced";
import JSBI from "@jup-ag/core/node_modules/jsbi";

export type PairScore = {
  pair: GeneratedPair;
  priceImpactPct?: number;
  bestOutAmount?: number;
  score: number;
};

export async function rankPairsByLiquidityAndSpread(jupiter: Jupiter, pairs: GeneratedPair[], sampleAmountSol = 0.1, limit = 120) {
  const amountLamports = JSBI.BigInt(Math.floor(sampleAmountSol * 1e9));
  const results: PairScore[] = [];

  for (let i = 0; i < Math.min(pairs.length, limit); i++) {
    const p = pairs[i];
    try {
      const res = await jupiter.computeRoutes({
        inputMint: p.a,
        outputMint: p.b,
        amount: amountLamports,
        slippageBps: 100,
      });
      if (!res.routesInfos.length) continue;
      const best = res.routesInfos[0];
      const impact = best.priceImpactPct || 0;
      const out = Number(best.outAmount || 0);
      // score: prefer low price impact and higher out amount
      const score = (100 - impact * 100) * 0.6 + Math.log10(Math.max(out, 1)) * 10;
      results.push({ pair: p, priceImpactPct: impact, bestOutAmount: out, score });
    } catch (err) {
      // ignore
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
