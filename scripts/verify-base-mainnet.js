#!/usr/bin/env node
/**
 * Read-only deployed token identity verification. No wallet connection,
 * signing credentials, approvals, or transaction submission.
 */
import { createPublicClient } from "viem";
import { createReadOnlyHttp } from "../src/read-only-http.js";
import { base } from "viem/chains";
import { DEPLOYED_TOKEN, TokenIdentityError, verifyDeployedToken } from "../src/onchain-identity.js";

const rpcUrl = process.env.BASE_MAINNET_READ_RPC_URL || "https://mainnet.base.org";
try {
  const publicClient = createPublicClient({
    chain: base,
    transport: createReadOnlyHttp(rpcUrl),
  });
  const report = await verifyDeployedToken(publicClient);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  // Transport messages can contain authenticated RPC URLs or response data.
  const code = error instanceof TokenIdentityError ? error.code : "RPC_ERROR";
  process.stderr.write(
    "Read-only " + DEPLOYED_TOKEN.tokenSymbol + " verification failed: " +
      code + "\n",
  );
  process.exitCode = 1;
}
