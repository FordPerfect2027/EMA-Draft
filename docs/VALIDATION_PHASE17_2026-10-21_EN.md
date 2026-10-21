# EMA-Draft — Phase 17 multiple-wallet connection validation

Date: October 21, 2026 (JST)

This repository pins Wallet revision `b722a49f204f0defa8827ba0967b3bd19ce203dc`. Token contracts, deployment settings, supply, history implementation and the 46-case integration suite are unchanged.

The isolated Aerodrome connector-list experiment was expanded to six conditions: official legacy and EIP-6963-only baselines, an experimental single-provider case, two providers with repeated announcements, delayed availability, and two providers with identical names. Experimental distinct-name and delayed cases connect the intended keyless mock, reject signing, revoke access and reconnect. The unselected provider retains no permission and receives only an account-discovery read.

When two identical mock names are visible, our diagnostic refuses to choose and sends neither provider a permission or signing request. This is a diagnostic safeguard, not a completed fix for the external dApp's ambiguous UI. Removing list truncation alone is not presented as a complete production solution. Official Aerodrome EIP-6963-only connection remains unsuccessful in the tested unmodified desktop build.

Two diagnostic defects were reproduced and corrected: concurrent asset responses could both enter replacement verification, and an ambiguous but rendered chooser was mislabeled as not loaded. The replacement is now claimed before asynchronous work; reports distinguish UI readiness from unambiguous selection. Unknown assets, mixed provider state and missing scenario evidence fail validation.

Final Wallet candidate CI passed 428 offline tests, 2 HTTP checks, both deliberate browser-error controls, 27 UI cases in each of 3 consecutive fresh Chrome profiles, and all 6 external diagnostic conditions with their explicitly different outcomes. The three tokens passed 46 local-EVM integration cases each (138 total), plus 120 read-only and 10 history checks per token in the Wallet matrix. Repeated and overlapping runners must not be summed. A green diagnostic does not mean every connection succeeded.

This token's main CI retains compilation, project tests, type checking and integration against the pinned Wallet on simulated chain IDs 8453 and 84532, without a remote fork. Final publication results are available in Actions. The production Wallet session connector and token behavior are unchanged.

Official EIP-6963-only connection and production same-name disambiguation remain unresolved. Real extensions, mobile, WalletConnect, signed login and an independent security audit remain unverified. The previous Chrome timeout remains unexplained. Original mock lineage: 4848c39b60bac2c63fc38f685cdef12cd96290a8.

No real-wallet signing, trading, transfers, approvals, liquidity additions, production deployments, game development or upstream communications were performed. Existing EVM fixtures use simulated state only.

[Full English report, six-condition comparison and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/b722a49f204f0defa8827ba0967b3bd19ce203dc/docs/VALIDATION_PHASE17_2026-10-21_EN.md)
