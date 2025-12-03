import { Connection } from "@solana/web3.js";

export function makeConnection(): Connection {
  const url = process.env.RPC_URL || "https://api.devnet.solana.com";
  return new Connection(url, { commitment: "confirmed" });
}
