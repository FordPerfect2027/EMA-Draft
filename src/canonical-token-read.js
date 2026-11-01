import { decodeFunctionResult, encodeFunctionData, erc20Abi, keccak256 } from "viem";

const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const DATA = /^0x(?:[0-9a-f]{2})*$/i;
const METHODS = ["name", "symbol", "decimals", "totalSupply"];

/** Only read RPCs. Never fall back from a canonical hash to latest/number reads. */
export async function readCanonicalToken(publicClient, expectedChainId, address, fail) {
  if (!publicClient || typeof publicClient.request !== "function") {
    fail("INVALID_CLIENT", "A read-only JSON-RPC request client is required");
  }
  async function chain() {
    const value = await publicClient.request({ method: "eth_chainId" });
    if (typeof value !== "string" || !QUANTITY.test(value)) fail("INVALID_CHAIN", "Invalid RPC chain identifier");
    return BigInt(value);
  }
  function block(value) {
    if (!value || typeof value.number !== "string" || !QUANTITY.test(value.number) ||
        typeof value.hash !== "string" || !HASH.test(value.hash)) {
      fail("INVALID_BLOCK", "A numbered, hashed block is required");
    }
    return Object.freeze({ number: BigInt(value.number), hash: value.hash.toLowerCase() });
  }
  if (await chain() !== BigInt(expectedChainId)) fail("WRONG_NETWORK", "RPC chain differs from the expected network");
  const before = block(await publicClient.request({ method: "eth_getBlockByNumber", params: ["latest", false] }));
  const context = Object.freeze({ blockHash: before.hash, requireCanonical: true });
  const bytecode = await publicClient.request({ method: "eth_getCode", params: [address, context] });
  if (typeof bytecode === "string" && bytecode.length > 2 + 256 * 1024 * 2) fail("RPC_RESPONSE_LIMIT", "Contract code exceeds the read limit");
  if (typeof bytecode !== "string" || !DATA.test(bytecode) || /^0x$/i.test(bytecode)) {
    fail("NO_DEPLOYED_CODE", "The expected token has no valid deployed bytecode");
  }
  const values = await Promise.all(METHODS.map(async functionName => {
    const data = await publicClient.request({ method: "eth_call", params: [{
      to: address, data: encodeFunctionData({ abi: erc20Abi, functionName }),
    }, context] });
    if (typeof data !== "string" || data.length > 8194 || !DATA.test(data)) {
      fail("INVALID_TOKEN_RESPONSE", "Invalid or oversized token response");
    }
    try { return decodeFunctionResult({ abi: erc20Abi, functionName, data }); }
    catch { fail("INVALID_TOKEN_RESPONSE", "Token response cannot be decoded"); }
  }));
  const after = block(await publicClient.request({ method: "eth_getBlockByNumber", params: ["0x" + before.number.toString(16), false] }));
  if (before.number !== after.number || before.hash !== after.hash) fail("BLOCK_CHANGED", "The selected canonical block changed during verification");
  if (await chain() !== BigInt(expectedChainId)) fail("CHAIN_CHANGED", "RPC network changed during verification");
  return Object.freeze({ blockNumber: before.number.toString(), blockHash: before.hash,
    runtimeBytecodeKeccak256: keccak256(bytecode), values: Object.freeze(values) });
}
