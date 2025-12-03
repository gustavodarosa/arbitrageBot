import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import readlineSync from "readline-sync";
import { encryptPrivateKey } from "../utils/secureKey";

function ensureSecretsDir(): string {
  const dir = path.join(process.cwd(), "secrets");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function main() {
  const kp = Keypair.generate();
  console.log("Generated new Keypair:");
  console.log(`  Public key: ${kp.publicKey.toBase58()}`);
  console.log("\nYou will be prompted to set a passphrase to encrypt the private key.");
  const password = readlineSync.questionNewPassword("Passphrase: ", {
    min: 6,
    confirmMessage: "Confirm passphrase: ",
  });

  const encrypted = encryptPrivateKey(kp.secretKey, password);
  const dir = ensureSecretsDir();
  const filePath = path.join(dir, "encrypted_key.json");
  fs.writeFileSync(filePath, encrypted, { encoding: "utf8", flag: "w" });
  console.log(`\nEncrypted key saved to: ${filePath}`);
  console.log("Keep your passphrase safe. Use it to start the program or to decrypt the key later.");
}

main().catch((err) => {
  console.error("Error creating encrypted key:", err);
  process.exit(1);
});
