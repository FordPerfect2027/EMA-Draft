# Permit authorization validation — 2026-10-21, phase 2

Ten additional simulated-EVM tests check wrong chain, wrong verifying contract, wrong domain name/version, wrong nonce/signer, and modified owner/spender/value/deadline. Each invalid permit must revert with ERC2612InvalidSigner and preserve nonces, existing allowances, total supply and holder balance. A subsequent valid permit must still succeed.

npm run check passed, including compilation, the new Hardhat tests, TypeScript checks and the existing 65 read-only tests. Only local simulated accounts were used. No real-wallet signatures, public-chain writes, deployments, trades, transfers, approval changes or LP deposits were performed. The production Solidity source is unchanged. These tests do not establish deployed bytecode equivalence or an independent security audit.

[Shared Wallet connection fixes and detailed validation](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/main/docs/VALIDATION_PHASE2_2026-10-21.md).
