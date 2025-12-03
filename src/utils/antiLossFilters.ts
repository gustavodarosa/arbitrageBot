import JSBI from "jsbi";
import { PublicKey } from "@solana/web3.js";

export type PairWithMints = {
  baseMint: PublicKey;
  quoteMint: PublicKey;
};

export type AntiLossResult = {
  buy: any; // RouteInfo
  sell: any; // RouteInfo
  profit: JSBI; // profit amount in base token smallest units
};

/**
 * Double-check arbitrage opportunity with ultra-strict filters.
 * Prevents executing trades that would result in losses.
 *
 * @param jup Jupiter instance
 * @param pair Token pair with baseMint and quoteMint
 * @param amount Initial amount in base token (JSBI)
 * @returns AntiLossResult if profitable, null otherwise
 */
export async function antiLossDoubleCheck(
  jup: any,
  pair: PairWithMints,
  amount: JSBI
): Promise<AntiLossResult | null> {
  try {
    // BUY: base → quote
    const buyCheck = await jup.computeRoutes({
      inputMint: pair.baseMint,
      outputMint: pair.quoteMint,
      amount,
      slippageBps: 20,
    });

    if (!buyCheck?.routes || !buyCheck.routes[0]) {
      console.log("⚠️  antiLossDoubleCheck: no buy route found");
      return null;
    }

    const intermediate = buyCheck.routes[0].outAmount;

    // SELL: quote → base (roundtrip)
    const sellCheck = await jup.computeRoutes({
      inputMint: pair.quoteMint,
      outputMint: pair.baseMint,
      amount: intermediate,
      slippageBps: 20,
    });

    if (!sellCheck?.routes || !sellCheck.routes[0]) {
      console.log("⚠️  antiLossDoubleCheck: no sell route found");
      return null;
    }

    const finalAmount = sellCheck.routes[0].outAmount;

    // Guarantee real profit: final amount > initial amount
    if (JSBI.lessThanOrEqual(finalAmount, amount)) {
      console.log("⚠️  antiLossDoubleCheck: no profit after roundtrip", {
        initial: amount.toString(),
        final: finalAmount.toString(),
      });
      return null;
    }

    const profit = JSBI.subtract(finalAmount, amount);

    return {
      buy: buyCheck.routes[0],
      sell: sellCheck.routes[0],
      profit,
    };
  } catch (err) {
    console.error("❌ antiLossDoubleCheck error:", err);
    return null;
  }
}
