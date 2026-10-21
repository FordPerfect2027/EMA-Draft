#!/usr/bin/env node
/**
 * Aerodrome Classic TOKEN/USDC quote on Base Mainnet (read-only).
 *
 * node scripts/quote-dex.js buy 1000000                # 1 USDC into token
 * node scripts/quote-dex.js sell 1000000000000000000   # 1 token into USDC
 *
 * Exact raw input base units must be supplied. The quote will change as
 * liquidity, trading fees and routes change. THIS IS NOT A TRADE OR ORDER.
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { quoteClassicDex } from "../src/dex-quote.js";

const [direction = "buy", input = direction === "buy"
  ? "1000000" : "1000000000000000000", ...extra] = process.argv.slice(2);
if (extra.length || !["buy", "sell"].includes(direction) ||
    !/^[1-9][0-9]*$/.test(input)) {
  process.stderr.write(
    "Usage: node scripts/quote-dex.js buy|sell POSITIVE_INTEGER_BASE_UNITS\n",
  );
  process.exit(2);
}
try {
  const rpcUrl = process.env.BASE_MAINNET_READ_RPC_URL ||
    "https://mainnet.base.org";
  const url = new URL(rpcUrl);
  if (url.protocol !== "https:" || url.username ||
      url.password || url.search || url.hash) {
    throw Error("Read-only Base RPC must be HTTPS without secrets in its URL");
  }
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { retryCount: 0, timeout: 12000 }),
  });
  const result = await quoteClassicDex(client, {
    direction, amountInBaseUnits: BigInt(input),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    DEPLOYED_TOKEN.tokenSymbol + " read-only DEX quote failed: " +
    (error?.code ?? "RPC_ERROR") + " " +
    (error?.message ?? String(error)) + "\n",
  );
  process.exitCode = 1;
}
