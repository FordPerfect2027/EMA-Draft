# Canonical balance and reference-quote reads — November 2, 2026

Public wallet-readiness and pool-reference-quote commands previously pinned
reads to a block number. A same-height reorganization could combine balances,
allowances, code or pool data from different blocks. Both now require one
provider-reported canonical block hash, then recheck its header and network.

The shared canonical-state-read.js helper dispatches only eth_chainId,
eth_getBlockByNumber, eth_getCode, eth_getBalance and eth_call. Every state RPC
uses an EIP-1898 blockHash / requireCanonical selector. It never retries with a
number or latest if that selector fails. ABI calls are restricted to view/pure
functions. Invalid quantities, malformed/oversized responses, changed blocks
and network changes fail without a successful report.

Public clients must expose the raw JSON-RPC request method; viem's CLI public
client does. Library callers using custom high-level-only mocks must adapt.
Readiness adds observedBlockHash; quotes add blockHash. Both add
canonicalBlockRequired and canonicalBlockRechecked. Existing balance, allowance,
pool and non-transaction fields retain their meanings. A nonzero existing
allowance is exposure, not permission granted by this command.

The CLI prints stable error codes instead of raw provider messages. Quote
integer input is bounded to 78 digits before BigInt conversion and validated
against uint256 before any network call. Code and ABI response limits apply
after transport decoding (256 KiB code, 4 KiB ABI data); these are not HTTP-body
streaming limits. Existing CLI timeouts/no-retry policy remains in place.

## Verification

- Full read-only suite: 194 passed, zero failed. The previous 159-case run is
  an earlier checkpoint and overlaps this result; do not add the totals.
- Focused state checks: 69 passed, included in that 194. This includes actual
  child-process CLI/viem HTTP tests for success, changed blocks, unsupported
  selectors and redacted provider errors. Their test-only preload redirects
  only the fixed public endpoint into an isolated loopback server. No external
  network or wallet is used by those transport tests.
- Live read-only commands: both exited 0, with no stderr:
  - readiness: block 53389553, hash 0xddafb73cd637b0ab2cd5d0f87b5b18f44c68d821330842944fc015b454330cdc.
  - quote: block 53389555, hash 0x3818c60819218f00fbd873eb6733c78470dd37a1a61b90330131d2c149fd136e.

The readiness observation used one existing public account and is retained
privately. Quotes read actual public pool state and return only an observation;
no trade was simulated or executed. Each command captures its own block, so
the two observations need not share a height. Private balance/account data is
not copied into the public evidence package.

Initial test failures are retained in the development record: ABI-decoded
addresses use checksum capitalization, and Windows Node --import requires a
file URL. The assertions and test-loader path were corrected; neither issue
was bypassed in production code. The succeeding run tests the full commands.

The Solidity, deployment files and dependency locks are unchanged. No
transaction, signature, token approval or private-key access occurs. These
provider-observed checks do not establish independent finality, a safe dApp,
an executable price, real MetaMask acceptance or a security audit. The open
Zod development-dependency finding remains separate.

Protocol reference: https://eips.ethereum.org/EIPS/eip-1898
