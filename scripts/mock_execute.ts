import "dotenv/config";
import { Keypair, TransactionInstruction, PublicKey } from "@solana/web3.js";
import { executorFull } from "../src/execution/executorFull";

// Mock connection with minimal methods used by executorFull
const mockConnection: any = {
  getRecentBlockhash: async () => ({ blockhash: "mockblockhash" }),
  simulateTransaction: async (tx: any, signers: any[]) => ({ value: { err: null } }),
  sendRawTransaction: async (serialized: Buffer, opts?: any) => {
    return "mockSignature123";
  },
  confirmTransaction: async (sig: string, commitment?: any) => ({ context: {}, value: {} }),
};

// Mock Jupiter that returns swap instructions via exchange()
const mockJupiter: any = {
  exchange: async ({ routeInfo, userPublicKey, wrapUnwrapSOL }: any) => {
    // return a dummy swapTransaction containing a single no-op instruction
    const instr = new TransactionInstruction({ keys: [], programId: new PublicKey("11111111111111111111111111111111"), data: Buffer.from([]) });
    return { transactions: { swapTransaction: { instructions: [instr] } } };
  },
};

async function run() {
  const wallet = Keypair.generate();

  // Create fake route objects
  const routeAB = {
    outAmount: 2000000000, // example: bigger than input
    inAmount: 1000000000,
    priceImpactPct: 0.1,
    _raw: {},
  };
  const routeBA = {
    outAmount: 1200000000,
    inAmount: 2000000000,
    priceImpactPct: 0.1,
    _raw: {},
  };

  console.log("Starting mock executor (PAPER mode simulated)...");
  const res = await executorFull(mockConnection, mockJupiter, wallet, routeAB, routeBA, { simulateOnly: true });
  console.log("Executor result:", res);
}

run().catch((e) => {
  console.error("Mock execution failed:", e);
  process.exit(1);
});
