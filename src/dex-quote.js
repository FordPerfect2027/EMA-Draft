/**
 * Read-only Aerodrome Classic pool quote for this deployed ThreeCore token.
 *
 * Uses Base Mainnet PoolFactory to discover a registered volatile TOKEN/USDC
 * pool, then invokes the pool's fee-aware getAmountOut view method. Every
 * contract read uses one observed block. No wallet, signature, allowance
 * change, transaction, or token movement is involved.
 *
 * A quote is NOT a guaranteed executable price. It is NOT a trade order.
 * Derived from the Aerodrome official Pool.sol and PoolFactory.sol interfaces.
 */
import { parseAbi } from "viem";
import { DEPLOYED_TOKEN } from "./onchain-identity.js";

export const CLASSIC_DEX = Object.freeze({
  chainId: 8453,
  factory: "0x420dd381b31aef6683db6b902084cb0ffece40da",
  usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  usdcDecimals: 6,
  stable: false,
});

const FACTORY_ABI = parseAbi([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
  "function isPool(address pool) view returns (bool)",
]);
const POOL_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function stable() view returns (bool)",
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 timestamp)",
  "function getAmountOut(uint256 amountIn, address tokenIn) view returns (uint256)",
]);
const DECIMALS_ABI = parseAbi(["function decimals() view returns (uint8)"]);
const ZERO = "0x" + "0".repeat(40);
const MAX_UINT256 = (1n << 256n) - 1n;

export class DexQuoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DexQuoteError";
    this.code = code;
  }
}
function fail(code, message) {
  throw new DexQuoteError(code, message);
}
function addr(value) {
  if (typeof value !== "string" || !/^0x[\da-fA-F]{40}$/.test(value)) {
    fail("INVALID_ADDRESS_RESULT", "Invalid contract address returned by RPC");
  }
  return value.toLowerCase();
}
function amount(value) {
  if (typeof value !== "bigint" || value < 0n || value > MAX_UINT256) {
    fail("INVALID_RPC_RESULT", "A nonnegative uint256 bigint is required");
  }
  return value;
}

/**
 * @param {object} client Read-only viem publicClient.
 * @param {object} options
 * @param {"buy"|"sell"} options.direction
 *   buy = USDC to ThreeCore token; sell = token to USDC
 * @param {bigint} options.amountInBaseUnits
 *   Units of the input token; no float/price rounding.
 */
export async function quoteClassicDex(client, {
  direction = "buy",
  amountInBaseUnits = direction === "buy" ? 1000000n : 10n ** 18n,
} = {}) {
  if (!["buy", "sell"].includes(direction)) {
    fail("INVALID_DIRECTION", "Choose buy (USDC) or sell (ThreeCore token)");
  }
  if (typeof amountInBaseUnits !== "bigint" ||
      amountInBaseUnits <= 0n || amountInBaseUnits > MAX_UINT256) {
    fail("INVALID_AMOUNT", "Quote input must be positive base-unit bigint");
  }
  if (!client || !["getChainId", "getBlockNumber", "getBytecode", "readContract"].every(
    method => typeof client[method] === "function",
  )) {
    fail("INVALID_CLIENT", "Read-only viem public client is required");
  }
  const chainId = await client.getChainId();
  if (chainId !== CLASSIC_DEX.chainId) fail("WRONG_CHAIN", "Base Mainnet is required");
  const block = amount(await client.getBlockNumber());
  const factory = CLASSIC_DEX.factory;
  const token = DEPLOYED_TOKEN.contractAddress.toLowerCase();
  const usdc = CLASSIC_DEX.usdc;

  async function read(address, abi, functionName, args = []) {
    return client.readContract({
      address, abi, functionName, args, blockNumber: block,
    });
  }
  const poolValue = await read(factory, FACTORY_ABI, "getPool",
    [DEPLOYED_TOKEN.contractAddress, usdc, false]);
  const pool = addr(poolValue);
  if (pool === ZERO) fail("NO_POOL", "Aerodrome Classic volatile pair is absent");
  const [isPool, bytecode] = await Promise.all([
    read(factory, FACTORY_ABI, "isPool", [poolValue]),
    client.getBytecode({ address: poolValue, blockNumber: block }),
  ]);
  if (isPool !== true) fail("UNREGISTERED_POOL", "PoolFactory does not recognize pool");
  if (typeof bytecode !== "string" ||
      !/^0x(?:[\da-fA-F]{2})+$/.test(bytecode)) {
    fail("MISSING_POOL_CODE", "The pool has no deployed EVM bytecode");
  }

  const [t0Value, t1Value, stable, reserves, decimalsToken, decimalsUsdc] =
    await Promise.all([
      read(poolValue, POOL_ABI, "token0"),
      read(poolValue, POOL_ABI, "token1"),
      read(poolValue, POOL_ABI, "stable"),
      read(poolValue, POOL_ABI, "getReserves"),
      read(DEPLOYED_TOKEN.contractAddress, DECIMALS_ABI, "decimals"),
      read(usdc, DECIMALS_ABI, "decimals"),
    ]);
  const t0 = addr(t0Value);
  const t1 = addr(t1Value);
  if (t0 === t1 || ![t0, t1].includes(token) ||
      ![t0, t1].includes(usdc) || stable !== false) {
    fail("PAIR_MISMATCH", "Pool does not match the expected volatile ThreeCore/USDC pair");
  }
  if (!Array.isArray(reserves) || reserves.length !== 3 ||
      reserves.some(value => typeof value !== "bigint" || value < 0n)) {
    fail("INVALID_RESERVES", "Pool reserves are malformed");
  }
  if (decimalsToken !== DEPLOYED_TOKEN.decimals ||
      decimalsUsdc !== CLASSIC_DEX.usdcDecimals) {
    fail("DECIMALS_MISMATCH", "Token or USDC decimals differ from published contracts");
  }
  const [reserve0, reserve1] = reserves.map(value => amount(value));
  const reserveToken = t0 === token ? reserve0 : reserve1;
  const reserveUsdc = t0 === usdc ? reserve0 : reserve1;
  const isBuy = direction === "buy";
  const reserveIn = isBuy ? reserveUsdc : reserveToken;
  const reserveOut = isBuy ? reserveToken : reserveUsdc;
  if (reserveIn === 0n || reserveOut === 0n) {
    fail("EMPTY_POOL", "Pool reserves are empty");
  }
  const tokenIn = isBuy ? usdc : DEPLOYED_TOKEN.contractAddress;
  const quotedOut = amount(await read(poolValue, POOL_ABI,
    "getAmountOut", [amountInBaseUnits, tokenIn]));
  if (quotedOut === 0n || quotedOut >= reserveOut) {
    fail("INVALID_QUOTE", "Pool returned a zero or invalid output");
  }

  // Reconfirm the network after block-pinned reads: RPC providers can switch
  // chains while a quote is pending, producing a misleading snapshot.
  if (await client.getChainId() !== CLASSIC_DEX.chainId) {
    fail("NETWORK_CHANGED", "RPC network changed during the read-only quote");
  }

  return Object.freeze({
    agent: DEPLOYED_TOKEN.tokenSymbol,
    network: "Base Mainnet",
    chainId,
    blockNumber: block.toString(),
    dex: "Aerodrome Classic",
    factoryAddress: factory,
    poolAddress: pool,
    direction,
    inputToken: tokenIn.toLowerCase(),
    outputToken: isBuy ? token : usdc,
    inputDecimals: isBuy ? CLASSIC_DEX.usdcDecimals : DEPLOYED_TOKEN.decimals,
    outputDecimals: isBuy ? DEPLOYED_TOKEN.decimals : CLASSIC_DEX.usdcDecimals,
    inputBaseUnits: amountInBaseUnits.toString(),
    quotedOutputBaseUnits: quotedOut.toString(),
    reserveInBaseUnits: reserveIn.toString(),
    reserveOutBaseUnits: reserveOut.toString(),
    registeredPool: true,
    feeIncludedByPoolQuote: true,
    readOnly: true,
    walletConnected: false,
    thirdPartyWebsiteConnected: false,
    tradeExecuted: false,
    approvalGranted: false,
    securityAudited: false,
  });
}
