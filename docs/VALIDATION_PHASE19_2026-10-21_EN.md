# EMA-Draft — Phase 19 wallet addition, removal and reconnection validation

Date: October 21, 2026 (JST)

This repository pins Wallet revision `9073b55e63425c29dc4dce02898ed9584cc2e6a7`. Token contracts, deployment settings, supply, history implementation and the 46-case integration suite are unchanged.

The isolated Aerodrome chooser proposal now rejects stale callbacks after removal, late connection results and two active connector identities resolving to the same provider. Removing and restoring the same connector preserves its display number but requires a fresh selection. Unchanged choices remain stable through addition and reordering.

The browser experiment discovered that adding a third mock can cause a removed provider to return from the framework's discovery cache under a new UID. Restoring its old connector then creates two choices for one provider. A fresh attempt is now refused without granting access. After explicit fixture cleanup, selecting the original mock reconnects only that mock; selecting the added mock grants only its synthetic account. Signing is rejected, and all three mocks finish revoked. Same-name and empty/whitespace-name conditions both pass.

Ten external diagnostic conditions comprise eight retained baselines and two lifecycle conditions with fifteen checkpoints each. The official unmodified EIP-6963-only page still does not connect the mock. A green diagnostic records its expected outcome, including unsuccessful official connection and refusal of ambiguity. No Aerodrome deployment was changed.

The final Wallet candidate passed 467 offline tests (19 new), 2 HTTP checks, both deliberate browser-error controls and the same 27 UI cases in each of 3 consecutive fresh Chrome profiles. Each token passed 46 simulated-EVM integration checks (138 total), plus 120 read-only and 10 history checks in the Wallet matrix. Repeated or overlapping executions must not be summed.

This token's main CI retains compilation, project tests, type checking and the newly pinned Wallet integration on simulated chain IDs 8453 and 84532 without a remote fork. Final publication results are available in Actions. The production Wallet session connector is unchanged.

Removal/restoration and duplicate cleanup are explicit fixture operations on the pinned framework's list, not extension uninstall or a production recovery UI. Choice numbers do not authenticate wallet publishers. Deleting a list choice does not revoke permissions; rejecting a late result cannot cancel an already dispatched permission request. Real-wallet prompts and associated framework events remain unverified.

Official EIP-6963-only connection, a deployed recovery UI, real extensions/uninstall, mobile, WalletConnect, publisher authentication, signed login, arbitrary malicious metadata/icons and an independent security audit remain unresolved or unverified. The earlier Phase 14 Chrome timeout remains unexplained. Original mock lineage: 4848c39b60bac2c63fc38f685cdef12cd96290a8.

No real-wallet signing, trading, transfers, token approvals, liquidity additions, production deployments, upstream communication or game development were performed. Existing EVM fixtures use simulated state only.

[Full English report, failed-candidate history and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/9073b55e63425c29dc4dce02898ed9584cc2e6a7/docs/VALIDATION_PHASE19_2026-10-21_EN.md)
