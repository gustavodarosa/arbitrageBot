import { Connection, PublicKey } from "@solana/web3.js";
import { Jupiter } from "@jup-ag/core";

// Lightweight wrapper to query Jupiter routes. Keep in mind Jupiter SDK evolves; check docs.
export async function makeJupiter(connection: Connection) {
  try {
    const jupiter = await Jupiter.load({
      connection,
      cluster: "devnet",
      user: undefined,
    });
    return jupiter;
  } catch (err) {
    console.error("Jupiter client failed to load:", err);
    return undefined as any;
  }
}

export async function getTopRoutes(jupiter: Jupiter, inputMint: PublicKey, outputMint: PublicKey, amountLamports: any) {
  const routes = await jupiter.computeRoutes({
    inputMint, // e.g. SOL wrapped
    outputMint,
    amount: amountLamports,
    slippageBps: 50 // 0.5%
  });
  return routes.routesInfos;
}
