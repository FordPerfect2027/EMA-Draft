# Local Zod 4 toolchain repair — November 3, 2026

The development lock now uses Zod 4.6.6 and a private ThreeCore migration of
Nomic Foundation's MIT-licensed hardhat-zod-utils 3.0.8. This fixes structured
validation errors and type compatibility that prevented the earlier forced-major
upgrade. It is a local development change, not an official upstream release.

The source delta, archive and license are in vendor/. The archive contains the
TypeScript source, generated declarations/JavaScript and build configuration.
Its SHA-256 is 1013b53b9eb2c2cdead0e16a0be8a9e5397db31e38a446f4d67b4483e5e9abf1.
Only the helper and Zod installed-package entries change. Compiler, contracts,
Hardhat, OpenZeppelin, viem and plugin versions are unchanged.

Candidate checks include clean installation without lifecycle scripts; bounded
configuration and strict helper/type fixtures; all three token builds/type
checks with the actual project configuration; exact ABI and complete creation/
runtime-bytecode comparisons; DAT's 251 read-only cases. Applied installations
also receive the eight toolchain/migration cases, forced compilation, type check
and a dated full npm audit. Each token's application receipt is retained in the
Wallet review evidence, separate from prior candidate checks. Overlapping and
repeated cases are not summed into new feature counts.

These checks use CI mode and a filtered environment without credentials.
No user-wallet, private-key, signature or transaction operations are required.
Contract-execution and local-EVM transaction suites were not rerun for this
repair. Independent review, upkeep of this private fork and explicit release
approval remain separate. A zero dated audit is not a token-safety guarantee.
The original November 2 dependency finding remains in its historical report.
