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
import { ApprovalHistoryError, APPROVAL_LIMITS, inspectApprovalHistory } from "../src/approval-history.js";
import { HistoryCliInputError, parseHistoryCli, historyRpcUrl } from "../src/history-cli-input.js";

try {
  const { address: ownerAddress, from, to } = parseHistoryCli(process.argv.slice(2), APPROVAL_LIMITS.maximumBlockSpan);
  const rpcUrl = historyRpcUrl(process.env.THREECORE_READONLY_LOG_RPC ?? "https://base-rpc.publicnode.com");
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  const end = to ?? await client.getBlockNumber({ cacheTime: 0 });
  const start = from ?? (end >= 249n ? end - 249n : 0n);
  const report = await inspectApprovalHistory(client, {
    ownerAddress, fromBlock: start, toBlock: end,
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  const inputError = error instanceof HistoryCliInputError;
  const code = inputError || error instanceof ApprovalHistoryError ? error.code : "RPC_ERROR";
  process.stderr.write(
    "Read-only Approval inspection failed: " + code + "\n",
  );
  if (inputError) process.stderr.write("Usage: node scripts/inspect-approvals.js PUBLIC_WALLET [START_BLOCK] [END_BLOCK]\n");
  process.exitCode = inputError ? 2 : 1;
}
