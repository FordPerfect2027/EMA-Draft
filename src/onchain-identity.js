/**
 * Read-only Base Mainnet identity check for the deployed EMA contract.
 * Observations are pinned to one block. No private keys or tx methods.
 * IMPORTANT: this does not deploy or modify the existing token contract.
 */
import { erc20Abi } from "viem";

export const DEPLOYED_TOKEN = Object.freeze({
  chainId: 8453,
  contractAddress: "0xBaE0933d509b83B7bbAb3AaB9feD413504382a76",
  tokenName: "EMA CORE",
  tokenSymbol: "EMA",
  decimals: 18,
  supplyUnits: "777000000",
});

export class TokenIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TokenIdentityError";
    this.code = code;
  }
}
function reject(code, message) {
  throw new TokenIdentityError(code, message);
}

/**
 * Uses viem publicClient only. All values are read at the same block.
 * When reading fails or a token does not match its published identity,
 * the check fails closed and does not report verification success.
 */
export async function verifyDeployedToken(publicClient, expected = DEPLOYED_TOKEN) {
  if (!publicClient || typeof publicClient.getChainId !== "function" ||
      typeof publicClient.getBlockNumber !== "function" ||
      typeof publicClient.getBytecode !== "function" ||
      typeof publicClient.readContract !== "function") {
    reject("INVALID_CLIENT", "A read-only viem public client is required");
  }
  const chainId = await publicClient.getChainId();
  if (chainId !== expected.chainId) {
    reject("WRONG_NETWORK", "Connected RPC chain does not match Base Mainnet");
  }
  const blockNumber = await publicClient.getBlockNumber();
  if (typeof blockNumber !== "bigint" || blockNumber < 0n) {
    reject("INVALID_BLOCK", "The RPC returned an invalid block number");
  }
  const bytecode = await publicClient.getBytecode({
    address: expected.contractAddress, blockNumber,
  });
  if (typeof bytecode !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(bytecode)) {
    reject("NO_DEPLOYED_CODE", "The expected token has no deployed bytecode");
  }
  const methods = ["name", "symbol", "decimals", "totalSupply"];
  const values = await Promise.all(methods.map((functionName) =>
    publicClient.readContract({
      address: expected.contractAddress,
      abi: erc20Abi,
      functionName,
      blockNumber,
    }),
  ));
  const [name, symbol, decimals, supply] = values;
  if (typeof name !== "string" || name !== expected.tokenName ||
      typeof symbol !== "string" || symbol !== expected.tokenSymbol ||
      decimals !== expected.decimals) {
    reject("METADATA_MISMATCH", "Deployed token metadata differs from the known address");
  }
  if (typeof supply !== "bigint" || supply < 0n) {
    reject("INVALID_SUPPLY", "Invalid totalSupply RPC value");
  }
  const supplyExpected = BigInt(expected.supplyUnits) * 10n ** BigInt(expected.decimals);
  if (supply > supplyExpected) {
    reject("SUPPLY_EXCEEDS_ISSUANCE", "Deployed totalSupply exceeds the original issuance reference");
  }

  return Object.freeze({
    network: "Base Mainnet",
    chainId,
    blockNumber: blockNumber.toString(),
    contractAddress: expected.contractAddress,
    tokenName: name,
    tokenSymbol: symbol,
    decimals,
    totalSupplyBaseUnits: supply.toString(),
    originalIssuanceTokenUnits: expected.supplyUnits,
    estimatedBurnedBaseUnits: (supplyExpected - supply).toString(),
    deployedCodePresent: true,
    readOnly: true,
    contractDeployedByCheck: false,
    transactionSent: false,
    securityAudit: false,
  });
}
