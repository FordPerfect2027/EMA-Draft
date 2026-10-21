# EMA-Draft — Phase 16 Aerodrome connection investigation

Date: October 21, 2026 (JST)

This repository pins Wallet revision `4634fec948edeb2cacbcb601ae23712a30852e35`. Token contracts, deployment settings, supply, history implementation and the 46-case integration suite are unchanged.

Fresh official Aerodrome desktop checks reproduce the EIP-6963-only limitation: the mock is discovered but is absent from the four-option chooser, and no account permission request reaches it after selection, rediscovery and another selection. The legacy Browser Wallet mock route still grants synthetic account access and correctly rejects signing.

A separate counterfactual replaces one version-pinned JavaScript response only inside a disposable browser. Removing the connector-list truncation exposes the fifth option, the explicitly named synthetic wallet. EIP-6963-only selection then grants mock account access, rejects the signature request with code 4001, and supports revocation and explicit reconnection without window.ethereum. This strongly supports the chooser truncation as the blocker in that build. It does not modify the official site or establish official EIP-6963-only compatibility.

The diagnostic now selects an announced mock by its exact name, refuses ambiguous labels, verifies the original asset hash and single replacement, and labels experimental results separately from unmodified official observations. Unknown builds and incomplete experiments cannot pass. The mock has no keys and rejects every signing or transaction request.

Wallet candidate CI passed 414 offline tests, 2 HTTP checks, both deliberate browser-error controls, and 27 UI cases in each of 3 consecutive fresh Chrome profiles. All three tokens passed 46 local-EVM integration cases each (138 total) on simulated chain IDs 8453 and 84532 with no remote fork. The Wallet matrix also passed 120 read-only and 10 history checks per token. Repeated and overlapping runners must not be summed.

This token's main CI retains compilation, project tests, type checking and integration against the pinned Wallet. Final main results are available in Actions. The production Wallet session connector and token behavior are unchanged.

Unmodified official Aerodrome EIP-6963-only connection remains unresolved. Mobile, real extensions, WalletConnect, authenticated signed login and an independent audit remain unverified. The earlier Chrome timeout remains unexplained. The original Aerodrome mock lineage at 4848c39b60bac2c63fc38f685cdef12cd96290a8 is retained.

No real-wallet signing, trading, transfers, token approvals, liquidity additions, production deployments, game development or upstream communications were performed. Existing EVM fixtures use simulated state only.

[Full English report, controlled comparison and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/4634fec948edeb2cacbcb601ae23712a30852e35/docs/VALIDATION_PHASE16_2026-10-21_EN.md)
