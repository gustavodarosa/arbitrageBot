import { Connection } from "@solana/web3.js";

// Small helper to compute a priority fee (very basic heuristic)
export async function estimatePriorityFee(connection: Connection): Promise<number> {
  // Solana doesn't have an on-chain mempool fee oracle easily available;
  // here we use a simple heuristic: set fee based on env override.
  const envOverride = Number(process.env.PRIORITY_FEE_LAMPORTS || 0);
  if (envOverride > 0) return envOverride;

  try {
    // For production, use Helius/Alchemy fee estimation APIs
    // For now, return 0 (network will estimate)
    return 0;
  } catch (err) {
    return 0;
  }
}
