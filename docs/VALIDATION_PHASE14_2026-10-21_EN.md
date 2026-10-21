# EMA-Draft — Phase 14 Wallet error recovery validation

Date: October 21, 2026 (JST)

The CI Wallet suite is pinned to `6ad394223f24b3e0a299a5ceca05fe9a2acbe825`. This phase changes the integration pin and documentation; the token contract, supply, deployment settings and history implementation are unchanged.

ThreeCore now safely handles malformed provider rejections, including null/undefined values, throwing properties and revoked proxies. Connection failures release the UI for explicit reconnection. Non-terminal read failures clear old results and allow another read. Readable numeric authorization/disconnection codes still invalidate the session. Cleanup accessor failures cannot retain local access or a connected view.

The new 25-case Wallet boundary suite reproduced 17 failures before the fix and passes all 25 afterwards. Wallet validation passes 402 offline cases, 2 HTTP checks and 27 synthetic Chrome UI cases. Corrected candidate CI passed before Wallet main publication.

This token's integration suite now has 46 cases: 23 on each simulated chain ID (8453 and 84532), without a remote fork. The new case reads an actual local token, injects a null rejection during a subsequent token read, checks that the previous balance disappears, and retries successfully. It verifies unchanged block height, account transaction count, supply, token balance, allowance and permit nonce, with only one explicit permission request.

Compilation, the project test runner and type checking remain enabled in main CI. Repeated CI/local executions and overlapping runners are not independent tests. Final main results are available in this repository's Actions history.

The official Aerodrome probe was not rerun. Its previously observed EIP-6963-only connection limitation remains unresolved. Real extension compatibility, completed external-site signed login and independent audit remain unverified. Error handling cannot sandbox arbitrary same-page JavaScript or interrupt a non-returning synchronous getter.

No real-wallet signing, trading, transfers, approvals, liquidity additions, production deployments or game development were performed. Existing in-process EVM fixtures use simulated state only.

[Full English investigation and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/6ad394223f24b3e0a299a5ceca05fe9a2acbe825/docs/VALIDATION_PHASE14_2026-10-21_EN.md)
