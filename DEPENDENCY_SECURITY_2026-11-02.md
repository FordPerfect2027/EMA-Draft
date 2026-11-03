# Dependency security update — November 2, 2026

Pinned transitive development dependencies to follow-redirects 1.16.2 and undici
6.29.1. This retains the compiler, Hardhat, OpenZeppelin and contract source
versions. The package lock changes only those two package entries.

- [follow-redirects advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
- [undici advisory](https://github.com/advisories/GHSA-2m5v-pch6-74hx)

All three token projects have the same dependency graph. A fresh installation
with lifecycle scripts disabled passed compilation, 163 contract cases,
type checking, 124 read-only cases, 10 local-EVM history cases, and 50 Wallet
compatibility cases for this token. No user wallet or public transaction was used.
The ABI and creation/runtime bytecode are unchanged. The artifact buildInfoId
changed, so the complete artifact JSON is not byte-identical.

The November 2 npm audit changed from eight to six high-severity package entries.
The remaining entries trace to [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
Hardhat requires Zod 3.x; the advisory names a 4.6.6 fix. No untested major-version
override, toolchain downgrade or automatic audit fix was applied. This finding
remains open for compatible remediation and scope review; do not report a clean
development-dependency audit. The production-only audit reports zero known
findings, which does not certify contract safety or replace independent review.

Source changes and validation records are retained locally for the requested
combined publication. Re-check advisories before publication.
