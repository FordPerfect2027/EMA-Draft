# EMA-Draft — Phase 13 Wallet discovery validation

Date: October 21, 2026 (JST)

The CI Wallet suite is pinned to 041a0bf1749262e3987d2428793baedbaece7b35. The token contract, supply, deployment settings, and read-only/history implementation are unchanged.

ThreeCore's EIP-6963 registry now validates and retains a single snapshot of announcement metadata and its provider reference. Throwing/inaccessible properties are ignored, UUID letter-case variants keep the first provider, and reentrant disposal cannot restore entries. This preserves the selected provider without requesting accounts during discovery.

The new boundary suite reproduced 13 failures in 16 cases before correction; all 16 pass afterwards. The Wallet now passes 377 offline tests, 2 HTTP checks and 24 synthetic Chrome UI cases. Candidate CI and local EVM checks passed before Wallet main publication.

This token's Wallet integration suite expands from 42 to 44 cases: 22 on each simulated chain ID (8453 and 84532), with no remote fork. The added case combines a changing provider getter and a case-equivalent duplicate, then reads actual local token balances/allowances through the retained provider. The alternate provider receives no RPC, and inspection does not mutate EVM state.

Compilation, the token project test runner, type checking, 120 separate read-only cases and 10 history EVM cases remain enabled. Overlapping runners and repeated CI runs are not summed as independent cases. Final main results are recorded by this repository's Actions run.

The official Aerodrome probe was not rerun. Its previously observed EIP-6963-only connection limitation remains unresolved; this fix applies to ThreeCore's own discovery handling. Wallet metadata is not proof of identity, and same-page JavaScript is not sandboxed.

No real-wallet signing, trading, transfers, approvals, liquidity additions, production deployments, or game development were performed. Local-EVM fixtures remain simulated. Real extension compatibility, completed signed login and independent audit remain unverified.

[Full English investigation and evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/041a0bf1749262e3987d2428793baedbaece7b35/docs/VALIDATION_PHASE13_2026-10-21_EN.md)
