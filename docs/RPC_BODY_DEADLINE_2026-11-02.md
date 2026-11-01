# Read-only response-body deadline — November 2, 2026

The five operational read-only commands set a 12-second HTTP timeout, but the
installed viem 2.56.6 timeout stopped after response headers arrived. A small,
unfinished JSON response could therefore keep a command waiting past that limit.
This is separate from viem's existing 10 MiB response-size limit.

The shared `src/read-only-http.js` transport now keeps a per-request deadline
through body consumption. It cancels the native fetch on expiry and preserves
caller cancellation. A caller-provided signal cannot disable the deadline.
The response is buffered up to the same 10 MiB cap before normal JSON-RPC
decoding. Declared and streamed oversize responses are cancelled before parsing.
Normal status codes, JSON-RPC errors and split UTF-8 content are preserved.
There is no automatic retry, weaker block fallback or additional RPC method.

The affected commands are `verify-base-mainnet.js`,
`inspect-wallet-readiness.js`, `quote-dex.js`, `inspect-transfers.js` and
`inspect-approvals.js`. Twelve seconds is the limit for each network request,
not a promise that a multi-request command or process startup finishes in that
time. Solidity, deployment code, dependency versions and lockfiles are unchanged.
The older deployment-artifact verifier `verify-base-sepolia.js` is outside this
five-command correction; its existing transport is unchanged.

## Reproduce

```text
node --test --test-reporter=tap --test-concurrency=2 test/*.test.mjs
```

The new command tests run real child processes and viem HTTP requests against
test-owned loopback servers. They leave tiny response bodies unfinished, wait
for the actual 12-second limit, and require unsuccessful exit with no report,
no retry and no provider text in diagnostics. Startup time is measured separately
from response-body waiting. The eight transport cases cover body cancellation,
fresh deadlines, caller signals, UTF-8, response limits and HTTP RPC errors.
The five command cases plus their parent group and eight transport cases produce
14 TAP entries; the parent group is not another feature or command.

A DAT source export from `6c455914df26d52de75bd2c6d3ae0aefb1215d29` failed all
five corrected command checks and needed the test-owned 15-second body watchdog.
The unchanged old dependencies were reused through a junction. The corrected
DAT transport passed those checks, with process exit about 11.6–11.8 seconds
after the server began its body (the request deadline starts slightly earlier).
Both before/after outputs are retained in the combined Wallet evidence record.

An initial harness used a 17-second process-wide watchdog. Starting five children
concurrently could consume that budget before the request deadline, so that
initial run cannot establish a response-body regression. Its failure log is
retained. The corrected harness starts its 15-second body watchdog only when
the server receives the request and separately bounds process startup.

This verification does not connect to a real wallet or a public RPC, sign, send
transactions, build contracts, resolve the open Zod advisory, or certify a release.

## Full local regression

All 227 TAP entries passed on Node 24.19.0 using the existing dependency
installation. The three repositories were checked sequentially, with one test
file active per repository. The 213 existing entries overlap earlier checkpoints;
the 14 new entries include one parent grouping. Contract/build and browser suites
were not rerun because their sources and dependencies did not change.

The first simultaneous full runs reported watchdog failures (DAT 1, EMA 4,
CAWELON 4). The same source passed the complete sequential reruns. These were
existing child-process startup deadlines under combined load, including an input
refusal that makes no RPC request. Assertions and those old watchdogs were not
relaxed. Both initial and final logs remain in the combined evidence collection.
