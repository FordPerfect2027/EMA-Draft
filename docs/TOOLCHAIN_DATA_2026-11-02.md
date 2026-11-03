# Preserve empty data in the development toolchain

The previous Hardhat helper decoded RPC data `0x` as one zero byte. It must
remain an empty byte array, distinct from `0x00`. This changes local development
tooling, not the Solidity contract or deployed tokens.

Hardhat 3.21.2 and its compatible keystore/test-runner/viem plugins are pinned.
The lock and overrides select hardhat-utils 5.1.1 and hardhat-zod-utils 3.0.8:
upgrading Hardhat alone retained the old decoder in the first attempted lock.
Undici 6.29.1 and 7.30.1 are constrained to their respective major ranges.
The runtime dependencies, Solidity source and solc 0.8.34 remain unchanged.

`npm run test:toolchain` resolves the decoder used by Hardhat itself, checks
empty versus zero bytes and rejects malformed data. It runs in `npm run check`.
This pure test reads no wallet, imports no Hardhat configuration and makes no RPC.
The contract/history suites separately use synthetic local EVM fixtures.

Upstream context: [fix #8765](https://github.com/NomicFoundation/hardhat/pull/8765)
and [lockfile follow-up #8790](https://github.com/NomicFoundation/hardhat/issues/8790).
The first attempted upgrade failed the regression; the corrected lock passed.

This does not remediate the separate Zod advisory GHSA-mrhx-c7xc-m3w5.
Zod remains 3.25.76; the incompatible forced major upgrade is not applied.
Local validation does not establish user-wallet switching, independent review,
public CI success or release approval.
