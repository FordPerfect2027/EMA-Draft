// Shared validation for decoded, mined ERC-20 history responses.
// These checks establish internal consistency, not proof of canonicality.
export const MAX_UINT256 = (1n << 256n) - 1n;
const HASH = /^0x[0-9a-fA-F]{64}$/;

export function historyLogIdentity(log, fail) {
  if (!log || typeof log !== "object") fail("INVALID_LOG", "Expected a mined event log");
  if (log.removed === true) fail("REMOVED_LOG", "Removed events cannot be reported as current history");
  if (log.removed !== false ||
      typeof log.blockHash !== "string" || !HASH.test(log.blockHash) ||
      typeof log.transactionHash !== "string" || !HASH.test(log.transactionHash) ||
      !Number.isSafeInteger(log.logIndex) || log.logIndex < 0 ||
      !Number.isSafeInteger(log.transactionIndex) || log.transactionIndex < 0) {
    fail("INVALID_LOG", "Expected a non-removed mined log with complete hashes and indices");
  }
  return {
    blockHash: log.blockHash.toLowerCase(),
    transactionHash: log.transactionHash.toLowerCase(),
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
  };
}

export function createHistoryIndex(fail) {
  const events = new Map(), blocks = new Map(), blockNumbers = new Map(), transactions = new Map();
  const transactionSlots = new Map(), logSlots = new Map();
  function bind(map, key, value) {
    if (map.has(key) && map.get(key) !== value) {
      fail("CONFLICTING_LOG", "RPC logs disagree about a block, transaction or event position");
    }
    map.set(key, value);
  }
  return {
    add(entry) {
      bind(blocks, entry.blockNumber, entry.blockHash);
      bind(blockNumbers, entry.blockHash, entry.blockNumber);
      bind(transactions, entry.transactionHash,
        entry.blockHash + ":" + entry.blockNumber + ":" + entry.transactionIndex);
      bind(transactionSlots, entry.blockHash + ":" + entry.transactionIndex, entry.transactionHash);
      bind(logSlots, entry.blockHash + ":" + entry.logIndex, entry.transactionHash);
      const key = entry.transactionHash + ":" + entry.logIndex;
      const previous = events.get(key);
      // Entries contain only normalized JSON scalars, in a fixed field order.
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) {
        fail("CONFLICTING_LOG", "The same event carries conflicting values");
      }
      if (!previous) events.set(key, entry);
    },
    values() { return [...events.values()]; },
  };
}
