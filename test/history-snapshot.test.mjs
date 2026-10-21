import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { inspectAccountTransfers } from "../src/transfer-history.js";
import { inspectApprovalHistory } from "../src/approval-history.js";

const ACCOUNT = "0x" + "11".repeat(20), SPENDER = "0x" + "22".repeat(20);
const hash = n => "0x" + BigInt(n).toString(16).padStart(64, "0");
const code = expected => error => error.code === expected;

for (const kind of ["Transfer", "Approval"]) {
  const event = (extra = {}) => ({
    address: DEPLOYED_TOKEN.contractAddress, blockNumber: 100n, blockHash: hash(100),
    transactionHash: hash(200), transactionIndex: 0, logIndex: 0, removed: false,
    args: kind === "Transfer"
      ? { from: ACCOUNT, to: ACCOUNT, value: 7n }
      : { owner: ACCOUNT, spender: SPENDER, value: 7n },
    ...extra,
  });
  function fixture({ logs = [event()], onBlock, onLogs, onAllowance, chain } = {}) {
    const calls = [];
    let headers = 0, chains = 0;
    const rpc = {
      async getChainId() { calls.push(["chain"]); return chain ? chain(++chains) : 8453; },
      async getBlockNumber(options) { calls.push(["tip", options]); return 101n; },
      async getBlock(options) {
        calls.push(["block", options]);
        return onBlock ? onBlock(options, ++headers) : { number: options.blockNumber, hash: hash(options.blockNumber) };
      },
      async getLogs(options) {
        calls.push(["logs", options]);
        return onLogs ? onLogs(options) : logs;
      },
      async readContract(options) {
        calls.push(["allowance", options]);
        return onAllowance ? onAllowance(options) : 7n;
      },
    };
    return { rpc, calls, run: (options = {}) => kind === "Transfer"
      ? inspectAccountTransfers(rpc, { accountAddress: ACCOUNT, fromBlock: 100n, ...options })
      : inspectApprovalHistory(rpc, { ownerAddress: ACCOUNT, spenderAddress: SPENDER, fromBlock: 100n, ...options }) };
  }

  test(`${kind} snapshot: records the range-end hash and checks distinct event heights once`, async () => {
    const f = fixture({ logs: [event(), event({ logIndex: 1 }), event()] });
    const report = await f.run();
    assert.equal(report.toBlockHash, hash(101));
    assert.equal(report.logBlockHashesChecked, true);
    assert.equal(report.endBlockRechecked, true);
    assert.equal(report.canonicalityVerified, false);
    assert.equal(report.historyComplete, false);
    assert.deepEqual(f.calls.filter(([m]) => m === "block").map(([, a]) => a.blockNumber), [101n, 100n, 101n]);
    assert.deepEqual(f.calls.find(([m]) => m === "tip")[1], { cacheTime: 0 });
    assert.ok(f.calls.filter(([m]) => m === "block").every(([, a]) => a.includeTransactions === false));
    if (kind === "Approval") {
      const [, args] = f.calls.find(([m]) => m === "allowance");
      assert.equal(args.blockHash, hash(101));
      assert.equal(args.requireCanonical, true);
      assert.equal(args.blockNumber, undefined);
    }
  });
  test(`${kind} snapshot: empty history still rechecks the sampled block`, async () => {
    const f = fixture({ logs: [] });
    await f.run();
    assert.deepEqual(f.calls.filter(([m]) => m === "block").map(([, a]) => a.blockNumber), [101n, 101n]);
  });
  test(`${kind} snapshot: empty history cannot hide an end-block replacement`, async () => {
    const f = fixture({ logs: [], onBlock: (args, n) => ({ number: args.blockNumber, hash: hash(n === 1 ? 101 : 999) }) });
    await assert.rejects(f.run(), code("BLOCK_CHANGED"));
  });
  test(`${kind} snapshot: rejects a changed end block after successful log validation`, async () => {
    const f = fixture({ onBlock: (args, n) => ({
      number: args.blockNumber, hash: hash(n === 3 ? 999 : args.blockNumber),
    }) });
    await assert.rejects(f.run(), code("BLOCK_CHANGED"));
  });
  test(`${kind} snapshot: rejects a stale event even when removed is false`, async () => {
    await assert.rejects(fixture({ logs: [event({ blockHash: hash(999) })] }).run(), code("LOG_BLOCK_CHANGED"));
  });
  test(`${kind} snapshot: events at the sampled end must match its captured hash`, async () => {
    const f = fixture({ logs: [event({ blockNumber: 101n, blockHash: hash(999) })] });
    await assert.rejects(f.run(), code("LOG_BLOCK_CHANGED"));
    assert.equal(f.calls.filter(([m]) => m === "block").length, 1);
  });
  test(`${kind} snapshot: invalid initial headers stop before querying logs or allowance`, async () => {
    for (const result of [
      { number: null, hash: hash(101) }, { number: 102n, hash: hash(101) },
      { number: 101n, hash: null }, { number: 101n, hash: "0x123" },
      { number: 101, hash: hash(101) },
    ]) {
      const f = fixture({ onBlock: () => result });
      await assert.rejects(f.run(), code("INVALID_BLOCK_HEADER"));
      assert.ok(f.calls.every(([m]) => !["logs", "allowance"].includes(m)));
    }
  });
  test(`${kind} snapshot: unavailable initial, event or final blocks reject the report`, async () => {
    for (const missing of [1, 2, 3]) {
      const f = fixture({ onBlock: (args, n) => n === missing ? null
        : { number: args.blockNumber, hash: hash(args.blockNumber) } });
      await assert.rejects(f.run(), code("BLOCK_UNAVAILABLE"));
    }
  });
  test(`${kind} snapshot: malformed event-block headers are rejected`, async () => {
    const f = fixture({ onBlock: (args, n) => ({
      number: n === 2 ? 99n : args.blockNumber, hash: hash(args.blockNumber),
    }) });
    await assert.rejects(f.run(), code("INVALID_BLOCK_HEADER"));
  });
  test(`${kind} snapshot: refuses a provider network change during reads`, async () => {
    await assert.rejects(fixture({ chain: n => n === 1 ? 8453 : 84532 }).run(), code("NETWORK_CHANGED"));
  });
  test(`${kind} snapshot: captures header scalars rather than trusting a mutable object`, async () => {
    const mutable = { number: 101n, hash: hash(101) };
    const f = fixture({
      onBlock: (args, n) => n === 1 ? mutable : { number: args.blockNumber, hash: hash(args.blockNumber) },
      onLogs: () => { mutable.hash = hash(999); return []; },
    });
    assert.equal((await f.run()).toBlockHash, hash(101));
  });
  test(`${kind} snapshot: explicit historical end is checked rather than latest`, async () => {
    const f = fixture();
    const report = await f.run({ toBlock: 100n });
    assert.equal(report.observedTipBlock, "101");
    assert.equal(report.toBlockHash, hash(100));
    assert.ok(f.calls.filter(([m]) => m === "block").every(([, a]) => a.blockNumber === 100n));
  });
  test(`${kind} snapshot: header errors propagate without retry or fallback`, async () => {
    const error = Error("Header service unavailable");
    const f = fixture({ onBlock: () => { throw error; } });
    await assert.rejects(f.run(), e => e === error);
    assert.equal(f.calls.filter(([m]) => m === "block").length, 1);
    assert.equal(f.calls.some(([m]) => m === "logs"), false);
  });
  test(`${kind} snapshot: a client without header support is rejected before RPC`, async () => {
    const f = fixture();
    delete f.rpc.getBlock;
    await assert.rejects(f.run(), code("INVALID_CLIENT"));
    assert.equal(f.calls.length, 0);
  });
  if (kind === "Approval") {
    test("Approval snapshot: unsupported hash selectors never fall back to number or latest", async () => {
      const error = Object.assign(Error("Hash selector unsupported"), { code: -32602 });
      const f = fixture({ onAllowance: () => { throw error; } });
      await assert.rejects(f.run(), e => e === error);
      const calls = f.calls.filter(([m]) => m === "allowance");
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1].requireCanonical, true);
      assert.equal(calls[0][1].blockNumber, undefined);
    });
  }
}
