import { PublicKey } from "@solana/web3.js";

// Mints de tokens mais líquidos e lucrativos para arbitragem.
// Lista estática recomendada para começar.

export const TOKENS = {
  SOL: new PublicKey("So11111111111111111111111111111111111111112"),
  USDC: new PublicKey("EPjFWdd5AufqSSqeM2qjD7Z5iC5kS7FJ1B4K8Brq2Hf"),
  USDT: new PublicKey("Es9vMFrzaCERw3R1tNqjWsyT1mvQzAuiGq4sP3A1S8De"),
  mSOL: new PublicKey("mSoLzYCxHdYhvE1qfN1GbYqKqRR3YKHyCuXK5b8B9qEP"),
  jitoSOL: new PublicKey("JitoSoLzqxvFv9xpwhz1n1fHsQ3htn7J9w1Xv1w3YQM"),
  stSOL: new PublicKey("7dHbWXgF6YdcKj8nKd6oVVUjH9tdFUMtqZ7i7u5m6R3L"),
  RAY: new PublicKey("4k3Dyjzvzp8eCQ2K8pY3kMqxe9mn3Bcgp9BJxJ2dhEGR"),
  ORCA: new PublicKey("orcaEKTdK7RKxJ2qfG9bWxjFhwE1LY5L75tNeDQvC7Y"),
  JUP: new PublicKey("JUP4Fb2cqiRUcaTHdrPC8hH8J7WjJQacinD8LkPduJD"),
  PYTH: new PublicKey("FsM9F76Ycqxbkxs7ZxKDgjZwMAMzCw39vGZ7pS8h8BB8"),
  BONK: new PublicKey("DezXAZ8z7PnrnYRxH9C8dHqYHhA5G7bGor3C5t5wWfSh"),
  WEN: new PublicKey("WenWenWenWenWenWenWenWenWenWenWenWenWencs"),
  DUST: new PublicKey("DUSTawucrTsGU8hcqRdHDCMLAQ4qQiuQkqU7gYGX5w7"),
};

// Lista estática de pares lucrativos sugeridos
export function getStaticPairs() {
  const t = TOKENS;
  return [
    { a: t.SOL, b: t.USDC },
    { a: t.SOL, b: t.USDT },
    { a: t.SOL, b: t.mSOL },
    { a: t.SOL, b: t.jitoSOL },
    { a: t.SOL, b: t.stSOL },

    { a: t.USDC, b: t.USDT },
    { a: t.USDC, b: t.PYTH },
    { a: t.USDC, b: t.RAY },
    { a: t.USDC, b: t.ORCA },
    { a: t.USDC, b: t.JUP },
    { a: t.USDC, b: t.BONK },

    { a: t.SOL, b: t.RAY },
    { a: t.SOL, b: t.ORCA },
    { a: t.SOL, b: t.JUP },
    { a: t.SOL, b: t.PYTH },
    { a: t.SOL, b: t.BONK },
    { a: t.SOL, b: t.WEN },
  ];
}
