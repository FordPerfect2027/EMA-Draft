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
import { createPublicClient, http } from "viem";
import { inspectAccountTransfers } from "../src/transfer-history.js";

function parseBlock(value) {
  if (value === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("Block numbers must be nonnegative decimal integers");
  }
  return BigInt(value);
}

const [accountAddress, fromInput, toInput, ...extra] = process.argv.slice(2);
if (!accountAddress || extra.length) {
  process.stderr.write(
    "Usage: node scripts/inspect-transfers.js PUBLIC_ACCOUNT [FROM_BLOCK] [TO_BLOCK]\n",
  );
  process.exit(2);
}
try {
  const rpcUrl = process.env.THREECORE_READONLY_LOG_RPC ?? "https://base-rpc.publicnode.com";
  const rpc = new URL(rpcUrl);
  if (rpc.protocol !== "https:" || rpc.username || rpc.password || rpc.search || rpc.hash) {
    throw new Error("Read-only RPC must be a HTTPS URL without credentials or query values");
  }
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 12000 }),
  });
  const from = parseBlock(fromInput);
  const to = parseBlock(toInput);
  const snapshotTip = await client.getBlockNumber();
  const end = to ?? snapshotTip;
  const start = from ?? (end >= 249n ? end - 249n : 0n);
  const report = await inspectAccountTransfers(client, {
    accountAddress, fromBlock: start, toBlock: end,
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    "Read-only Transfer history failed: " +
    (error?.code ?? "RPC_ERROR") + " " +
    (error?.message ?? String(error)) + "\n",
  );
  process.exitCode = 1;
}
