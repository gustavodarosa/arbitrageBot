import { TokenInfo } from "@solana/spl-token-registry";

export type RiskReport = {
  safe: boolean;
  reasons: string[];
  score: number; // 0-100, higher = safer
};

export function analyzeTokenRisk(token?: TokenInfo): RiskReport {
  const r: RiskReport = { safe: true, reasons: [], score: 50 };
  if (!token) {
    r.safe = false;
    r.reasons.push("no token metadata");
    r.score = 0;
    return r;
  }

  // basic heuristics
  if (!token.extensions?.coingeckoId) {
    r.reasons.push("no coingecko id");
    r.score -= 15;
  } else {
    r.score += 10;
  }

  if (token.tags && token.tags.includes("spam")) {
    r.reasons.push("tagged spam");
    r.score -= 30;
    r.safe = false;
  }

  // Check for potential freeze authority in extensions (varies by token registry version)
  if ((token.extensions as any)?.freezeAuthority) {
    r.reasons.push("has freeze authority");
    r.score -= 25;
  }

  if (token.decimals < 6) {
    r.reasons.push("low decimals (<6)");
    r.score -= 10;
  }

  // clamp
  if (r.score < 0) r.score = 0;
  if (r.score > 100) r.score = 100;
  if (r.score < 40) r.safe = false;

  return r;
}

