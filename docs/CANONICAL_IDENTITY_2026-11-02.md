# Canonical token identity reads — November 2, 2026

The Base Mainnet identity CLI previously selected a block number. Different
responses at that height could describe different blocks during a chain
reorganization. It also printed raw transport errors, which can contain an
authenticated provider URL or provider response data.

The verifier now captures a numbered block and its hash, then sends every
contract-code and metadata read with the same EIP-1898 selector:

```json
{"blockHash":"<captured hash>","requireCanonical":true}
```

It rechecks the header at that height and the network before returning. A
missing or changed block, wrong network, invalid response, or unsupported hash
selector fails the check. There is no fallback to a block number or latest.
The expected token specification is copied before any asynchronous read.
Runtime code is limited to 256 KiB and each ABI response to 4 KiB after transport
decoding. The CLI uses a 12-second per-request timeout and no transport retries.
Failures print a stable error code, not the provider's raw error message.

The library now requires a read-only public client with a JSON-RPC request
method. The CLI's viem public client supplies this method. Allowed requests are
eth_chainId, eth_getBlockByNumber, eth_getCode, and four eth_call selectors for
name, symbol, decimals and totalSupply. It does not load a wallet or Hardhat
configuration. The published token address, issuance reference, Solidity,
deployment configuration and dependency lockfile are unchanged.

## Validation

- Full read-only suite: 159 passed, zero failed. This includes 42 identity
  unit cases and three actual CLI/viem HTTP cases against an isolated mock RPC.
  Those subsets overlap the 159; they are not extra product features.
- CLI transport tests cover exact hash parameters, successful JSON output,
  reorganization failure, unsupported-hash failure without weaker retries,
  and omission of dummy credential/response strings from stderr.
- Live read-only command: exit 0, no stderr, 2026-11-01T21:17:02.262Z.
  Endpoint: https://mainnet.base.org. Chain: 8453.
  Block: 53389236.
  Hash: 0x3f2d71c8fa099cb337e1248aa065f5f2256500814719dbf9588e109e37971cf7.
  Token: EMA CORE (EMA), 18 decimals.
  totalSupply base units: 777000000000000000000000000.
  Runtime bytecode keccak256: 0x2e973da5cac7a7236f02f0f9765bfc055c0cfd3725a2ee21c402cf722319ef39.

Run npm run test:read-only for the offline regression, or
npm run verify:base-mainnet for a new public observation. A later command can
observe a different block. No public transaction or signing request is made.

## Limits

Canonicality is requested from and rechecked against one provider. This is
not independent consensus verification, a finality guarantee, proof of the
provider's honesty, an audited contract-code match, or real-wallet UI acceptance.
The runtime hash fingerprints observed code; this check does not compare it
with an independently verified deployed build. The live report confirms only
the configured token identity and issuance ceiling at its recorded block.
Previously recorded full contract/type/Wallet compatibility tests belong to
their original commits. They are not represented as freshly rerun here because
the contract and Wallet adapter were not changed. The separate open Zod
development-dependency advisory is not resolved by this correction.

Protocol reference: https://eips.ethereum.org/EIPS/eip-1898
