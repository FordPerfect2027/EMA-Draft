# Token–Wallet integration — 2026-10-21

The current EMA-Draft contract was compiled and exercised against ThreeCore-Wallet `fcd36d2523da089563d129278e6a8a89e2b1b604` on an in-process Hardhat EVM. No real wallet, remote fork or live-chain write was used.

## Results

- Existing `npm run check`: compilation, 104 Hardhat tests, TypeScript checking and 65 read-only tests passed. The 65 read-only cases also run under Hardhat; do not sum these as unique tests.
- New integration: **18 passed**, zero failures or skipped tests (nine cases on each simulated chain ID, 8453 and 84532).
- Verified identity, exact raw balances, native balance, finite and maximum uint256 allowances, local delegated-spend/burn/revocation results, missing bytecode, wrong-chain rejection and empty-account isolation.
- The Wallet bridge rejects non-read methods and unexpected calldata. Composite preflight assertions confirm that reads leave block height, holder transaction count, supply, balance, allowance and permit nonce unchanged.

Only the local EVM executes fixture deployment, approvals, transfers and burns. The Wallet itself reads these results. Production Solidity and deployment records were not changed in this phase.

## Reproduce

From this token checkout with Node 22 or later:

```sh
npm ci
npm run check
node --test ../ThreeCore-Wallet/integration/token-compatibility.test.mjs
```

Use the pinned Wallet revision above and adjust its path to your checkout. CI checks that exact Wallet revision out under `.wallet-integration` and runs the same suite after the existing checks. Wallet CI also tests current Wallet changes against pinned token baselines.

## Limits

These are local EVM integration results, not Base Mainnet/Base Sepolia deployments or completed Aerodrome sign-in. The earlier official Aerodrome synthetic-wallet probe is inherited and was not rerun. External dApp acceptance, real-wallet connection completion and independent contract security audit remain unverified. Browser-provider preflight reads use `latest` and may span blocks. No production signing, trading, transfer, approval or LP addition was performed.

See the [shared Wallet phase 3 report](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/fcd36d2523da089563d129278e6a8a89e2b1b604/docs/VALIDATION_PHASE3_2026-10-21.md) for case details and the reconnect safety correction.
