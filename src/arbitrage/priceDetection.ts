/**
 * Price Detection and Arbitrage Opportunity Finder
 *
 * This module detects potential arbitrage opportunities by comparing
 * prices across different routes and DEXes.
 */

interface PriceRoute {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  pricePerUnit: number;
}

interface ArbitrageOpportunity {
  route1: PriceRoute;
  route2: PriceRoute;
  profitPercentage: number;
  profitable: boolean;
}

/**
 * Detect triangular arbitrage: A -> B -> C -> A
 * @param routeAB Price of B in terms of A
 * @param routeBC Price of C in terms of B
 * @param routeCA Price of A in terms of C
 * @returns Profit percentage if cycle is profitable
 */
export function detectTriangularArbitrage(
  routeAB: PriceRoute,
  routeBC: PriceRoute,
  routeCA: PriceRoute,
  initialAmount: number
): number {
  const afterAB = (initialAmount / routeAB.pricePerUnit) * routeAB.outputAmount;
  const afterBC = (afterAB / routeBC.pricePerUnit) * routeBC.outputAmount;
  const afterCA = (afterBC / routeCA.pricePerUnit) * routeCA.outputAmount;

  const profit = afterCA - initialAmount;
  return (profit / initialAmount) * 100;
}

/**
 * Compare two routes for cross-DEX arbitrage
 */
export function compareRoutes(
  route1: PriceRoute,
  route2: PriceRoute
): ArbitrageOpportunity {
  const priceDifference = Math.abs(
    route1.pricePerUnit - route2.pricePerUnit
  );
  const profitPercentage =
    (priceDifference / Math.max(route1.pricePerUnit, route2.pricePerUnit)) *
    100;

  return {
    route1,
    route2,
    profitPercentage,
    profitable: profitPercentage > 1.0, // 1% threshold
  };
}

/**
 * Filter opportunities by minimum profit threshold
 */
export function filterOpportunities(
  opportunities: ArbitrageOpportunity[],
  minProfitPercent: number = 1.0
): ArbitrageOpportunity[] {
  return opportunities.filter((opp) => opp.profitPercentage >= minProfitPercent);
}
