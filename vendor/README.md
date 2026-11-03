# Private Zod 4 compatibility repair

helper.tgz is a private ThreeCore migration of Nomic Foundation's MIT-licensed
hardhat-zod-utils 3.0.8. Its version is 3.0.8-threecore-zod4.1; it is not an
upstream release. The archive retains TypeScript source, generated declarations
and JavaScript, the license, and build configuration. helper-migration.patch
records the source delta.

Archive SHA-256: 1013b53b9eb2c2cdead0e16a0be8a9e5397db31e38a446f4d67b4483e5e9abf1.
Zod is pinned to 4.6.6. Hardhat 3.21.2, solc 0.8.34, OpenZeppelin 5.6.1 and
viem 2.56.6 retain their existing versions. No lifecycle install scripts are added.

## Recorded validation and scope

The applied repair passed clean installation, compilation, TypeScript checks,
dependency-graph inspection and complete artifact-byte comparisons. The
November 3 local simulator follow-up also passed the existing DAT 37 / EMA 39 /
CAWELON 39 contract-suite cases and ten history cases per token. Those cases use
disposable simulator accounts; they do not use a user wallet or public-chain
transaction. The earlier statement that these suites had not been rerun is
superseded by that follow-up.

The toolchain command now includes six grouped tests of Hardhat's actual pure
network/compiler validators, alongside the eight existing toolchain/helper
tests. The new fixtures cover record values, strict fork activations, nested
error paths, incompatible fields, compiler profiles and source-path variants.
They do not load the project's config, resolve configuration variables, create
a provider, or access a keystore. These tests intentionally depend on Hardhat
3.21.2's internal validator paths: a version change must review those imports.

## Maintenance procedure

- Keep the archive, patch, license, exact dependency pins and lockfile together.
  Verify the archive hash before a fresh install. Never silently substitute an
  upstream package or a different local archive.
- Before any reinstall, inspect node_modules with lstat and realpath. Each
  project must have its own directory; do not reinstall through a shared junction.
- After any helper, Zod, Hardhat or plugin change, run test:toolchain, compile,
  typecheck and the affected read-only suites. Run contract/history regression
  only in the disposable, non-forked local EVM; keep real-wallet keys unavailable.
- Compare complete creation/runtime bytecode and ABI with the preserved baseline.
  A change requires investigation and a new source map; a passing test count
  cannot authorize deployment or replace the comparison.
- Before an upstream replacement, compare its source/API and repeat these checks
  in an independent directory. Commit the replacement and lockfile together.
- Record source pins, results and unresolved findings in the consolidated Wallet
  review. Codex performs the requested developer technical review. This is not
  independent third-party approval; no named external reviewer is presumed.

This repair remains local pending the requested consolidated publication. Dated
audit results are historical observations, not a guarantee against future
advisories. Unbounded schemas are not made universally bounded by this update.
