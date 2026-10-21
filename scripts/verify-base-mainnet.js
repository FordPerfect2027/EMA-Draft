#!/usr/bin/env node
/**
 * Read-only deployed token identity verification. No wallet connection,
 * signing credentials, approvals, or transaction submission.
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { DEPLOYED_TOKEN, verifyDeployedToken } from "../src/onchain-identity.js";

const rpcUrl = process.env.BASE_MAINNET_READ_RPC_URL || "https://mainnet.base.org";
try {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { retryCount: 0, timeout: 12000 }),
  });
  const report = await verifyDeployedToken(publicClient);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    "Read-only " + DEPLOYED_TOKEN.tokenSymbol + " verification failed: " +
      (error?.code ?? "RPC_ERROR") + " " + (error?.message ?? String(error)) + "\n",
  );
  process.exitCode = 1;
}
