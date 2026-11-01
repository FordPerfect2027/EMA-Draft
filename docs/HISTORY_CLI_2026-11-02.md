# History command input and error handling — November 2, 2026

The Transfer and Approval command-line tools requested a public chain tip
before rejecting some invalid inputs, converted arbitrarily long decimal text
to BigInt, and printed raw provider errors. Those errors can include response
contents or an authenticated provider path. Transfer queries also inherited
the transport's automatic retry policy.

Both commands now validate a nonzero public address, argument count, decimal
block syntax, a 78-digit/uint256 ceiling, and a known explicit inclusive range
before creating a transport or requesting a chain tip. Ranges remain capped
at 2,000 blocks. Default windows remain 250 blocks; the existing library still
checks the current chain and tip and rejects future ranges. An explicit end
height no longer needs a separate preliminary tip request in the CLI.

Invalid CLI input/configuration exits with code 2 and a fixed error code plus
usage. Validation/provider failures exit with code 1. Provider messages and
user-supplied values are not echoed. Only known local error classes can supply
the displayed error code; other failures are RPC_ERROR. Both transports now
have a 12-second per-request timeout and retryCount 0. HTTPS-only endpoint
validation and the refusal of URL credentials/query values/fragments remain.

## Evidence

- Full read-only suite: 213 passed / 0 failed per token, with test concurrency
  limited to two. This includes 19 new history CLI/input cases; the previous
  194-case result overlaps and must not be added to this total.
- Real child-process CLI/viem HTTP tests decode known positive Transfer and
  Approval events, including an incoming amount of 5 base units and a recorded
  Approval of 5 distinct from a sampled allowance of 1. The test-only preload
  redirects the exact expected publicnode endpoint to an isolated loopback
  server. It rejects other destinations. No public network is used by tests.
- Empty history, the 250-block default, explicit range selection, final-block
  replacement, oversized block text, bad addresses, credential-bearing URLs,
  provider-error redaction and a single failed request without retries are
  checked through the actual commands.
- Before/after reproduction used DAT base commit
  62dee6aba8a092e179643e0e4b19d53473cd6e67. Both unchanged original CLI files
  made three mock RPC requests for an invalid 2,001-block range. The same
  assertions fail before and pass after: the corrected commands make none.
  The added parser was used by the test fixture but was not imported by the
  original commands. This baseline was exercised for DAT; the shared source
  correction and full regression were separately checked for all three tokens.

## Scope

History libraries, event validation, canonical-header checks, token addresses,
Solidity, deployments and dependency locks are unchanged. RPC event results
remain incomplete provider observations: empty history is not proof that no
transfer or approval ever occurred, and historical Approval values are not
current allowance. This change does not connect a wallet, sign, approve, trade,
send tokens or read private credentials. No new public-chain history scan is
claimed for this CLI correction. The remaining Zod development-dependency
finding and real-wallet UI acceptance are separate open items.

Reproduce offline with:

```text
node --test --test-concurrency=2 test/*.test.mjs
```

The named source and raw logs are collected with the Wallet evidence. For a
fresh public observation, the existing inspect:transfers / inspect:approvals
commands retain their documented public-address and optional range arguments.
