/**
 * Historical ERC-20 Approval events for this token, anchored to a Base block.
 *
 * This is a READ-ONLY audit aid, not a wallet connection or authorization.
 * Approval events are NOT a substitute for the sampled current allowance:
 * ERC-20 transferFrom can consume allowance without emitting Approval.
 */
import { erc20Abi, parseAbiItem } from "viem";
import { DEPLOYED_TOKEN } from "./onchain-identity.js";
import { CLASSIC_ROUTER } from "./wallet-readiness.js";
import { MAX_UINT256, historyLogIdentity, createHistoryIndex } from "./history-log.js";
import { historyBlock, verifyHistorySnapshot } from "./history-snapshot.js";

const ZERO_ADDRESS = "0x" + "0".repeat(40);
export const APPROVAL_EVENT = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);
export const APPROVAL_LIMITS = Object.freeze({
  maximumBlockSpan: 2000n,
  maximumLogs: 500,
});

export class ApprovalHistoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ApprovalHistoryError";
    this.code = code;
  }
}
function reject(code, message) {
  throw new ApprovalHistoryError(code, message);
}
function address(input) {
  if (typeof input !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(input) ||
      input.toLowerCase() === ZERO_ADDRESS) {
    reject("INVALID_ADDRESS", "A public, nonzero 20-byte EVM address is required");
  }
  return input.toLowerCase();
}
function height(input) {
  if (typeof input !== "bigint" || input < 0n || input > MAX_UINT256) {
    reject("INVALID_BLOCK", "Block numbers must be uint256 bigint values");
  }
  return input;
}
function validatedEvent(log, owner, spender, fromBlock, toBlock) {
  const identity = historyLogIdentity(log, reject);
  if (!log.args ||
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== DEPLOYED_TOKEN.contractAddress.toLowerCase() ||
      typeof log.args.value !== "bigint" || log.args.value < 0n ||
      log.args.value > MAX_UINT256) {
    reject("INVALID_LOG", "Malformed ERC-20 Approval log");
  }
  const logOwner = address(log.args.owner);
  const logSpender = address(log.args.spender);
  if (owner !== logOwner || spender !== logSpender) {
    reject("WRONG_LOG_FILTER", "RPC returned a different owner or spender");
  }
  const blockNumber = height(log.blockNumber);
  if (blockNumber < fromBlock || blockNumber > toBlock) {
    reject("LOG_OUT_OF_RANGE", "Approval event outside requested block range");
  }
  return Object.freeze({
    ...identity,
    blockNumber: blockNumber.toString(),
    owner: logOwner,
    spender: logSpender,
    approvedAmountBaseUnits: log.args.value.toString(),
    revocationEvent: log.args.value === 0n,
  });
}

/**
 * Read bounded Approval events plus allowance(owner,spender) at a single
 * sampled block. Spender defaults to the published Aerodrome Classic Router.
 * Other spender inputs are arbitrary, explicitly supplied PUBLIC addresses.
 *
 * The sampled allowance may differ from the last Approval event because
 * transferFrom can consume it; the report deliberately does not call a
 * changed allowance malicious or authorize spending.
 */
export async function inspectApprovalHistory(publicClient, {
  ownerAddress, spenderAddress = CLASSIC_ROUTER, fromBlock, toBlock,
} = {}) {
  const owner = address(ownerAddress);
  const spender = address(spenderAddress);
  const from = height(fromBlock);
  if (!publicClient ||
      !["getChainId", "getBlockNumber", "getBlock", "getLogs", "readContract"].every(
        method => typeof publicClient[method] === "function",
      )) {
    reject("INVALID_CLIENT", "Read-only public viem client required");
  }
  const chainId = await publicClient.getChainId();
  if (chainId !== DEPLOYED_TOKEN.chainId) {
    reject("WRONG_NETWORK", "Only Base Mainnet is supported");
  }
  const tip = height(await publicClient.getBlockNumber({ cacheTime: 0 }));
  const to = toBlock === undefined ? tip : height(toBlock);
  if (to > tip || from > to || to - from + 1n > APPROVAL_LIMITS.maximumBlockSpan) {
    reject("INVALID_RANGE", "Invalid or excessive Approval event block range");
  }
  const anchor = await historyBlock(publicClient, to, reject);

  const [rawLogs, allowance] = await Promise.all([
    publicClient.getLogs({
      address: DEPLOYED_TOKEN.contractAddress,
      event: APPROVAL_EVENT,
      args: { owner, spender },
      fromBlock: from,
      toBlock: to,
    }),
    publicClient.readContract({
      address: DEPLOYED_TOKEN.contractAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
      blockHash: anchor.hash,
      requireCanonical: true,
    }),
  ]);
  if (!Array.isArray(rawLogs) || rawLogs.length > APPROVAL_LIMITS.maximumLogs) {
    reject("LOG_LIMIT", "RPC Approval log response is not bounded");
  }
  if (typeof allowance !== "bigint" || allowance < 0n || allowance > MAX_UINT256) {
    reject("INVALID_ALLOWANCE", "RPC returned an invalid allowance");
  }
  const indexed = createHistoryIndex(reject);
  for (const log of rawLogs) {
    indexed.add(validatedEvent(log, owner, spender, from, to));
  }
  const events = indexed.values().sort((a, b) =>
    BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 :
    BigInt(a.blockNumber) > BigInt(b.blockNumber) ? 1 :
    a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex,
  );
  await verifyHistorySnapshot(publicClient, anchor, events, chainId, reject);
  return Object.freeze({
    agent: DEPLOYED_TOKEN.tokenSymbol,
    contractAddress: DEPLOYED_TOKEN.contractAddress,
    chainId,
    ownerAddress: owner,
    spenderAddress: spender,
    classicRouterSpender: spender === CLASSIC_ROUTER,
    fromBlock: from.toString(),
    toBlock: to.toString(),
    toBlockHash: anchor.hash,
    observedTipBlock: tip.toString(),
    allowanceAtSampleBlockBaseUnits: allowance.toString(),
    approvalEvents: Object.freeze(events),
    eventHistoryIsNotAllowanceBalance: true,
    historyComplete: false,
    canonicalityVerified: false,
    logBlockHashesChecked: true,
    endBlockRechecked: true,
    readOnly: true,
    transactionSent: false,
    approvalGranted: false,
  });
}
