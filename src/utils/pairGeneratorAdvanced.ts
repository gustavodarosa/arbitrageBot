import { TokenListProvider, TokenInfo } from "@solana/spl-token-registry";
import { PublicKey } from "@solana/web3.js";
import { Jupiter } from "@jup-ag/core";
import JSBI from "@jup-ag/core/node_modules/jsbi";

export type GeneratedPair = { a: PublicKey; b: PublicKey; tokenInfo?: TokenInfo };

export async function generateAutomaticPairsAdvanced(jupiter: Jupiter, sampleAmountSol = 0.1, maxPairs = 300): Promise<GeneratedPair[]> {
  console.log("Loading token registry (mainnet)...");
  const tokenListProvider = new TokenListProvider();
  const tokens = await tokenListProvider.resolve();
  const tokenList = tokens.filterByChainId(101).getList();

  const SOL = new PublicKey("So11111111111111111111111111111111111111112");
  const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qjD7Z5iC5kS7FJ1B4K8Brq2Hf");

  // Basic filtering heuristics (risk engine light)
  const filtered = tokenList.filter(t => {
    if (!t.address) return false;
    if ((t.extensions && t.extensions?.website && t.extensions.website.includes('scam')) ) return false;
    if (t.decimals < 6) return false; // small decimals often reflex tokens
    if (t.symbol.length < 2 || t.symbol.length > 8) return false;
    // prefer tokens with cg id or tags
    if (!t.extensions?.coingeckoId && (!t.tags || t.tags.length === 0)) return false;
    return true;
  });

  console.log(`Token registry loaded: ${tokenList.length} tokens, filtered to ${filtered.length}.`);

  const pairs: GeneratedPair[] = [];

  // build candidate pairs SOL<->token and USDC<->token
  for (const t of filtered) {
    if (pairs.length >= maxPairs) break;
    try {
      const mint = new PublicKey(t.address);
      pairs.push({ a: SOL, b: mint, tokenInfo: t });
      if (pairs.length >= maxPairs) break;
      pairs.push({ a: USDC, b: mint, tokenInfo: t });
    } catch (err) {
      continue;
    }
  }

  // OPTIONAL: further rank by on-chain liquidity estimate using Jupiter routes
  console.log("Estimating liquidity/price impact for top pairs using Jupiter...");
  const amountLamports = JSBI.BigInt(Math.floor(sampleAmountSol * 1e9));
  const scored: Array<{ pair: GeneratedPair; score: number; priceImpactPct?: number }> = [];

  for (let i = 0; i < Math.min(pairs.length, 80); i++) {
    const p = pairs[i];
    try {
      const res = await jupiter.computeRoutes({
        inputMint: p.a,
        outputMint: p.b,
        amount: amountLamports,
        slippageBps: 100, // generous simulation
      });
      if (!res.routesInfos.length) continue;
      const best = res.routesInfos[0];
      const priceImpact = best.priceImpactPct || 0;
      // higher score for lower price impact (more liquid) and having coingecko id
      let score = 100 - (priceImpact * 100);
      if (p.tokenInfo?.extensions?.coingeckoId) score += 10;
      scored.push({ pair: p, score, priceImpactPct: priceImpact });
    } catch (err) {
      // ignore errors from computeRoutes
    }
  }

  // sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // return top N
  const top = scored.slice(0, maxPairs).map(s => s.pair);
  console.log(`Generated ${top.length} ranked pairs.`);
  return top;
}
