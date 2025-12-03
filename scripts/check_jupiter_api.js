// Simple compatibility check for @jup-ag/api (REST client)
try {
  console.log('Node version:', process.version);
} catch (e) {}

(async () => {
  try {
    const basePath = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag';
    console.log('Jupiter API basePath:', basePath);

    const { createJupiterApiClient } = require('@jup-ag/api');
    const client = createJupiterApiClient({ basePath });
    console.log('client keys:', Object.keys(client));
    // inspect nested keys shallowly
    for (const k of Object.keys(client)) {
      try {
        console.log(' -', k, 'type:', typeof client[k]);
      } catch (e) {}
    }

    // Example quote: SOL -> USDC (mainnet tokens) but endpoint works on devnet too
    const SOL = 'So11111111111111111111111111111111111111112';
    const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    const req = {
      inputMint: SOL,
      outputMint: USDC,
      amount: 10000000, // 0.01 SOL lamports
      slippageBps: 50,
    };

    console.log('Requesting quote via REST endpoint...');
    const qs = new URLSearchParams({
      inputMint: req.inputMint,
      outputMint: req.outputMint,
      amount: String(req.amount),
      slippageBps: String(req.slippageBps || 50),
    });
    const url = `${basePath}/quote?${qs.toString()}`;
    let r;
    try {
      r = await fetch(url);
    } catch (fe) {
      console.error('fetch failed:', fe && fe.stack ? fe.stack : fe);
      throw fe;
    }
    const data = await r.json();
    console.log('Quote returned routes:', Array.isArray(data?.routes) ? data.routes.length : 'no routes');
    if (data?.routes?.[0]) console.dir(data.routes[0], { depth: 2 });
  } catch (err) {
    console.error('check_jupiter_api failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
})();
