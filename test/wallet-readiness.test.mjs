import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import {
  CLASSIC_ROUTER, WalletReadinessError, inspectWalletReadiness,
} from "../src/wallet-readiness.js";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const ZERO = "0x" + "0".repeat(40);
const BLOCK = 52854080n;

function provider(overrides = {}) {
  const calls = [];
  const client = {
    calls,
    async getChainId() {
      calls.push(["getChainId"]);
      return overrides.chainId ?? DEPLOYED_TOKEN.chainId;
    },
    async getBlockNumber() {
      calls.push(["getBlockNumber"]);
      return overrides.blockNumber ?? BLOCK;
    },
    async getBytecode(params) {
      calls.push(["getBytecode", params]);
      if (overrides.bytecode) return overrides.bytecode(params);
      return "0x60006000";
    },
    async getBalance(params) {
      calls.push(["getBalance", params]);
      return overrides.ethWei ?? 300000000000000n;
    },
    async readContract(params) {
      calls.push(["readContract", params]);
      if (overrides.readContract) return overrides.readContract(params);
      if (params.functionName === "balanceOf") return 320n;
      if (params.functionName === "allowance") return 15n;
      throw new Error("Unexpected ERC-20 read");
    },
  };
  return client;
}

const isCode = (code) => (error) =>
  error instanceof WalletReadinessError && error.code === code;

test("checks a ThreeCore token and the actual Classic Router, never another spender", () => {
  assert.equal(CLASSIC_ROUTER, "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43");
  assert.equal(DEPLOYED_TOKEN.chainId, 8453);
  assert.match(DEPLOYED_TOKEN.contractAddress, /^0x[\da-fA-F]{40}$/);
});

test("reports pinned gas, token balance, and existing classic-router allowance", async () => {
  const client = provider();
  const report = await inspectWalletReadiness(client, ACCOUNT.toUpperCase().replace("0X", "0x"));
  assert.equal(report.agent, DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(report.chainId, 8453);
  assert.equal(report.observedBlockNumber, BLOCK.toString());
  assert.equal(report.contractAddress, DEPLOYED_TOKEN.contractAddress);
  assert.equal(report.publicWalletAddress, ACCOUNT);
  assert.equal(report.classicRouterAddress, CLASSIC_ROUTER);
  assert.equal(report.nativeGasBalanceWei, "300000000000000");
  assert.equal(report.tokenBalanceBaseUnits, "320");
  assert.equal(report.existingClassicRouterAllowanceBaseUnits, "15");
  assert.equal(report.existingClassicRouterApproval, true);
  assert.equal(report.missingNativeGas, false);
  assert.equal(report.readOnly, true);
  assert.equal(report.transactionSent, false);
  assert.equal(report.approvalGranted, false);
  assert.equal(report.walletConnected, false);
  assert.equal(report.contractAudited, false);
  assert.ok(Object.isFrozen(report));
  assert.equal(JSON.parse(JSON.stringify(report)).tokenBalanceBaseUnits, "320");

  const codeReads = client.calls.filter(([name]) => name === "getBytecode").map(([, value]) => value);
  assert.deepEqual(codeReads, [
    { address: DEPLOYED_TOKEN.contractAddress, blockNumber: BLOCK },
    { address: CLASSIC_ROUTER, blockNumber: BLOCK },
  ]);
  assert.deepEqual(client.calls.find(([name]) => name === "getBalance")[1], {
    address: ACCOUNT, blockNumber: BLOCK,
  });
  assert.deepEqual(client.calls.filter(([name]) => name === "readContract").map(([, value]) => [
    value.functionName, value.address, value.args, value.blockNumber,
  ]), [
    ["balanceOf", DEPLOYED_TOKEN.contractAddress, [ACCOUNT], BLOCK],
    ["allowance", DEPLOYED_TOKEN.contractAddress, [ACCOUNT, CLASSIC_ROUTER], BLOCK],
  ]);
  assert.deepEqual(client.calls.map(([name]) => name).filter((name) =>
    /write|send|sign|approve/i.test(name)), []);
});

test("zero gas, zero balance and no Classic Router allowance are accurately distinguished", async () => {
  const client = provider({
    ethWei: 0n,
    readContract: async () => 0n,
  });
  const result = await inspectWalletReadiness(client, ACCOUNT);
  assert.equal(result.missingNativeGas, true);
  assert.equal(result.existingClassicRouterApproval, false);
  assert.equal(result.nativeGasBalanceWei, "0");
  assert.equal(result.tokenBalanceBaseUnits, "0");
  assert.equal(result.existingClassicRouterAllowanceBaseUnits, "0");
});

test("invalid and zero wallet addresses fail before any external requests", async () => {
  const client = provider();
  for (const account of [null, "", "not-an-address", ZERO, "0x123"]) {
    await assert.rejects(inspectWalletReadiness(client, account), isCode("INVALID_ADDRESS"));
  }
  assert.equal(client.calls.length, 0);
});

test("a transaction-only or missing RPC client cannot pass validation", async () => {
  await assert.rejects(inspectWalletReadiness(null, ACCOUNT), isCode("INVALID_CLIENT"));
  await assert.rejects(inspectWalletReadiness({
    sendTransaction: async () => ({}),
  }, ACCOUNT), isCode("INVALID_CLIENT"));
});

test("wrong chain aborts before reading code, gas, token or allowances", async () => {
  const client = provider({ chainId: 84532 });
  await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("WRONG_NETWORK"));
  assert.deepEqual(client.calls, [["getChainId"]]);
});

test("negative or wrong-type block numbers are rejected without contract calls", async () => {
  for (const blockNumber of [-1n, 1, "100", -100]) {
    const client = provider({ blockNumber });
    await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("INVALID_RPC_RESULT"));
    assert.deepEqual(client.calls.map(([method]) => method), [
      "getChainId", "getBlockNumber",
    ]);
  }
});

test("missing token or Router bytecode aborts before reading balances", async () => {
  for (const missingAddress of [DEPLOYED_TOKEN.contractAddress, CLASSIC_ROUTER]) {
    const client = provider({
      bytecode: async ({ address }) =>
        address === missingAddress ? "0x" : "0x60006000",
    });
    await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("MISSING_CONTRACT"));
    assert.equal(client.calls.some(([method]) => method === "getBalance"), false);
    assert.equal(client.calls.some(([method]) => method === "readContract"), false);
  }
});

test("malformed deployed code is rejected instead of treated as verified", async () => {
  for (const code of [null, "0x1", "hello", "0xXX", 123]) {
    const client = provider({ bytecode: async () => code });
    await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("MISSING_CONTRACT"));
  }
});

test("negative or non-bigint native gas values fail closed", async () => {
  for (const ethWei of [-1n, 2, "123"]) {
    const client = provider({ ethWei });
    await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("INVALID_RPC_RESULT"));
  }
});

test("malformed ERC-20 balance or allowance fails closed", async () => {
  for (const invalid of [-3n, "100", 100, null]) {
    for (const functionName of ["balanceOf", "allowance"]) {
      const client = provider({
        readContract: async (args) =>
          args.functionName === functionName ? invalid : 3n,
      });
      await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("INVALID_RPC_RESULT"));
    }
  }
});

test("RPC exceptions propagate without retrying a write transaction", async () => {
  const client = provider({
    bytecode: async () => { throw new Error("Provider unavailable"); },
  });
  await assert.rejects(inspectWalletReadiness(client, ACCOUNT), /Provider unavailable/);
  assert.equal(client.calls.filter(([name]) => name === "getBytecode").length, 2);
  assert.equal(client.calls.some(([name]) => /sendTransaction|writeContract/i.test(name)), false);
});

test("every read is pinned to exactly the same observed block", async () => {
  const client = provider({ blockNumber: 12345n });
  await inspectWalletReadiness(client, ACCOUNT);
  const pinnedCalls = client.calls.filter(([method]) =>
    ["getBytecode", "getBalance", "readContract"].includes(method));
  assert.equal(pinnedCalls.length, 5);
  assert.ok(pinnedCalls.every(([, args]) => args.blockNumber === 12345n));
});

test("case-insensitive wallet address normalizes account before RPC reads", async () => {
  const mixed = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
  const client = provider();
  const report = await inspectWalletReadiness(client, mixed);
  assert.equal(report.publicWalletAddress, mixed.toLowerCase());
  assert.equal(client.calls.find(([method]) => method === "getBalance")[1].address,
    mixed.toLowerCase());
});

test("uint256 overflow is rejected for block, gas, token and allowance", async () => {
  const overflow = 1n << 256n;
  for (const overrides of [
    { blockNumber: overflow }, { ethWei: overflow },
    { readContract: async ({ functionName }) => functionName === "balanceOf" ? overflow : 0n },
    { readContract: async ({ functionName }) => functionName === "allowance" ? overflow : 0n },
  ]) {
    await assert.rejects(inspectWalletReadiness(provider(overrides), ACCOUNT), isCode("INVALID_RPC_RESULT"));
  }
});
test("maximum uint256 existing approval remains exact and is reported as exposure", async () => {
  const maximum = (1n << 256n) - 1n;
  const result = await inspectWalletReadiness(provider({
    ethWei: maximum, readContract: async () => maximum,
  }), ACCOUNT);
  assert.equal(result.nativeGasBalanceWei, maximum.toString());
  assert.equal(result.tokenBalanceBaseUnits, maximum.toString());
  assert.equal(result.existingClassicRouterAllowanceBaseUnits, maximum.toString());
  assert.equal(result.existingClassicRouterApproval, true);
  assert.equal(result.approvalGranted, false);
});

test("rejects wallet report if public RPC switches chains during sampled reads", async () => {
  const client = provider();
  let checks = 0;
  client.getChainId = async () => {
    client.calls.push(["getChainId"]);
    return ++checks === 1 ? DEPLOYED_TOKEN.chainId : 84532;
  };
  await assert.rejects(inspectWalletReadiness(client, ACCOUNT), isCode("NETWORK_CHANGED"));
  assert.equal(checks, 2);
  assert.equal(client.calls.filter(([method]) => method === "readContract").length, 2);
  assert.equal(client.calls.some(([method]) =>
    /sendTransaction|writeContract|signMessage|approve/i.test(method)), false);
});

test("rechecks RPC chain ID before returning wallet readiness report", async () => {
  const client = provider();
  const report = await inspectWalletReadiness(client, ACCOUNT);
  assert.equal(report.readOnly, true);
  assert.equal(client.calls.filter(([method]) => method === "getChainId").length, 2);
});
