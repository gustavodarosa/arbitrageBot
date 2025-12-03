import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const TX_LOG = path.join(LOG_DIR, "transactions.log");

export function logTx(record: any) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record });
  fs.appendFileSync(TX_LOG, line + "\n");
}

export function readRecent(n = 200) {
  try {
    const data = fs.readFileSync(TX_LOG, "utf8");
    const lines = data.trim().split("\n").filter(Boolean).slice(-n);
    return lines.map(l => JSON.parse(l));
  } catch (err) {
    return [];
  }
}
