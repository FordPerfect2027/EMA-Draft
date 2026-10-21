/**
 * Read-only, bounded ERC-20 Transfer history for one ThreeCore token/account.
 * No wallet permissions, signing, approvals, transfers, or key access.
 * Transfer logs are historical events, NOT a reliable current-balance oracle.
 */
import { parseAbiItem } from "viem";
import { DEPLOYED_TOKEN } from "./onchain-identity.js";
import { MAX_UINT256, historyLogIdentity, createHistoryIndex } from "./history-log.js";
import { historyBlock, verifyHistorySnapshot } from "./history-snapshot.js";

export const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
export const TRANSFER_HISTORY_LIMITS = Object.freeze({
  maximumBlockSpan: 2000n,
  maximumLogsPerDirection: 500,
});
const ZERO_ADDRESS = "0x" + "0".repeat(40);

export class TransferHistoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TransferHistoryError";
    this.code = code;
  }
}
function fail(code, message) {
  throw new TransferHistoryError(code, message);
}
function normalAddress(value, allowZero = false) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value) ||
      (!allowZero && value.toLowerCase() === ZERO_ADDRESS)) {
    fail("INVALID_ADDRESS", "A valid nonzero public EVM account is required");
  }
  return value.toLowerCase();
}
function validBlock(value) {
  if (typeof value !== "bigint" || value < 0n || value > MAX_UINT256) {
    fail("INVALID_BLOCK", "Block numbers must be uint256 bigint values");
  }
  return value;
}
function validatedLog(log, account, observedFrom, observedTo, filter) {
  const identity = historyLogIdentity(log, fail);
  if (!log.args ||
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== DEPLOYED_TOKEN.contractAddress.toLowerCase()) {
    fail("INVALID_LOG", "Malformed ERC-20 Transfer log");
  }
  const from = normalAddress(log.args.from, true);
  const to = normalAddress(log.args.to, true);
  if (from !== account && to !== account) {
    fail("UNRELATED_LOG", "Provider returned an unrelated Transfer event");
  }
  if ((filter === "from" ? from : to) !== account) {
    fail("WRONG_LOG_FILTER", "RPC returned a Transfer event outside the requested direction");
  }
  if (typeof log.args.value !== "bigint" || log.args.value < 0n || log.args.value > MAX_UINT256) {
    fail("INVALID_LOG", "Token event amount must be a uint256 bigint");
  }
  const block = validBlock(log.blockNumber);
  if (block < observedFrom || block > observedTo) {
    fail("INVALID_LOG", "Transfer event is outside the snapshot block range");
  }
  const amount = log.args.value.toString();
  const direction = from === account && to === account ? "self" :
    to === account ? "incoming" : "outgoing";
  return Object.freeze({
    blockNumber: block.toString(),
    ...identity,
    from,
    to,
    amountBaseUnits: amount,
    direction,
    mintEvent: from === ZERO_ADDRESS,
    burnEvent: to === ZERO_ADDRESS,
  });
}

/**
 * Query a short, explicitly bounded Base Mainnet block window. Logs for sender
 * and receiver are deduplicated so self-transfers count once. Results are
 * historical event evidence, not a list of wallet holdings or transfers
 * automatically authorized by the holder.
 */
export async function inspectAccountTransfers(publicClient, {
  accountAddress,
  fromBlock,
  toBlock,
} = {}) {
  const account = normalAddress(accountAddress);
  const start = validBlock(fromBlock);
  if (!publicClient || !["getChainId", "getBlockNumber", "getBlock", "getLogs"].every(
    name => typeof publicClient[name] === "function",
  )) fail("INVALID_CLIENT", "Read-only viem public client required");
  const chainId = await publicClient.getChainId();
  if (chainId !== DEPLOYED_TOKEN.chainId) {
    fail("WRONG_NETWORK", "Transfer history requires Base Mainnet");
  }
  const tip = validBlock(await publicClient.getBlockNumber({ cacheTime: 0 }));
  const end = toBlock === undefined ? tip : validBlock(toBlock);
  if (end > tip || end < start ||
      end - start + 1n > TRANSFER_HISTORY_LIMITS.maximumBlockSpan) {
    fail("INVALID_RANGE", "Block range is invalid or exceeds 2000 blocks");
  }
  const anchor = await historyBlock(publicClient, end, fail);

  const common = Object.freeze({
    address: DEPLOYED_TOKEN.contractAddress,
    event: TRANSFER_EVENT,
    fromBlock: start,
    toBlock: end,
  });
  const [sent, received] = await Promise.all([
    publicClient.getLogs({ ...common, args: { from: account } }),
    publicClient.getLogs({ ...common, args: { to: account } }),
  ]);
  if (!Array.isArray(sent) || !Array.isArray(received) ||
      sent.length > TRANSFER_HISTORY_LIMITS.maximumLogsPerDirection ||
      received.length > TRANSFER_HISTORY_LIMITS.maximumLogsPerDirection) {
    fail("LOG_LIMIT", "RPC log response is invalid or exceeds the local limit");
  }
  const seen = createHistoryIndex(fail);
  for (const [logs, filter] of [[sent, "from"], [received, "to"]]) {
    for (const log of logs) {
      seen.add(validatedLog(log, account, start, end, filter));
    }
  }
  const ordered = seen.values().sort((a, b) =>
    BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 :
    BigInt(a.blockNumber) > BigInt(b.blockNumber) ? 1 :
    a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex,
  );
  await verifyHistorySnapshot(publicClient, anchor, ordered, chainId, fail);
  return Object.freeze({
    agent: DEPLOYED_TOKEN.tokenSymbol,
    contractAddress: DEPLOYED_TOKEN.contractAddress,
    chainId,
    accountAddress: account,
    fromBlock: start.toString(),
    toBlock: end.toString(),
    toBlockHash: anchor.hash,
    observedTipBlock: tip.toString(),
    events: Object.freeze(ordered),
    historicalOnly: true,
    canonicalityVerified: false,
    logBlockHashesChecked: true,
    endBlockRechecked: true,
    historyComplete: false,
    signed: false,
    transactionSent: false,
    allowanceChanged: false,
  });
}
