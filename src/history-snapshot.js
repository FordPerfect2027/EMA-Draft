import { MAX_UINT256 } from "./history-log.js";

/** Read a mined header at an exact height; copy fields from mutable adapters. */
export async function historyBlock(client, number, fail) {
  const result = await client.getBlock({ blockNumber: number, includeTransactions: false });
  if (result === null) fail("BLOCK_UNAVAILABLE", "The history block is unavailable");
  if (!result || typeof result.number !== "bigint" ||
      result.number < 0n || result.number > MAX_UINT256 || result.number !== number ||
      typeof result.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result.hash)) {
    fail("INVALID_BLOCK_HEADER", "Expected the requested mined block number and complete hash");
  }
  return Object.freeze({ number, hash: result.hash.toLowerCase() });
}

/**
 * Check every returned event against the provider's header at that height,
 * then recheck the sampled end block and network. Calls are sequential and
 * deduplicated by height, bounded by the caller's existing event-count limit.
 * This detects observed replacements, not an independent chain proof or
 * completeness of range-based getLogs responses.
 */
export async function verifyHistorySnapshot(client, anchor, events, chainId, fail) {
  const hashes = new Map([[anchor.number.toString(), anchor.hash]]);
  for (const event of events) {
    if (!hashes.has(event.blockNumber)) {
      const header = await historyBlock(client, BigInt(event.blockNumber), fail);
      hashes.set(event.blockNumber, header.hash);
    }
    if (hashes.get(event.blockNumber) !== event.blockHash) {
      fail("LOG_BLOCK_CHANGED", "An event no longer matches the provider's block at its height");
    }
  }
  if (await client.getChainId() !== chainId) {
    fail("NETWORK_CHANGED", "The history provider changed networks during inspection");
  }
  const final = await historyBlock(client, anchor.number, fail);
  if (final.hash !== anchor.hash) {
    fail("BLOCK_CHANGED", "The sampled history block changed during inspection");
  }
}
