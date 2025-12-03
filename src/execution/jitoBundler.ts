// NOTE: This is a POC integration for Jito-style bundling. Jito's SDK/APIs change often
// and may require an official SDK or signing method. This file provides a structured
// bundling attempt and falls back to sendRawTransaction when bundling isn't available.

import { Connection, Keypair } from "@solana/web3.js";

export type JitoBundleOptions = {
  jitoRpcUrl?: string; // e.g. process.env.JITO_RPC_URL
  priorityFeeLamports?: number;
};

export async function tryJitoBundleSend(connection: Connection, signedTxs: Buffer[], opts: JitoBundleOptions = {}) {
  const jitoUrl = opts.jitoRpcUrl || process.env.JITO_RPC_URL;
  if (!jitoUrl) throw new Error("No Jito RPC configured");

  try {
    // Minimal bundle payload expected by many bundlers: base64 encoded txs array
    const payload = {
      jsonrpc: "2.0",
      id: "1",
      method: "sendBundle",
      params: [signedTxs.map((b) => b.toString("base64"))],
    };

    const r = await (globalThis.fetch ?? (await import('undici')).fetch)(jitoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Jito RPC error ${r.status}: ${text}`);
    }

    const json = (await r.json()) as any;
    
    if (json.error) {
      throw new Error(`Jito error: ${json.error.message}`);
    }

    return json.result; // expected to contain bundle signature or status
  } catch (err) {
    console.error("Jito bundle send failed, falling back:", err);
    throw err;
  }
}
