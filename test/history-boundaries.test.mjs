import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { inspectAccountTransfers } from "../src/transfer-history.js";
import { inspectApprovalHistory } from "../src/approval-history.js";

const ACCOUNT = "0x" + "11".repeat(20);
const SPENDER = "0x" + "22".repeat(20);
const hash = n => "0x" + BigInt(n).toString(16).padStart(64, "0");
const MAX = (1n << 256n) - 1n;
const errorCode = code => error => error.code === code;

for (const kind of ["Transfer", "Approval"]) {
  function log(extra = {}) {
    return {
      address: DEPLOYED_TOKEN.contractAddress, blockNumber: 100n,
      blockHash: hash(100), transactionHash: hash(200),
      transactionIndex: 0, logIndex: 0, removed: false,
      args: kind === "Transfer"
        ? { from: ACCOUNT, to: ACCOUNT, value: 7n }
        : { owner: ACCOUNT, spender: SPENDER, value: 7n },
      ...extra,
    };
  }
  function fixture(logs, { allowance = 0n, tip = 101n } = {}) {
    const calls = [];
    const rpc = {
      async getChainId() { calls.push("chain"); return 8453; },
      async getBlockNumber() { calls.push("tip"); return tip; },
      async getBlock({ blockNumber }) {
        return { number: blockNumber,
          hash: logs.find(log => log.blockNumber === blockNumber)?.blockHash ?? hash(blockNumber) };
      },
      async getLogs() { calls.push("logs"); return logs; },
      async readContract() { calls.push("allowance"); return allowance; },
    };
    return {
      calls,
      run: (extra = {}) => kind === "Transfer"
        ? inspectAccountTransfers(rpc, { accountAddress: ACCOUNT, fromBlock: 100n, ...extra })
        : inspectApprovalHistory(rpc, { ownerAddress: ACCOUNT, spenderAddress: SPENDER, fromBlock: 100n, ...extra }),
    };
  }
  const events = report => kind === "Transfer" ? report.events : report.approvalEvents;

  test(`${kind}: removed events fail the whole report`, async () => {
    await assert.rejects(fixture([log(), log({ removed: true })]).run(), errorCode("REMOVED_LOG"));
  });
  test(`${kind}: pending or incomplete log identities fail closed`, async () => {
    for (const change of [
      { removed: undefined }, { removed: null }, { removed: "false" },
      { blockHash: null }, { blockHash: "0x123" }, { transactionHash: null },
      { transactionHash: { toString: () => hash(200) } },
      { logIndex: null }, { logIndex: 0.5 }, { logIndex: Number.MAX_SAFE_INTEGER + 1 },
      { transactionIndex: null }, { transactionIndex: -1 },
    ]) {
      await assert.rejects(fixture([log(change)]).run(), errorCode("INVALID_LOG"));
    }
  });
  test(`${kind}: rejects uint256 overflow in event amounts`, async () => {
    const entry = log();
    entry.args.value = MAX + 1n;
    await assert.rejects(fixture([entry]).run(), errorCode("INVALID_LOG"));
  });
  test(`${kind}: preserves zero and maximum uint256 event amounts exactly`, async () => {
    for (const value of [0n, MAX]) {
      const entry = log();
      entry.args.value = value;
      const report = await fixture([entry], { allowance: MAX }).run();
      const event = events(report)[0];
      assert.equal(kind === "Transfer" ? event.amountBaseUnits : event.approvedAmountBaseUnits, value.toString());
      assert.equal(event.blockHash, hash(100));
      assert.equal(report.canonicalityVerified, false);
      assert.equal(report.historyComplete, false);
      if (kind === "Approval") assert.equal(report.allowanceAtSampleBlockBaseUnits, MAX.toString());
    }
  });
  test(`${kind}: rejects oversized caller, tip and log heights`, async () => {
    const f = fixture([]);
    await assert.rejects(f.run({ fromBlock: MAX + 1n }), errorCode("INVALID_BLOCK"));
    assert.deepEqual(f.calls, []);
    await assert.rejects(fixture([]).run({ toBlock: MAX + 1n }), errorCode("INVALID_BLOCK"));
    await assert.rejects(fixture([], { tip: MAX + 1n }).run(), errorCode("INVALID_BLOCK"));
    await assert.rejects(fixture([log({ blockNumber: MAX + 1n })]).run(), errorCode("INVALID_BLOCK"));
  });
  test(`${kind}: accepts uint256 maximum height without rounding`, async () => {
    const entry = log({ blockNumber: MAX });
    const report = await fixture([entry], { tip: MAX }).run({ fromBlock: MAX });
    assert.equal(events(report)[0].blockNumber, MAX.toString());
  });
  test(`${kind}: exact and differently cased duplicates are counted once`, async () => {
    const entry = log({ blockHash: "0x" + "ab".repeat(32), transactionHash: "0x" + "cd".repeat(32) });
    const second = { ...entry, blockHash: "0x" + "AB".repeat(32), transactionHash: "0x" + "CD".repeat(32) };
    assert.equal(events(await fixture([entry, second, entry]).run()).length, 1);
  });
  test(`${kind}: duplicate identities cannot change block hash or transaction index`, async () => {
    for (const change of [{ blockHash: hash(101) }, { transactionIndex: 1 }]) {
      await assert.rejects(fixture([log(), log(change)]).run(), errorCode("CONFLICTING_LOG"));
    }
  });
  test(`${kind}: different events at one height cannot claim different block hashes`, async () => {
    await assert.rejects(fixture([log(), log({
      blockHash: hash(101), transactionHash: hash(201), transactionIndex: 1, logIndex: 1,
    })]).run(), errorCode("CONFLICTING_LOG"));
  });
  test(`${kind}: one block hash cannot claim two heights`, async () => {
    await assert.rejects(fixture([log(), log({
      blockNumber: 101n, transactionHash: hash(201), transactionIndex: 1, logIndex: 1,
    })]).run(), errorCode("CONFLICTING_LOG"));
  });
  test(`${kind}: block-wide log and transaction positions cannot be reused`, async () => {
    for (const change of [
      { transactionHash: hash(201), transactionIndex: 1 },
      { transactionHash: hash(201), logIndex: 1 },
      { transactionIndex: 1, logIndex: 1 },
    ]) {
      await assert.rejects(fixture([log(), log(change)]).run(), errorCode("CONFLICTING_LOG"));
    }
  });
  test(`${kind}: multiple logs in one transaction and multiple transactions remain valid`, async () => {
    const report = await fixture([
      log({ transactionHash: hash(201), transactionIndex: 1, logIndex: 2 }),
      log({ logIndex: 1 }), log(),
    ]).run();
    assert.deepEqual(events(report).map(x => x.logIndex), [0, 1, 2]);
  });
  if (kind === "Approval") {
    test("Approval: rejects oversized sampled allowance", async () => {
      await assert.rejects(fixture([], { allowance: MAX + 1n }).run(), errorCode("INVALID_ALLOWANCE"));
    });
  } else {
    test("Transfer: each RPC response must match its requested direction", async () => {
      const wrongSent = log({ args: { from: SPENDER, to: ACCOUNT, value: 1n } });
      const wrongReceived = log({ args: { from: ACCOUNT, to: SPENDER, value: 1n } });
      for (const entry of [wrongSent, wrongReceived]) {
        await assert.rejects(fixture([entry]).run(), errorCode("WRONG_LOG_FILTER"));
      }
    });
  }
}
