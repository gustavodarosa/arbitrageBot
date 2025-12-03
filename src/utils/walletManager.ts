import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function loadKeypairsFromEnv(): Keypair[] {
  // Accept either:
  // - PRIVATE_KEYS_JSON = [[...], [...]]
  // - PRIVATE_KEYS_BASE58 = comma separated base58 keys
  const arrJson = process.env.PRIVATE_KEYS_JSON;
  const arrB58 = process.env.PRIVATE_KEYS_BASE58;
  const out: Keypair[] = [];

  if (arrJson) {
    try {
      const list = JSON.parse(arrJson) as number[][];
      for (const sk of list) {
        out.push(Keypair.fromSecretKey(Uint8Array.from(sk)));
      }
    } catch (err) {
      console.warn("PRIVATE_KEYS_JSON parse error", err);
    }
  }

  if (arrB58) {
    for (const b of arrB58.split(",").map(s => s.trim()).filter(Boolean)) {
      try {
        const sk = bs58.decode(b);
        out.push(Keypair.fromSecretKey(sk));
      } catch (err) {
        console.warn("PRIVATE_KEYS_BASE58 item parse error", err);
      }
    }
  }

  return out;
}
