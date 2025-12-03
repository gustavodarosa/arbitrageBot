// Simple compatibility check for @jup-ag/core
try {
  console.log('Node version:', process.version);
  console.log('@jup-ag/core version:', require('@jup-ag/core/package.json').version);
} catch (e) {
  console.warn('Could not read @jup-ag/core version:', e.message || e);
}

(async () => {
  try {
    console.log('globalThis.fetch present:', typeof globalThis.fetch !== 'undefined');
    if (typeof globalThis.fetch === 'undefined') {
      try {
        globalThis.fetch = require('node-fetch');
        console.log('Polyfilled globalThis.fetch with node-fetch');
      } catch (e) {
        console.warn('Could not polyfill fetch:', e.message || e);
      }
    }

    const { Jupiter } = require('@jup-ag/core');
    const { Connection } = require('@solana/web3.js');

    const connection = new Connection('https://api.devnet.solana.com');
    console.log('Attempting Jupiter.load()...');
    const j = await Jupiter.load({ connection, cluster: 'devnet' });
    console.log('Jupiter.load() succeeded. computeRoutes function exists?', typeof j.computeRoutes === 'function');
  } catch (err) {
    console.error('Jupiter compatibility check failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
})();
