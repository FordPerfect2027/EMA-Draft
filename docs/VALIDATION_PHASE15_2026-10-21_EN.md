# EMA-Draft — Phase 15 browser validation

Date: October 21, 2026 (JST)

This repository pins the validated Wallet revision `a25779e361c58d38f2494d7b42f6812bd8755e40`. Its token contracts, deployment settings, supply, history implementation and 46-case integration suite are unchanged.

The Wallet browser harness previously allowed uncaught page exceptions and unhandled Promise rejections to coexist with a successful test result. Two deliberate fault controls reproduced that gap before correction. The corrected harness requires those faults to produce an overall failed page status, even when all 27 UI assertions pass. An unrelated crash, timeout or failed assertion cannot satisfy a control.

Wallet candidate validation passed 402 offline cases, 2 HTTP checks, both error-detection controls and three consecutive normal browser runs in fresh Chrome profiles. Each normal run passes the same 27 cases; repeated executions are not new independent tests. All three tokens passed 46 integration cases each on simulated chain IDs 8453 and 84532, with no remote fork.

This token's main CI retains compilation, project tests, type checking and the 46-case integration suite. The Wallet matrix also runs each token's 120 read-only checks and 10 history checks. Repeated runs and overlapping runners must not be summed. Final main results are available in Actions.

The Phase 14 Chrome timeout was not reproduced; its root cause remains undetermined. This phase improves test error detection and does not establish that the earlier timeout is fixed. The official Aerodrome probe was not rerun, and its EIP-6963-only connection limitation remains unresolved. Real extension compatibility, WalletConnect, completed signed login and an independent audit remain unverified.

No real-wallet signing, trading, transfers, approvals, liquidity additions, production deployments or game development were performed. Existing EVM fixtures use simulated state only.

[Full English investigation and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/a25779e361c58d38f2494d7b42f6812bd8755e40/docs/VALIDATION_PHASE15_2026-10-21_EN.md)
