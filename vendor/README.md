# Local Zod 4 development candidate

helper.tgz is a private ThreeCore migration of Nomic Foundation's MIT-licensed
hardhat-zod-utils 3.0.8. It is version 3.0.8-threecore-zod4.1, not an upstream
release. The archive contains TypeScript source, regenerated declarations/JS,
license and build configuration. helper-migration.patch is the source delta.

Zod is pinned to 4.6.6. Compiler, OpenZeppelin, viem, Hardhat and other package
versions remain unchanged. The package has no lifecycle install scripts.
Archive SHA-256: 1013b53b9eb2c2cdead0e16a0be8a9e5397db31e38a446f4d67b4483e5e9abf1.

This is a review candidate. Local compilation, strict helper/type fixtures,
read-only tests and bounded schema checks passed in isolated installations.
This candidate is applied to the local development source and installed dependencies.
Previously sealed review packages and public repositories are unchanged.
Contract-execution/signing suites were not rerun for this candidate.
No user wallet, private key or public transaction is required for the recorded checks.
Independent review and an explicit release decision remain open.
