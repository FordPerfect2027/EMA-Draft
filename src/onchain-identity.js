/**
 * Read-only Base Mainnet identity check for the registered token contract.
 * Observations are pinned to one block. No private keys or tx methods.
 * IMPORTANT: this does not deploy or modify the existing token contract.
 */
import { readCanonicalToken } from "./canonical-token-read.js";

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
 * Uses viem publicClient only. Every state read requires the same canonical hash.
 * When reading fails or a token does not match its published identity,
 * the check fails closed and does not report verification success.
 */
export async function verifyDeployedToken(publicClient, expected = DEPLOYED_TOKEN) {
  expected = { ...expected };
  if (expected.chainId !== 8453 || typeof expected.contractAddress !== "string" ||
      !/^0x[\da-fA-F]{40}$/.test(expected.contractAddress) ||
      !Number.isInteger(expected.decimals) || expected.decimals < 0 || expected.decimals > 255 ||
      typeof expected.tokenName !== "string" || !expected.tokenName || expected.tokenName.length > 128 ||
      typeof expected.tokenSymbol !== "string" || !expected.tokenSymbol || expected.tokenSymbol.length > 128 ||
      typeof expected.supplyUnits !== "string" || !/^(?:0|[1-9]\d{0,77})$/.test(expected.supplyUnits)) {
    reject("INVALID_SPECIFICATION", "Invalid expected token identity");
  }
  const supplyExpected = BigInt(expected.supplyUnits) * 10n ** BigInt(expected.decimals);
  if (supplyExpected >= 2n ** 256n) reject("INVALID_SPECIFICATION", "Expected issuance exceeds uint256");
  const observation = await readCanonicalToken(publicClient, expected.chainId, expected.contractAddress, reject);
  const { values } = observation;
  const [name, symbol, decimals, supply] = values;
  if (typeof name !== "string" || name !== expected.tokenName ||
      typeof symbol !== "string" || symbol !== expected.tokenSymbol ||
      decimals !== expected.decimals) {
    reject("METADATA_MISMATCH", "Deployed token metadata differs from the known address");
  }
  if (typeof supply !== "bigint" || supply < 0n) {
    reject("INVALID_SUPPLY", "Invalid totalSupply RPC value");
  }
  if (supply > supplyExpected) {
    reject("SUPPLY_EXCEEDS_ISSUANCE", "Deployed totalSupply exceeds the original issuance reference");
  }

  return Object.freeze({
    network: "Base Mainnet",
    chainId: expected.chainId,
    blockNumber: observation.blockNumber,
    blockHash: observation.blockHash,
    canonicalBlockRequired: true,
    canonicalBlockRechecked: true,
    chainRechecked: true,
    runtimeBytecodeKeccak256: observation.runtimeBytecodeKeccak256,
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
