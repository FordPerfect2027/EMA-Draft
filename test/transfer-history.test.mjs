import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import {
  inspectAccountTransfers, TRANSFER_EVENT, TRANSFER_HISTORY_LIMITS,
  TransferHistoryError,
} from "../src/transfer-history.js";

const ME = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const ZERO = "0x" + "0".repeat(40);
const HASH = (digit) => "0x" + digit.repeat(64);

function transfer({ from = ME, to = OTHER, value = 7n, blockNumber = 100n,
  logIndex = 0, transactionIndex = 0, hash = HASH("1"),
  address = DEPLOYED_TOKEN.contractAddress } = {}) {
  return {
    address, args: { from, to, value }, blockNumber, logIndex,
    transactionIndex, transactionHash: hash,
    blockHash: "0x" + blockNumber.toString(16).padStart(64, "0"), removed: false,
  };
}
function client({ logs = [], chainId = 8453, tip = 101n,
  getLogs, override = {} } = {}) {
  const calls = [];
  return {
    calls,
    async getChainId() {
      calls.push(["getChainId"]);
      return chainId;
    },
    async getBlockNumber() {
      calls.push(["getBlockNumber"]);
      return tip;
    },
    async getBlock({ blockNumber }) {
      calls.push(["getBlock", { blockNumber }]);
      return { number: blockNumber, hash: "0x" + blockNumber.toString(16).padStart(64, "0") };
    },
    async getLogs(args) {
      calls.push(["getLogs", args]);
      if (getLogs) return getLogs(args);
      if (args.args.from) {
        return logs.filter(log => log.args.from.toLowerCase() === args.args.from);
      }
      return logs.filter(log => log.args.to.toLowerCase() === args.args.to);
    },
    ...override,
  };
}
const failCode = (code) => (error) =>
  error instanceof TransferHistoryError && error.code === code;

test("Transfer history uses a standard indexed ERC-20 event, not a transaction method", () => {
  assert.equal(TRANSFER_EVENT.name, "Transfer");
  assert.equal(TRANSFER_HISTORY_LIMITS.maximumBlockSpan, 2000n);
  assert.equal(TRANSFER_HISTORY_LIMITS.maximumLogsPerDirection, 500);
});

test("returns a frozen, deduplicated, block-pinned ThreeCore activity report", async () => {
  const logs = [
    transfer({ from: OTHER, to: ME, value: 20n, blockNumber: 100n, hash: HASH("1") }),
    transfer({ from: ME, to: OTHER, value: 5n, blockNumber: 100n,
      logIndex: 1, transactionIndex: 2, hash: HASH("2") }),
    transfer({ from: ME, to: ME, value: 3n, blockNumber: 101n, hash: HASH("3") }),
    transfer({ from: ME, to: ZERO, value: 4n, blockNumber: 101n, hash: HASH("4"), logIndex: 1, transactionIndex: 1 }),
    transfer({ from: ZERO, to: ME, value: 30n, blockNumber: 101n, hash: HASH("5"), logIndex: 2, transactionIndex: 2 }),
  ];
  const rpc = client({ logs });
  const report = await inspectAccountTransfers(rpc, {
    accountAddress: ME, fromBlock: 100n,
  });
  assert.equal(report.agent, DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(report.contractAddress, DEPLOYED_TOKEN.contractAddress);
  assert.equal(report.chainId, 8453);
  assert.equal(report.fromBlock, "100");
  assert.equal(report.toBlock, "101");
  assert.equal(report.events.length, 5);
  assert.deepEqual(report.events.map(e => e.direction),
    ["incoming", "outgoing", "self", "outgoing", "incoming"]);
  assert.equal(report.events[3].burnEvent, true);
  assert.equal(report.events[4].mintEvent, true);
  assert.equal(report.events[0].amountBaseUnits, "20");
  assert.equal(report.historicalOnly, true);
  assert.equal(report.signed, false);
  assert.equal(report.transactionSent, false);
  assert.equal(report.allowanceChanged, false);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.events));
  assert.ok(report.events.every(Object.isFrozen));
  assert.equal(JSON.parse(JSON.stringify(report)).events.length, 5);
  const requests = rpc.calls.filter(([method]) => method === "getLogs").map(([, args]) => args);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(x => x.address === DEPLOYED_TOKEN.contractAddress &&
    x.fromBlock === 100n && x.toBlock === 101n && x.event.name === "Transfer"));
  assert.deepEqual(Object.keys(rpc).filter(x => /write|sign|sendTransaction/i.test(x)), []);
});

test("explicit historical toBlock is honored and never exceeds the observed chain tip", async () => {
  const rpc = client({ tip: 1000n });
  const report = await inspectAccountTransfers(rpc, {
    accountAddress: ME, fromBlock: 1n, toBlock: 4n,
  });
  assert.equal(report.toBlock, "4");
  assert.equal(report.observedTipBlock, "1000");
  assert.deepEqual(report.events, []);
});

test("wrong chain refuses event scanning without calls to getLogs", async () => {
  const rpc = client({ chainId: 84532 });
  await assert.rejects(inspectAccountTransfers(rpc, {
    accountAddress: ME, fromBlock: 1n,
  }), failCode("WRONG_NETWORK"));
  assert.equal(rpc.calls.some(([method]) => method === "getLogs"), false);
});

test("invalid account address fails before any network access", async () => {
  const rpc = client();
  for (const accountAddress of [null, "garbage", ZERO]) {
    await assert.rejects(inspectAccountTransfers(rpc, {
      accountAddress, fromBlock: 1n,
    }), failCode("INVALID_ADDRESS"));
  }
  assert.equal(rpc.calls.length, 0);
});

test("invalid public clients and malformed block values are rejected", async () => {
  await assert.rejects(inspectAccountTransfers(null, {
    accountAddress: ME, fromBlock: 1n,
  }), failCode("INVALID_CLIENT"));
  for (const fromBlock of [-1n, 1, "1", null]) {
    const rpc = client();
    await assert.rejects(inspectAccountTransfers(rpc, {
      accountAddress: ME, fromBlock,
    }), failCode("INVALID_BLOCK"));
    assert.equal(rpc.calls.length, 0);
  }
});

test("rejects future, reversed and excessively long ranges before fetching logs", async () => {
  const ranges = [
    { fromBlock: 102n },
    { fromBlock: 99n, toBlock: 98n },
    { fromBlock: 1n, toBlock: 2001n },
  ];
  for (const entry of ranges) {
    const rpc = client({ tip: 2500n });
    await assert.rejects(inspectAccountTransfers(rpc, {
      accountAddress: ME, ...entry,
    }), failCode("INVALID_RANGE"));
    assert.equal(rpc.calls.some(([method]) => method === "getLogs"), false);
  }
});

test("rejects logs outside requested block range and logs from another contract", async () => {
  for (const entry of [
    transfer({ blockNumber: 99n }),
    transfer({ blockNumber: 102n }),
    transfer({ address: OTHER }),
  ]) {
    const rpc = client({ getLogs: async () => [entry] });
    await assert.rejects(inspectAccountTransfers(rpc, {
      accountAddress: ME, fromBlock: 100n, toBlock: 101n,
    }), failCode("INVALID_LOG"));
  }
});

test("rejects unrelated and malformed decoded Transfer logs", async () => {
  const unrelated = transfer({ from: OTHER, to: ZERO });
  await assert.rejects(inspectAccountTransfers(
    client({ getLogs: async () => [unrelated] }), {
      accountAddress: ME, fromBlock: 100n,
    }), failCode("UNRELATED_LOG"));
  for (const invalid of [
    transfer({ value: -1n }),
    transfer({ value: "1" }),
    transfer({ hash: "bad" }),
    transfer({ logIndex: -1 }),
    transfer({ transactionIndex: -1 }),
  ]) {
    await assert.rejects(inspectAccountTransfers(
      client({ getLogs: async () => [invalid] }), {
        accountAddress: ME, fromBlock: 100n,
      }), failCode("INVALID_LOG"));
  }
});

test("refuses conflicting logs for the same transaction hash and log index", async () => {
  const a = transfer({ from: ME, to: OTHER, value: 5n });
  const b = transfer({ from: ME, to: OTHER, value: 10n });
  const rpc = client({ getLogs: async () => [a, b] });
  await assert.rejects(inspectAccountTransfers(rpc, {
    accountAddress: ME, fromBlock: 100n,
  }), failCode("CONFLICTING_LOG"));
});

test("refuses excessive or malformed RPC log sets rather than truncating silently", async () => {
  for (const returned of [null, new Array(501).fill(transfer())]) {
    const rpc = client({ getLogs: async () => returned });
    await assert.rejects(inspectAccountTransfers(rpc, {
      accountAddress: ME, fromBlock: 100n,
    }), failCode("LOG_LIMIT"));
  }
});

test("RPC errors propagate without retrying or sending transactions", async () => {
  const rpc = client({ getLogs: async () => { throw Error("RPC unavailable"); } });
  await assert.rejects(inspectAccountTransfers(rpc, {
    accountAddress: ME, fromBlock: 100n,
  }), /RPC unavailable/);
  assert.ok(rpc.calls.every(([method]) =>
    ["getChainId", "getBlockNumber", "getBlock", "getLogs"].includes(method)));
});
