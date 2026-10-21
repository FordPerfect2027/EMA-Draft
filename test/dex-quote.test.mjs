import test from "node:test";
import assert from "node:assert/strict";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { CLASSIC_DEX, DexQuoteError, quoteClassicDex } from "../src/dex-quote.js";

const TOKEN = DEPLOYED_TOKEN.contractAddress;
const USDC = CLASSIC_DEX.usdc;
const POOL = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK = 52855000n;
const TOKEN_RESERVE = 2000000n * 10n ** 18n;
const USDC_RESERVE = 100000000n;
const code = (value) => (error) =>
  error instanceof DexQuoteError && error.code === value;

function mock(overrides = {}) {
  const calls = [];
  const client = {
    calls,
    async getChainId() {
      calls.push(["getChainId"]);
      return overrides.chainId ?? 8453;
    },
    async getBlockNumber() {
      calls.push(["getBlockNumber"]);
      return overrides.blockNumber ?? BLOCK;
    },
    async getBytecode(args) {
      calls.push(["getBytecode", args]);
      return overrides.bytecode ?? "0x60006000";
    },
    async readContract(args) {
      calls.push(["readContract", args]);
      if (overrides.read) {
        const custom = overrides.read(args);
        if (custom !== undefined) return custom;
      }
      switch (args.functionName) {
        case "getPool": return Object.hasOwn(overrides, "pool") ? overrides.pool : POOL;
        case "isPool": return overrides.isPool ?? true;
        case "token0": return overrides.token0 ?? TOKEN;
        case "token1": return overrides.token1 ?? USDC;
        case "stable": return overrides.stable ?? false;
        case "getReserves": return overrides.reserves ??
          [TOKEN_RESERVE, USDC_RESERVE, 1789000000n];
        case "decimals": return args.address.toLowerCase() === USDC ?
          (overrides.usdcDecimals ?? 6) : (overrides.tokenDecimals ?? 18);
        case "getAmountOut": return overrides.quote ?? 19000000000000000000000n;
        default: throw new Error("Unexpected readContract " + args.functionName);
      }
    },
  };
  return client;
}
function findCall(client, name) {
  return client.calls.find(([method, args]) =>
    method === "readContract" && args.functionName === name)?.[1];
}

test("manifest pins published Aerodrome Classic Factory and Base native USDC", () => {
  assert.equal(CLASSIC_DEX.chainId, 8453);
  assert.equal(CLASSIC_DEX.factory, "0x420dd381b31aef6683db6b902084cb0ffece40da");
  assert.equal(CLASSIC_DEX.usdc, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  assert.equal(CLASSIC_DEX.usdcDecimals, 6);
  assert.equal(CLASSIC_DEX.stable, false);
  assert.ok(Object.isFrozen(CLASSIC_DEX));
});

test("buy: uses registered volatile TOKEN/USDC pool and onchain fee-aware output", async () => {
  const client = mock();
  const result = await quoteClassicDex(client);
  assert.equal(result.agent, DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(result.poolAddress, POOL);
  assert.equal(result.chainId, 8453);
  assert.equal(result.blockNumber, BLOCK.toString());
  assert.equal(result.inputBaseUnits, "1000000");
  assert.equal(result.quotedOutputBaseUnits, "19000000000000000000000");
  assert.equal(result.reserveInBaseUnits, USDC_RESERVE.toString());
  assert.equal(result.reserveOutBaseUnits, TOKEN_RESERVE.toString());
  assert.equal(result.inputDecimals, 6);
  assert.equal(result.outputDecimals, 18);
  assert.equal(result.direction, "buy");
  assert.equal(result.feeIncludedByPoolQuote, true);
  assert.equal(result.readOnly, true);
  assert.equal(result.tradeExecuted, false);
  assert.equal(result.walletConnected, false);
  assert.equal(result.approvalGranted, false);
  assert.equal(result.thirdPartyWebsiteConnected, false);
  assert.ok(Object.isFrozen(result));
  assert.equal(findCall(client, "getAmountOut").args[0], 1000000n);
  assert.equal(findCall(client, "getAmountOut").args[1], USDC);
  assert.equal(findCall(client, "getPool").address, CLASSIC_DEX.factory);
  assert.deepEqual(findCall(client, "getPool").args, [TOKEN, USDC, false]);
});

test("sell: accepts raw token input and correctly switches reserve direction", async () => {
  const client = mock({ quote: 1000000n });
  const result = await quoteClassicDex(client, { direction: "sell" });
  assert.equal(result.inputBaseUnits, "1000000000000000000");
  assert.equal(result.quotedOutputBaseUnits, "1000000");
  assert.equal(result.reserveInBaseUnits, TOKEN_RESERVE.toString());
  assert.equal(result.reserveOutBaseUnits, USDC_RESERVE.toString());
  assert.equal(result.inputDecimals, 18);
  assert.equal(result.outputDecimals, 6);
  assert.equal(findCall(client, "getAmountOut").args[1].toLowerCase(), TOKEN.toLowerCase());
});

test("contract token0/token1 ordering is handled without assuming a fixed order", async () => {
  const client = mock({
    token0: USDC,
    token1: TOKEN,
    reserves: [USDC_RESERVE, TOKEN_RESERVE, 1789000000n],
  });
  const result = await quoteClassicDex(client);
  assert.equal(result.reserveInBaseUnits, USDC_RESERVE.toString());
  assert.equal(result.reserveOutBaseUnits, TOKEN_RESERVE.toString());
});

test("all RPC reads use one snapshot block and only read-only publicClient methods", async () => {
  const client = mock({ blockNumber: 555n });
  await quoteClassicDex(client);
  for (const [method, args] of client.calls) {
    assert.ok(["getChainId", "getBlockNumber", "getBytecode", "readContract"].includes(method));
    if (method === "getBytecode" || method === "readContract") {
      assert.equal(args.blockNumber, 555n);
    }
  }
  assert.equal(client.calls.some(([method]) => /send|write|sign|approve/i.test(method)), false);
});

test("invalid directions and inputs are rejected without touching RPC", async () => {
  const client = mock();
  await assert.rejects(quoteClassicDex(client, { direction: "bridge" }), code("INVALID_DIRECTION"));
  for (const invalid of [0n, -1n, 100, "100", null, 2n ** 256n]) {
    await assert.rejects(quoteClassicDex(client, {
      amountInBaseUnits: invalid,
    }), code("INVALID_AMOUNT"));
  }
  assert.equal(client.calls.length, 0);
});

test("wrong Base network blocks all pool and quote RPC calls", async () => {
  const client = mock({ chainId: 84532 });
  await assert.rejects(quoteClassicDex(client), code("WRONG_CHAIN"));
  assert.deepEqual(client.calls.map(([method]) => method), ["getChainId"]);
});

test("missing read-only public client is rejected without network calls", async () => {
  await assert.rejects(quoteClassicDex(null), code("INVALID_CLIENT"));
  await assert.rejects(quoteClassicDex({ sendTransaction: async () => {} }),
    code("INVALID_CLIENT"));
});

test("absent or malformed PoolFactory result rejects without downstream operations", async () => {
  for (const pool of ["0x" + "0".repeat(40), null, "0x123"]) {
    const client = mock({ pool });
    await assert.rejects(quoteClassicDex(client),
      pool === "0x" + "0".repeat(40) ? code("NO_POOL") : code("INVALID_ADDRESS_RESULT"));
    assert.equal(client.calls.some(([method, a]) =>
      method === "readContract" && a.functionName === "getAmountOut"), false);
  }
});

test("unregistered pool and missing bytecode fail before quote", async () => {
  const unregistered = mock({ isPool: false });
  await assert.rejects(quoteClassicDex(unregistered), code("UNREGISTERED_POOL"));
  const noCode = mock({ bytecode: "0x" });
  await assert.rejects(quoteClassicDex(noCode), code("MISSING_POOL_CODE"));
  for (const client of [unregistered, noCode]) {
    assert.equal(findCall(client, "getAmountOut"), undefined);
  }
});

test("pool token pair and stable-flag mismatches are refused", async () => {
  for (const overrides of [
    { token0: OTHER },
    { token1: OTHER },
    { token0: USDC, token1: USDC },
    { stable: true },
  ]) {
    await assert.rejects(quoteClassicDex(mock(overrides)), code("PAIR_MISMATCH"));
  }
});

test("invalid reserve structure, zero reserves and decimals are refused", async () => {
  for (const reserves of [
    [], [0n, 100n], [100n, "50", 1n],
    [100n, -1n, 1n],
  ]) {
    await assert.rejects(quoteClassicDex(mock({ reserves })),
      code("INVALID_RESERVES"));
  }
  for (const reserves of [
    [0n, 100n, 1n], [100n, 0n, 1n],
  ]) {
    await assert.rejects(quoteClassicDex(mock({ reserves })), code("EMPTY_POOL"));
  }
  for (const option of [
    { tokenDecimals: 9 }, { usdcDecimals: 18 },
  ]) {
    await assert.rejects(quoteClassicDex(mock(option)), code("DECIMALS_MISMATCH"));
  }
});

test("zero output, excessive output or invalid uint256 output is not a valid quote", async () => {
  for (const quote of [0n, TOKEN_RESERVE, TOKEN_RESERVE + 1n, -1n, "100"]) {
    await assert.rejects(quoteClassicDex(mock({ quote })),
      quote === 0n || quote >= TOKEN_RESERVE ? code("INVALID_QUOTE") : code("INVALID_RPC_RESULT"));
  }
});

test("RPC read errors propagate without an approval or trading retry", async () => {
  const client = mock({
    read: ({ functionName }) => {
      if (functionName === "getAmountOut") throw new Error("RPC unavailable");
      return undefined;
    },
  });
  await assert.rejects(quoteClassicDex(client), /RPC unavailable/);
  assert.equal(client.calls.filter(([m, a]) =>
    m === "readContract" && a.functionName === "getAmountOut").length, 1);
});


test("rejects a quote if the public RPC switches chains during the sampled reads", async () => {
  const client = mock();
  let checks = 0;
  client.getChainId = async () => {
    client.calls.push(["getChainId"]);
    return ++checks === 1 ? CLASSIC_DEX.chainId : 84532;
  };
  await assert.rejects(quoteClassicDex(client), code("NETWORK_CHANGED"));
  assert.equal(checks, 2);
  assert.ok(client.calls.some(([method, args]) =>
    method === "readContract" && args.functionName === "getAmountOut"));
  assert.equal(client.calls.some(([method]) =>
    /sendTransaction|writeContract|signMessage|approve/i.test(method)), false);
});

test("rechecks that RPC is still on Base before returning a read-only quote", async () => {
  const client = mock();
  const result = await quoteClassicDex(client);
  assert.equal(result.readOnly, true);
  assert.equal(client.calls.filter(([method]) => method === "getChainId").length, 2);
});
