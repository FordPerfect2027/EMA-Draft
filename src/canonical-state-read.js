import { decodeFunctionResult, encodeFunctionData } from "viem";

const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]{0,63})$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const DATA = /^0x(?:[0-9a-f]{2})*$/i;

/** A single provider-observed snapshot. No transaction or latest/number fallback. */
export async function canonicalStateRead(client, chainId, fail, wrongChainCode) {
  if (!client || typeof client.request !== "function") {
    fail("INVALID_CLIENT", "A read-only JSON-RPC request client is required");
  }
  const request = client.request.bind(client);
  function quantity(value) {
    if (typeof value !== "string" || !QUANTITY.test(value)) {
      fail("INVALID_RPC_RESULT", "Invalid RPC unsigned quantity");
    }
    return BigInt(value);
  }
  function header(value) {
    if (!value || typeof value.hash !== "string" || !HASH.test(value.hash)) {
      fail("INVALID_BLOCK", "A numbered, hashed block is required");
    }
    return { number: quantity(value.number), hash: value.hash.toLowerCase() };
  }
  if (quantity(await request({ method: "eth_chainId" })) !== BigInt(chainId)) {
    fail(wrongChainCode, "Base Mainnet is required");
  }
  const block = header(await request({ method: "eth_getBlockByNumber", params: ["latest", false] }));
  const context = Object.freeze({ blockHash: block.hash, requireCanonical: true });
  return Object.freeze({
    blockNumber: block.number,
    blockHash: block.hash,
    async getCode(address, missingCode) {
      const data = await request({ method: "eth_getCode", params: [address, context] });
      if (typeof data === "string" && data.length > 2 + 256 * 1024 * 2) {
        fail("RPC_RESPONSE_LIMIT", "Contract code exceeds the read limit");
      }
      if (typeof data !== "string" || !DATA.test(data) || /^0x$/i.test(data)) {
        fail(missingCode, "No valid deployed code at the selected block");
      }
      return data;
    },
    async getBalance(address) {
      return quantity(await request({ method: "eth_getBalance", params: [address, context] }));
    },
    async readContract(address, abi, functionName, args = []) {
      const readAbi = abi.filter(item => item.type === "function" && item.name === functionName &&
          ["view", "pure"].includes(item.stateMutability));
      if (readAbi.length === 0) {
        fail("INVALID_READ_METHOD", "Only view or pure ABI functions are supported");
      }
      const data = await request({ method: "eth_call", params: [{ to: address,
        data: encodeFunctionData({ abi: readAbi, functionName, args }),
      }, context] });
      if (typeof data !== "string" || data.length > 8194 || !DATA.test(data)) {
        fail("INVALID_RPC_RESULT", "Invalid or oversized ABI response");
      }
      try { return decodeFunctionResult({ abi: readAbi, functionName, data }); }
      catch { fail("INVALID_RPC_RESULT", "RPC response cannot be decoded"); }
    },
    async recheck() {
      const after = header(await request({ method: "eth_getBlockByNumber", params: ["0x" + block.number.toString(16), false] }));
      if (after.number !== block.number || after.hash !== block.hash) {
        fail("BLOCK_CHANGED", "The selected block changed during the read");
      }
      if (quantity(await request({ method: "eth_chainId" })) !== BigInt(chainId)) {
        fail("NETWORK_CHANGED", "RPC network changed during the read");
      }
    },
  });
}
