# EMA-Draft — Phase 18 same-name and unnamed wallet-choice validation

Date: October 21, 2026 (JST)

This repository pins Wallet revision `d190a25ea3361b7e1d10bb13da09539ef792fed2`. Token contracts, deployment settings, supply, history implementation and the 46-case integration suite are unchanged.

The isolated Aerodrome proposal now distinguishes two wallets with identical names, and two with empty or whitespace names, using stable per-page choice numbers bound to framework connector instances. Each mock is selected in turn: only that mock grants account access, its signature request is rejected, and both mocks finish revoked. Repeated announcements retain the same labels. The secondary mock remains without permission until explicitly selected; the primary stays revoked during secondary interaction.

Choice numbers distinguish connector instances, not legitimate wallet publishers. Names and other discovery metadata are self-reported. The diagnostic uses known mock provider references to verify routing; that is not a user-facing authentication mechanism. Unnamed refers to blank display names, not an anonymity or privacy feature.

Eight external diagnostic conditions retain the six preceding baselines and add same-name and unnamed choice experiments. The old list-only same-name diagnostic still refuses ambiguous selection. The unmodified official EIP-6963-only page still does not connect the mock. A green diagnostic records the expected outcome and does not imply eight successful connections. No Aerodrome deployment was changed.

The tested Wallet candidate passed 448 offline tests (20 new), 2 HTTP checks, both deliberate browser-error controls, and the same 27 UI cases in each of 3 consecutive fresh Chrome profiles. Each of the three tokens passed 46 simulated-EVM integration cases (138 total), plus 120 read-only and 10 history checks per token in the Wallet matrix. Repeated and overlapping executions must not be summed.

This token's main CI retains compilation, project tests, type checks and integration against the pinned Wallet on simulated chain IDs 8453 and 84532 without a remote fork. Final publication results are available in Actions. The production Wallet session connector is unchanged.

Official EIP-6963-only connection, production chooser behavior and publisher authentication remain unresolved. Real extensions, mobile, WalletConnect, signed login, arbitrary malicious metadata/icons and an independent security audit remain unverified. The earlier Phase 14 Chrome timeout remains unexplained. Original mock lineage: 4848c39b60bac2c63fc38f685cdef12cd96290a8.

No real-wallet signing, trading, transfers, token approvals, liquidity additions, production deployments, game development or upstream communications were performed. Existing EVM fixtures use simulated state only.

[Full English report, eight-condition comparison and validation evidence](https://github.com/FordPrefect2026/ThreeCore-Wallet/blob/d190a25ea3361b7e1d10bb13da09539ef792fed2/docs/VALIDATION_PHASE18_2026-10-21_EN.md)
