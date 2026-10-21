import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { CLASSIC_ROUTER } from "../src/wallet-readiness.js";
import {
  APPROVAL_EVENT, APPROVAL_LIMITS,
  ApprovalHistoryError, inspectApprovalHistory,
} from "../src/approval-history.js";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = CLASSIC_ROUTER;
const OTHER = "0x2222222222222222222222222222222222222222";
const TX = (char) => "0x" + char.repeat(64);
const BASE = 52850000n;
const expectError = (code) =>
  (error) => error instanceof ApprovalHistoryError && error.code === code;

function approval({
  owner = OWNER, spender = SPENDER, value = 10n,
  blockNumber = BASE, logIndex = 0, transactionIndex = 0,
  transactionHash = TX("a"), address = DEPLOYED_TOKEN.contractAddress,
} = {}) {
  return { address, args: { owner, spender, value },
    blockNumber, logIndex, transactionIndex, transactionHash,
    blockHash: "0x" + blockNumber.toString(16).padStart(64, "0"), removed: false };
}

function mock({ logs = [], allowance = 15n, chainId = 8453, tip = BASE + 5n,
  getLogs, readContract } = {}) {
  const calls = [];
  return {
    calls,
    async getChainId() { calls.push(["getChainId"]); return chainId; },
    async getBlockNumber() { calls.push(["getBlockNumber"]); return tip; },
    async getBlock({ blockNumber }) {
      calls.push(["getBlock", { blockNumber }]);
      return { number: blockNumber, hash: "0x" + blockNumber.toString(16).padStart(64, "0") };
    },
    async getLogs(args) {
      calls.push(["getLogs", args]);
      return getLogs ? getLogs(args) : logs;
    },
    async readContract(args) {
      calls.push(["readContract", args]);
      return readContract ? readContract(args) : allowance;
    },
  };
}
function options(extra = {}) {
  return { ownerAddress: OWNER, fromBlock: BASE, ...extra };
}

test("Approval event is indexed and bounded to a short read-only window", () => {
  assert.equal(APPROVAL_EVENT.name, "Approval");
  assert.equal(APPROVAL_EVENT.inputs[0].indexed, true);
  assert.equal(APPROVAL_EVENT.inputs[1].indexed, true);
  assert.equal(APPROVAL_LIMITS.maximumBlockSpan, 2000n);
  assert.equal(APPROVAL_LIMITS.maximumLogs, 500);
});

test("returns event history and pinned current allowance as DIFFERENT facts", async () => {
  const rpc = mock({ logs: [
    approval({ value: 100n, transactionHash: TX("1"), blockNumber: BASE }),
    approval({ value: 0n, transactionHash: TX("2"), blockNumber: BASE + 2n }),
    approval({ value: 300n, transactionHash: TX("3"), blockNumber: BASE + 4n }),
  ], allowance: 80n });
  const report = await inspectApprovalHistory(rpc, options());
  assert.equal(report.agent, DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(report.ownerAddress, OWNER);
  assert.equal(report.spenderAddress, CLASSIC_ROUTER);
  assert.equal(report.classicRouterSpender, true);
  assert.equal(report.allowanceAtSampleBlockBaseUnits, "80");
  assert.deepEqual(report.approvalEvents.map(item => item.approvedAmountBaseUnits),
    ["100", "0", "300"]);
  assert.equal(report.approvalEvents[1].revocationEvent, true);
  assert.equal(report.eventHistoryIsNotAllowanceBalance, true);
  assert.equal(report.historyComplete, false);
  assert.equal(report.readOnly, true);
  assert.equal(report.transactionSent, false);
  assert.equal(report.approvalGranted, false);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.approvalEvents));
  assert.ok(report.approvalEvents.every(Object.isFrozen));
  assert.equal(JSON.parse(JSON.stringify(report)).allowanceAtSampleBlockBaseUnits, "80");
  const logCall = rpc.calls.find(([name]) => name === "getLogs")[1];
  assert.equal(logCall.address, DEPLOYED_TOKEN.contractAddress);
  assert.equal(logCall.event.name, "Approval");
  assert.deepEqual(logCall.args, { owner: OWNER, spender: CLASSIC_ROUTER });
  assert.equal(logCall.fromBlock, BASE);
  assert.equal(logCall.toBlock, BASE + 5n);
  const allowanceCall = rpc.calls.find(([name]) => name === "readContract")[1];
  assert.equal(allowanceCall.functionName, "allowance");
  assert.deepEqual(allowanceCall.args, [OWNER, CLASSIC_ROUTER]);
  assert.equal(allowanceCall.blockHash, "0x" + (BASE + 5n).toString(16).padStart(64, "0"));
  assert.equal(allowanceCall.requireCanonical, true);
  assert.equal(allowanceCall.blockNumber, undefined);
});

test("an explicit historical block pins the allowance, not latest", async () => {
  const rpc = mock({ tip: BASE + 200n, allowance: 10n });
  const report = await inspectApprovalHistory(rpc, options({ toBlock: BASE + 1n }));
  assert.equal(report.toBlock, (BASE + 1n).toString());
  assert.equal(report.observedTipBlock, (BASE + 200n).toString());
  assert.equal(rpc.calls.find(([name]) => name === "readContract")[1].blockHash,
    "0x" + (BASE + 1n).toString(16).padStart(64, "0"));
});

test("different public spender is explicit and never labelled Classic Router", async () => {
  const report = await inspectApprovalHistory(mock(), options({ spenderAddress: OTHER }));
  assert.equal(report.spenderAddress, OTHER);
  assert.equal(report.classicRouterSpender, false);
});

test("deduplicates repeated RPC logs and sorts by transaction position", async () => {
  const first = approval({ transactionHash: TX("3"), transactionIndex: 2, logIndex: 2, blockNumber: BASE + 1n });
  const second = approval({ transactionHash: TX("2"), transactionIndex: 1, logIndex: 1, blockNumber: BASE + 1n });
  const report = await inspectApprovalHistory(
    mock({ logs: [first, first, second] }), options());
  assert.equal(report.approvalEvents.length, 2);
  assert.deepEqual(report.approvalEvents.map(item => item.transactionIndex), [1, 2]);
});

test("different values for one log ID cause a conflict", async () => {
  const first = approval({ value: 3n });
  const second = approval({ value: 4n });
  await assert.rejects(inspectApprovalHistory(
    mock({ logs: [first, second] }), options()), expectError("CONFLICTING_LOG"));
});

test("refuses incorrect chain before requesting an allowance or history", async () => {
  const rpc = mock({ chainId: 84532 });
  await assert.rejects(inspectApprovalHistory(rpc, options()), expectError("WRONG_NETWORK"));
  assert.deepEqual(rpc.calls, [["getChainId"]]);
});

test("refuses invalid owner and spender addresses without any network requests", async () => {
  const rpc = mock();
  for (const value of [null, "", "0x123", "0x" + "0".repeat(40)]) {
    await assert.rejects(inspectApprovalHistory(rpc,
      options({ ownerAddress: value })), expectError("INVALID_ADDRESS"));
    await assert.rejects(inspectApprovalHistory(rpc,
      options({ spenderAddress: value })), expectError("INVALID_ADDRESS"));
  }
  assert.equal(rpc.calls.length, 0);
});

test("rejects malformed block values, reversed ranges and too many blocks", async () => {
  for (const fromBlock of [-1n, "1", 1, null]) {
    await assert.rejects(inspectApprovalHistory(mock(),
      options({ fromBlock })), expectError("INVALID_BLOCK"));
  }
  for (const range of [
    { fromBlock: BASE + 6n },
    { fromBlock: BASE, toBlock: BASE - 1n },
    { fromBlock: BASE - 2000n, toBlock: BASE },
    { fromBlock: BASE, toBlock: BASE + 6n },
  ]) {
    await assert.rejects(inspectApprovalHistory(mock(),
      options(range)), expectError("INVALID_RANGE"));
  }
});

test("requires public read client with contract read and log support", async () => {
  await assert.rejects(inspectApprovalHistory(null, options()),
    expectError("INVALID_CLIENT"));
  await assert.rejects(inspectApprovalHistory({ getChainId: async () => 8453 },
    options()), expectError("INVALID_CLIENT"));
});

test("rejects unrelated, malformed or out-of-range Approval logs", async () => {
  for (const entry of [
    approval({ owner: OTHER }),
    approval({ spender: OTHER }),
    approval({ address: OTHER }),
    approval({ value: -1n }),
    approval({ value: "1" }),
    approval({ transactionHash: "invalid" }),
    approval({ blockNumber: BASE - 1n }),
    approval({ blockNumber: BASE + 6n }),
    approval({ logIndex: -1 }),
  ]) {
    await assert.rejects(inspectApprovalHistory(
      mock({ logs: [entry] }), options()), ApprovalHistoryError);
  }
});

test("rejects unbounded Approval event sets or malformed allowances", async () => {
  for (const logs of [null, Array(501).fill(approval())]) {
    await assert.rejects(inspectApprovalHistory(
      mock({ logs }), options()), expectError("LOG_LIMIT"));
  }
  for (const allowance of [-1n, "5", 5, null]) {
    await assert.rejects(inspectApprovalHistory(
      mock({ allowance }), options()), expectError("INVALID_ALLOWANCE"));
  }
});

test("RPC errors propagate and never cause transactions or approvals", async () => {
  const rpc = mock({ getLogs: async () => { throw new Error("RPC rejected getLogs"); } });
  await assert.rejects(inspectApprovalHistory(rpc, options()), /RPC rejected/);
  assert.ok(rpc.calls.every(([method]) =>
    ["getChainId", "getBlockNumber", "getBlock", "getLogs", "readContract"].includes(method)));
});
