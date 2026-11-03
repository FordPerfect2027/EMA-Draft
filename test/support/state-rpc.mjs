import { decodeFunctionData, encodeFunctionResult, parseAbi } from "viem";
import { DEPLOYED_TOKEN } from "../../src/onchain-identity.js";
export const HASH = "0x" + "ab".repeat(32), OTHER_HASH = "0x" + "cd".repeat(32);
export const POOL = "0x" + "aa".repeat(20), ACCOUNT = "0x" + "11".repeat(20);
export const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const MAX = (1n << 256n) - 1n;
export const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function getPool(address,address,bool) view returns (address)",
  "function isPool(address) view returns (bool)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function stable() view returns (bool)",
  "function getReserves() view returns (uint256,uint256,uint256)",
  "function decimals() view returns (uint8)",
  "function getAmountOut(uint256,address) view returns (uint256)",
]);
export function rpc(options = {}) {
  const calls = [], decoded = []; let headers = 0, chains = 0;
  return { calls, decoded, async request(query) {
    calls.push(structuredClone(query));
    if (options.failMethod === query.method) throw Error("Dummy provider failure");
    if (query.method === "eth_chainId") {
      const key = ++chains === 1 ? "chain" : "afterChain";
      return Object.hasOwn(options, key) ? options[key] : "0x2105";
    }
    if (query.method === "eth_getBlockByNumber") {
      const key = ++headers === 1 ? "before" : "after";
      return Object.hasOwn(options, key) ? options[key] : { number: "0x4d2", hash: HASH };
    }
    if (query.method === "eth_getCode") return options.codeFor ? options.codeFor(query.params[0]) : Object.hasOwn(options, "bytecode") ? options.bytecode : "0x60006000";
    if (query.method === "eth_getBalance") return Object.hasOwn(options, "balance") ? options.balance : "0x123";
    if (query.method === "eth_call") {
      const call = { ...decodeFunctionData({ abi: ABI, data: query.params[0].data }), address: query.params[0].to };
      decoded.push(call);
      if (options.rawFor && Object.hasOwn(options.rawFor, call.functionName)) return options.rawFor[call.functionName];
      const values = {
        balanceOf: 320n, allowance: 15n, getPool: POOL, isPool: true,
        token0: DEPLOYED_TOKEN.contractAddress, token1: USDC, stable: false,
        getReserves: [2000000n * 10n ** 18n, 100000000n, 1789000000n],
        decimals: call.address.toLowerCase() === USDC ? 6 : 18,
        getAmountOut: 19000000000000000000000n,
        ...options.values,
      };
      return encodeFunctionResult({ abi: ABI, functionName: call.functionName, result: values[call.functionName] });
    }
    throw Error("Forbidden RPC " + query.method);
  } };
}
