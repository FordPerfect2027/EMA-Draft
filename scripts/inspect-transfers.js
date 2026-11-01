#!/usr/bin/env node
/**
 * Query a strictly bounded range of public Transfer logs for this token.
 * Requires only a PUBLIC EVM address; never provide keys or seed phrases.
 *
 * Usage: node scripts/inspect-transfers.js PUBLIC_ACCOUNT [FROM_BLOCK] [TO_BLOCK]
 *
 * Default: the last 250 Base Mainnet blocks at a captured tip. This is NOT
 * a full transaction history or balance, and it never executes a trade.
 */
import { base } from "viem/chains";
import { createPublicClient } from "viem";
import { createReadOnlyHttp } from "../src/read-only-http.js";
import { TransferHistoryError, TRANSFER_HISTORY_LIMITS, inspectAccountTransfers } from "../src/transfer-history.js";
import { HistoryCliInputError, parseHistoryCli, historyRpcUrl } from "../src/history-cli-input.js";

try {
  const { address: accountAddress, from, to } = parseHistoryCli(process.argv.slice(2), TRANSFER_HISTORY_LIMITS.maximumBlockSpan);
  const rpcUrl = historyRpcUrl(process.env.THREECORE_READONLY_LOG_RPC ?? "https://base-rpc.publicnode.com");
  const client = createPublicClient({
    chain: base,
    transport: createReadOnlyHttp(rpcUrl),
  });
  const end = to ?? await client.getBlockNumber({ cacheTime: 0 });
  const start = from ?? (end >= 249n ? end - 249n : 0n);
  const report = await inspectAccountTransfers(client, {
    accountAddress, fromBlock: start, toBlock: end,
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  const inputError = error instanceof HistoryCliInputError;
  const code = inputError || error instanceof TransferHistoryError ? error.code : "RPC_ERROR";
  process.stderr.write(
    "Read-only Transfer history failed: " + code + "\n",
  );
  if (inputError) process.stderr.write("Usage: node scripts/inspect-transfers.js PUBLIC_ACCOUNT [FROM_BLOCK] [TO_BLOCK]\n");
  process.exitCode = inputError ? 2 : 1;
}
