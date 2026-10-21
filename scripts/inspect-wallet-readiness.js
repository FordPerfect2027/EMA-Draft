#!/usr/bin/env node
/**
 * Inspect one public EVM wallet's ThreeCore token readiness on Base Mainnet.
 * Usage: node scripts/inspect-wallet-readiness.js PUBLIC_ACCOUNT_ADDRESS
 *
 * Never supply private keys, seed phrases, access tokens or account secrets.
 * This command does not connect to a browser wallet, grant an allowance,
 * sign a message, send tokens, trade on a DEX or verify dApp safety.
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { inspectWalletReadiness } from "../src/wallet-readiness.js";

const [publicWalletAddress, ...extra] = process.argv.slice(2);
if (!publicWalletAddress || extra.length) {
  process.stderr.write(
    "Usage: node scripts/inspect-wallet-readiness.js PUBLIC_EVM_WALLET_ADDRESS\n",
  );
  process.exit(2);
}
if (!/^0x[0-9a-fA-F]{40}$/.test(publicWalletAddress)) {
  process.stderr.write("Provide a complete public EVM address, not private credentials.\n");
  process.exit(2);
}
try {
  const client = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org", {
      timeout: 12000, retryCount: 0,
    }),
  });
  const report = await inspectWalletReadiness(client, publicWalletAddress);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    "Read-only Wallet readiness check failed: " +
    (error?.code ?? "RPC_ERROR") + " " +
    (error?.message ?? String(error)) + "\n",
  );
  process.exitCode = 1;
}
