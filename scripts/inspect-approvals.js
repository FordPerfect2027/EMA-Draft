#!/usr/bin/env node
/**
 * Read-only ThreeCore ERC-20 Approval history for a public wallet.
 * Examples:
 *   node scripts/inspect-approvals.js PUBLIC_WALLET
 *   node scripts/inspect-approvals.js PUBLIC_WALLET START_BLOCK END_BLOCK
 *
 * NOTE: A private key/seed phrase is NEVER an acceptable input.
 * The query returns public event history + allowance as of one block.
 * It cannot approve token spending, trade or change a wallet.
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { inspectApprovalHistory } from "../src/approval-history.js";

const [ownerAddress, firstBlock, lastBlock, ...extra] = process.argv.slice(2);
if (!ownerAddress || extra.length ||
    typeof ownerAddress !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(ownerAddress)) {
  process.stderr.write(
    "Usage: node scripts/inspect-approvals.js PUBLIC_WALLET [START_BLOCK] [END_BLOCK]\n",
  );
  process.exit(2);
}
function parsedHeight(value) {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("Block must be a nonnegative decimal integer");
  }
  return BigInt(value);
}

try {
  const rpcUrl = process.env.THREECORE_READONLY_LOG_RPC ?? "https://base-rpc.publicnode.com";
  const url = new URL(rpcUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("The public log RPC must use HTTPS without credentials or query tokens");
  }
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  const from = parsedHeight(firstBlock);
  const to = parsedHeight(lastBlock);
  const tip = await client.getBlockNumber();
  const end = to ?? tip;
  const start = from ?? (end >= 249n ? end - 249n : 0n);
  const report = await inspectApprovalHistory(client, {
    ownerAddress, fromBlock: start, toBlock: end,
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    "Read-only Approval inspection failed: " +
    (error?.code ?? "RPC_ERROR") + " " + (error?.message ?? String(error)) + "\n",
  );
  process.exitCode = 1;
}
