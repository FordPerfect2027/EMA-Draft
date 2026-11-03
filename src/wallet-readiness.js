/**
 * Read-only public-wallet readiness on Base Mainnet.
 *
 * Before a ThreeCore holder considers connecting to a third-party dApp,
 * check its actual token balance, native ETH gas balance and current approval
 * granted to the published Aerodrome Classic Router. All reads are pinned to
 * one block. No wallet injection, signing, transaction or approval occurs.
 *
 * A nonzero allowance is a possible exposure, not a trading authorization.
 * This module cannot verify the safety of a dApp or any quoted exchange rate.
 */
import { erc20Abi } from "viem";
import { DEPLOYED_TOKEN } from "./onchain-identity.js";
import { canonicalStateRead } from "./canonical-state-read.js";

export const CLASSIC_ROUTER = "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43";

export class WalletReadinessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WalletReadinessError";
    this.code = code;
  }
}
function fail(code, message) {
  throw new WalletReadinessError(code, message);
}
function checkAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value) ||
      /^0x0{40}$/i.test(value)) {
    fail("INVALID_ADDRESS", "A nonzero public 20-byte EVM address is required");
  }
  return value.toLowerCase();
}
function uint(value, field) {
  if (typeof value !== "bigint" || value < 0n || value >= (1n << 256n)) {
    fail("INVALID_RPC_RESULT", field + " must be a uint256 bigint");
  }
  return value;
}
function deployedCode(value, field) {
  if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value)) {
    fail("MISSING_CONTRACT", field + " has no deployed bytecode at the sampled block");
  }
}

/**
 * @param {object} publicClient - viem public client, read-only methods only
 * @param {string} walletAddress - intentionally provided public address
 */
export async function inspectWalletReadiness(publicClient, walletAddress) {
  const wallet = checkAddress(walletAddress);
  const chainId = DEPLOYED_TOKEN.chainId;
  const snapshot = await canonicalStateRead(publicClient, chainId, fail, "WRONG_NETWORK");
  const blockNumber = snapshot.blockNumber;
  // Block-pinned checks prevent treating observations from different blocks
  // as one snapshot. Code presence does NOT constitute an audit.
  const [tokenCode, routerCode] = await Promise.all([
    snapshot.getCode(DEPLOYED_TOKEN.contractAddress, "MISSING_CONTRACT"),
    snapshot.getCode(CLASSIC_ROUTER, "MISSING_CONTRACT"),
  ]);
  deployedCode(tokenCode, "Token");
  deployedCode(routerCode, "Aerodrome Classic Router");

  const [ethWei, tokenUnits, routerAllowance] = await Promise.all([
    snapshot.getBalance(wallet),
    snapshot.readContract(DEPLOYED_TOKEN.contractAddress, erc20Abi, "balanceOf", [wallet]),
    snapshot.readContract(DEPLOYED_TOKEN.contractAddress, erc20Abi, "allowance", [wallet, CLASSIC_ROUTER]),
  ]);
  const gasBalance = uint(ethWei, "native balance");
  const tokenBalance = uint(tokenUnits, "token balance");
  const allowance = uint(routerAllowance, "router allowance");
  // Recheck the chain before reporting balances and existing approvals.
  // Block pinning alone cannot detect an RPC provider switching networks.
  await snapshot.recheck();
  return Object.freeze({
    agent: DEPLOYED_TOKEN.tokenSymbol,
    chainId,
    observedBlockNumber: blockNumber.toString(),
    observedBlockHash: snapshot.blockHash,
    canonicalBlockRequired: true,
    canonicalBlockRechecked: true,
    contractAddress: DEPLOYED_TOKEN.contractAddress,
    publicWalletAddress: wallet,
    classicRouterAddress: CLASSIC_ROUTER,
    nativeGasBalanceWei: gasBalance.toString(),
    tokenBalanceBaseUnits: tokenBalance.toString(),
    existingClassicRouterAllowanceBaseUnits: allowance.toString(),
    missingNativeGas: gasBalance === 0n,
    existingClassicRouterApproval: allowance > 0n,
    readOnly: true,
    walletConnected: false,
    transactionSent: false,
    approvalGranted: false,
    contractAudited: false,
  });
}
