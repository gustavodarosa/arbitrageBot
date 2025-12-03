/**
 * Wrapper light para usar @jup-ag/api (Jupiter v6 Swap API) como "drop-in"
 * para o código que antes usava @jup-ag/core.
 *
 * Exports:
 *  - makeJupiter(connection?) -> retorna um objeto com computeRoutes(opts)
 *
 * computeRoutes(opts) -> { routes: Array<...> }
 *
 * O wrapper faz:
 *  - chama o endpoint Quote (GET /quote ou método client.quote.getQuote)
 *  - mapea o response para uma shape similar à usada no scanner/executor
 *
 * Config via env:
 *  JUPITER_API_URL (opcional) -> base path do serviço Jupiter (ex: https://quote-api.jup.ag)
 *
 * Nota: o cliente oficial tem tipos gerados; aqui fazemos um mapeamento defensivo.
 */

import { createJupiterApiClient, QuoteGetRequest } from "@jup-ag/api";
import type { PublicKey } from "@solana/web3.js";

// small helper for fetch with timeout and retries
async function fetchWithRetries(url: string, init: any = {}, retries = 3, timeoutMs = 8000) {
  const { AbortController } = require("abort-controller");
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries - 1) throw err;
      // small backoff
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

export type ComputeRoutesOpts = {
  inputMint: PublicKey | string;
  outputMint: PublicKey | string;
  amount: number | string; // smallest units (integer) expected by Jupiter API
  slippageBps?: number; // bps (e.g., 50 = 0.5%)
};

export type RouteInfo = {
  outAmount: number | string;
  inAmount?: number | string;
  priceImpactPct?: number;
  marketInfos?: Array<{ label?: string; id?: string }>;
  _raw?: any;
};

export function makeJupiter(/* connection optional, kept for compat */) {
  const basePath = process.env.JUPITER_API_URL || "https://quote-api.jup.ag";
  const client = createJupiterApiClient({ basePath });

  async function computeRoutes(opts: ComputeRoutesOpts): Promise<{ routes: RouteInfo[] }> {
    const req: QuoteGetRequest = {
      inputMint: typeof opts.inputMint === "string" ? opts.inputMint : (opts.inputMint as PublicKey).toBase58(),
      outputMint: typeof opts.outputMint === "string" ? opts.outputMint : (opts.outputMint as PublicKey).toBase58(),
      amount: typeof opts.amount === "number" ? Math.floor(opts.amount) : Number(String(opts.amount)),
      slippageBps: opts.slippageBps ?? 50,
    };

    try {
      // prefer client helper if present
      let res: any;
      if ((client as any).quote && typeof (client as any).quote.getQuote === "function") {
        res = await (client as any).quote.getQuote(req as any);
      } else {
        // fallback to REST /quote endpoint
        const qs = new URLSearchParams({
          inputMint: req.inputMint as string,
          outputMint: req.outputMint as string,
          amount: String(req.amount),
          slippageBps: String(req.slippageBps || 50),
        });
        const url = `${basePath}/quote?${qs.toString()}`;
        const r = await fetchWithRetries(url, { headers: { Accept: "application/json" } }, 3, 8000);
        if (!r) throw new Error("Empty response from Jupiter quote endpoint");
        res = await r.json();
      }

      const routes = (res?.routes || []).map((r: any) => {
        const marketInfos = (r?.marketInfos || []).map((m: any) => ({
          label: m?.label ?? m?.id ?? undefined,
          id: m?.id ?? undefined,
        }));

        const outAmount = r?.outAmount ?? r?.outputAmount ?? r?.amountOut ?? "0";
        const inAmount = r?.inAmount ?? r?.inputAmount ?? r?.amountIn ?? "0";
        const priceImpactPct = typeof r?.priceImpactPct === "number" ? r.priceImpactPct : Number(r?.priceImpact ?? r?.priceImpactPct ?? 0);

        return {
          outAmount,
          inAmount,
          priceImpactPct,
          marketInfos,
          _raw: r,
        } as RouteInfo;
      });

      return { routes };
    } catch (err: any) {
      const message = err?.response ? `Jupiter API error: ${JSON.stringify(err.response)}` : String(err);
      throw new Error(`computeRoutes failed: ${message}`);
    }
  }

  async function createSwap(opts: {
    inputMint: string | PublicKey;
    outputMint: string | PublicKey;
    amount: number | string;
    slippageBps?: number;
    userPublicKey?: string;
    wrapUnwrapSOL?: boolean;
  }) {
    const body = {
      inputMint: typeof opts.inputMint === "string" ? opts.inputMint : (opts.inputMint as PublicKey).toBase58(),
      outputMint: typeof opts.outputMint === "string" ? opts.outputMint : (opts.outputMint as PublicKey).toBase58(),
      amount: typeof opts.amount === "number" ? Math.floor(opts.amount) : Number(String(opts.amount)),
      slippageBps: opts.slippageBps ?? 50,
      userPublicKey: opts.userPublicKey,
      wrapUnwrapSOL: opts.wrapUnwrapSOL ?? true,
    };

    const url = `${basePath}/swap`;
    const r = await fetchWithRetries(url, {
      method: "POST",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }, 3, 10000);
    if (!r) throw new Error("Empty response from Jupiter swap endpoint");
    return await r.json();
  }

  return {
    computeRoutes,
    createSwap,
    rawClient: client,
    basePath,
  };
}

export default makeJupiter;
