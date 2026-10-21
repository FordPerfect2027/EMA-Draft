import test from "node:test";
import assert from "node:assert/strict";
import {
  DEPLOYED_TOKEN, TokenIdentityError, verifyDeployedToken,
} from "../src/onchain-identity.js";

function mockClient(overrides = {}) {
  const methods = [];
  const expected = DEPLOYED_TOKEN;
  const client = {
    methods,
    async getChainId() {
      methods.push("getChainId");
      return overrides.chainId ?? expected.chainId;
    },
    async getBlockNumber() {
      methods.push("getBlockNumber");
      return overrides.blockNumber ?? 1234n;
    },
    async getBytecode(params) {
      methods.push(["getBytecode", params]);
      return overrides.bytecode ?? "0x60006000";
    },
    async readContract(params) {
      methods.push(["readContract", params]);
      if (params.functionName === "name") return overrides.name ?? expected.tokenName;
      if (params.functionName === "symbol") return overrides.symbol ?? expected.tokenSymbol;
      if (params.functionName === "decimals") return overrides.decimals ?? expected.decimals;
      if (params.functionName === "totalSupply") {
        return overrides.supply ?? BigInt(expected.supplyUnits) * 10n ** BigInt(expected.decimals);
      }
      throw Error("Unexpected call");
    },
  };
  return client;
}

function expectCode(code) {
  return e => e instanceof TokenIdentityError && e.code === code;
}

test("deployed token specification is immutable and contains a complete address", () => {
  assert.ok(Object.isFrozen(DEPLOYED_TOKEN));
  assert.equal(DEPLOYED_TOKEN.chainId, 8453);
  assert.match(DEPLOYED_TOKEN.contractAddress, /^0x[\da-fA-F]{40}$/);
  assert.match(DEPLOYED_TOKEN.tokenSymbol, /^[A-Z]+$/);
  assert.equal(DEPLOYED_TOKEN.decimals, 18);
  assert.match(DEPLOYED_TOKEN.supplyUnits, /^\d+$/);
});

test("verifies token identity against read-only RPC calls pinned to one block", async () => {
  const client = mockClient();
  const result = await verifyDeployedToken(client);
  assert.equal(result.tokenName, DEPLOYED_TOKEN.tokenName);
  assert.equal(result.tokenSymbol, DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(result.blockNumber, "1234");
  assert.equal(result.totalSupplyBaseUnits,
    (BigInt(DEPLOYED_TOKEN.supplyUnits) * 10n ** 18n).toString());
  assert.equal(result.readOnly, true);
  assert.equal(result.contractDeployedByCheck, false);
  assert.equal(result.transactionSent, false);
  assert.equal(result.securityAudit, false);
  assert.ok(Object.isFrozen(result));
  const bytecodeCall = client.methods.find(m => Array.isArray(m) && m[0] === "getBytecode");
  assert.deepEqual(bytecodeCall[1], {
    address: DEPLOYED_TOKEN.contractAddress, blockNumber: 1234n,
  });
  assert.equal(client.methods.filter(m => Array.isArray(m) && m[0] === "readContract").length, 4);
  assert.ok(client.methods.filter(Array.isArray).every(m => m[1].blockNumber === 1234n));
});

test("wrong chain is rejected before examining bytecode or balances", async () => {
  const client = mockClient({ chainId: 1 });
  await assert.rejects(verifyDeployedToken(client), expectCode("WRONG_NETWORK"));
  assert.deepEqual(client.methods, ["getChainId"]);
});

test("missing contract bytecode never passes the identity check", async () => {
  for (const bytecode of ["0x", "not-hex"]) {
    const client = mockClient({ bytecode });
    await assert.rejects(verifyDeployedToken(client), expectCode("NO_DEPLOYED_CODE"));
    assert.equal(client.methods.some(m => Array.isArray(m) && m[0] === "readContract"), false);
  }
});

test("rejects unexpected token name or symbol without reporting success", async () => {
  for (const overrides of [{ name: "Impostor Token" }, { symbol: "FAKE" }]) {
    await assert.rejects(verifyDeployedToken(mockClient(overrides)), expectCode("METADATA_MISMATCH"));
  }
});

test("rejects a decimals mismatch and supply above original issuance", async () => {
  await assert.rejects(verifyDeployedToken(mockClient({ decimals: 6 })),
    expectCode("METADATA_MISMATCH"));
  const excess = BigInt(DEPLOYED_TOKEN.supplyUnits) * 10n ** 18n + 1n;
  await assert.rejects(verifyDeployedToken(mockClient({ supply: excess })),
    expectCode("SUPPLY_EXCEEDS_ISSUANCE"));
});

test("allows valid future burn reductions and records the change", async () => {
  const original = BigInt(DEPLOYED_TOKEN.supplyUnits) * 10n ** 18n;
  const result = await verifyDeployedToken(mockClient({ supply: original - 123n }));
  assert.equal(result.estimatedBurnedBaseUnits, "123");
  assert.equal(result.totalSupplyBaseUnits, (original - 123n).toString());
  assert.equal(result.originalIssuanceTokenUnits, DEPLOYED_TOKEN.supplyUnits);
});

test("invalid block number or supply values are rejected", async () => {
  await assert.rejects(verifyDeployedToken(mockClient({ blockNumber: -1n })),
    expectCode("INVALID_BLOCK"));
  await assert.rejects(verifyDeployedToken(mockClient({ supply: -1n })),
    expectCode("INVALID_SUPPLY"));
});

test("unknown RPC failure is propagated and no transaction method is called", async () => {
  const client = mockClient();
  client.getBytecode = async () => { throw new Error("Provider unavailable"); };
  await assert.rejects(verifyDeployedToken(client), /Provider unavailable/);
  assert.equal(client.methods.some(m =>
    typeof m === "string" && /sendTransaction|sign|approve/i.test(m)), false);
});

test("does not accept a transaction-only or missing RPC client", async () => {
  await assert.rejects(verifyDeployedToken(null), expectCode("INVALID_CLIENT"));
  await assert.rejects(verifyDeployedToken({ sendTransaction() {} }),
    expectCode("INVALID_CLIENT"));
});
