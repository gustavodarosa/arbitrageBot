import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import readlineSync from "readline-sync";
import { decryptPrivateKey } from "./secureKey";

export function loadKeypairFromEnv(): Keypair {
  const json = process.env.PRIVATE_KEY_JSON;
  const b58 = process.env.PRIVATE_KEY_BASE58;
  if (json) {
    try {
      const arr = JSON.parse(json) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch (err) {
      throw new Error(`PRIVATE_KEY_JSON parse error: ${err}`);
    }
  }
  if (b58) {
    try {
      const secret = bs58.decode(b58);
      return Keypair.fromSecretKey(secret);
    } catch (err) {
      throw new Error(`PRIVATE_KEY_BASE58 parse error: ${err}`);
    }
  }

  // Fallback: look for encrypted key file in ./secrets/encrypted_key.json
  try {
    const encPath = path.join(process.cwd(), "secrets", "encrypted_key.json");
    if (fs.existsSync(encPath)) {
      const payload = fs.readFileSync(encPath, { encoding: "utf8" });
      // If a passphrase was provided via env, use it non-interactively
      const envPass = process.env.PRIVATE_KEY_PASSPHRASE;
      if (envPass) {
        try {
          const secretKey = decryptPrivateKey(payload, envPass);
          return Keypair.fromSecretKey(secretKey);
        } catch (err) {
          throw new Error(`Failed to decrypt encrypted key with PRIVATE_KEY_PASSPHRASE: ${err}`);
        }
      }

      // If running in PAPER mode, fall back to an ephemeral Keypair instead of prompting
      const paper = (process.env.PAPER || "").toLowerCase();
      if (paper === "true" || paper === "1") {
        const ephemeral = Keypair.generate();
        console.log(`PAPER mode: no key provided, using ephemeral Keypair ${ephemeral.publicKey.toBase58()}`);
        return ephemeral;
      }

      // Prompt for passphrase (interactive)
      const password = readlineSync.question("Enter passphrase to decrypt wallet: ", {
        hideEchoBack: true,
      });
      try {
        const secretKey = decryptPrivateKey(payload, password);
        return Keypair.fromSecretKey(secretKey);
      } catch (err) {
        throw new Error(`Failed to decrypt encrypted key: ${err}`);
      }
    }
  } catch (err) {
    // continue to final error
  }

  throw new Error("No private key found in env (set PRIVATE_KEY_JSON or PRIVATE_KEY_BASE58) and no encrypted key file found at ./secrets/encrypted_key.json");
}
