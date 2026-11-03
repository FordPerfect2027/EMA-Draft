import assert from "node:assert/strict";
import test from "node:test";

// Load only pure validators, not Hardhat's runtime or the project's config.
// The fixtures never resolve a configuration variable or create a provider.
const hardhatEntry = import.meta.resolve("hardhat");
const { validateNetworkUserConfig } = await import(new URL(
  "./internal/builtin-plugins/network-manager/type-validation.js", hardhatEntry));
const { validateSolidityUserConfig } = await import(new URL(
  "./internal/builtin-plugins/solidity/config.js", hardhatEntry));

const variable = { _type: "ConfigurationVariable", name: "FICTIONAL_UNRESOLVED_VARIABLE" };
const http = overrides => ({ networks: { fixture: {
  type: "http", url: "https://example.invalid", ...overrides,
} } });
const local = overrides => ({ networks: { fixture: {
  type: "edr-simulated", chainType: "op", ...overrides,
} } });
const descriptor = hardforkHistory => ({ chainDescriptors: { "1": {
  name: "Fictional chain", chainType: "l1", hardforkHistory,
} } });

async function inspect(validator, value) {
  const before = structuredClone(value);
  const errors = await validator(value);
  assert.deepEqual(value, before, "validation must not mutate supplied configuration");
  assert(Array.isArray(errors));
  for (const error of errors) {
    assert(Array.isArray(error.path));
    assert.equal(typeof error.message, "string");
    assert(error.message.length > 0);
  }
  return errors;
}
async function valid(validator, value) {
  assert.deepEqual(await inspect(validator, value), []);
}
async function rejected(validator, value, path, message) {
  const errors = await inspect(validator, value);
  const found = errors.find(error => JSON.stringify(error.path) === JSON.stringify(path));
  assert(found, `Missing validation error at ${JSON.stringify(path)}: ${JSON.stringify(errors)}`);
  if (message) assert.match(found.message, message);
}

test("HTTP configuration validates record values and unresolved variable references", async () => {
  await valid(validateNetworkUserConfig, {});
  await valid(validateNetworkUserConfig, http({ httpHeaders: { "X-Fixture": "inert" } }));
  await valid(validateNetworkUserConfig, http({ url: variable, accounts: [variable] }));
  await rejected(validateNetworkUserConfig, http({ httpHeaders: { "X-Fixture": 7 } }),
    ["networks", "fixture", "httpHeaders", "X-Fixture"]);
  await rejected(validateNetworkUserConfig, http({ url: "not a URL" }), ["networks", "fixture", "url"]);
  await rejected(validateNetworkUserConfig, http({ accounts: [false] }), ["networks", "fixture", "accounts", 0]);
  await rejected(validateNetworkUserConfig, http({ type: "unknown" }), ["networks", "fixture", "type"]);
});

test("simulated network configuration retains tuple and cross-field validation", async () => {
  await valid(validateNetworkUserConfig, local({ mining: { interval: [1000, 2000] } }));
  await valid(validateNetworkUserConfig, local({ mining: { interval: 0 } }));
  await valid(validateNetworkUserConfig, local({ mining: { interval: 100 }, allowBlocksWithSameTimestamp: true }));
  await rejected(validateNetworkUserConfig, local({ mining: { interval: [100, 200] } }),
    ["networks", "fixture", "mining", "interval"], /allowBlocksWithSameTimestamp/);
  await rejected(validateNetworkUserConfig, local({ mining: { interval: [1000] } }),
    ["networks", "fixture", "mining", "interval"]);
  await rejected(validateNetworkUserConfig, local({ hardfork: "fictional" }),
    ["networks", "fixture", "hardfork"]);
  await rejected(validateNetworkUserConfig, local({ forking: { url: "https://example.invalid", blockNumber: -1 } }),
    ["networks", "fixture", "forking", "blockNumber"]);
  await rejected(validateNetworkUserConfig, { networks: { node: { type: "http", url: "https://example.invalid" } } },
    ["networks", "node", "type"], /edr-simulated/);
});

test("chain descriptors keep strict activation objects and chronological validation", async () => {
  await valid(validateNetworkUserConfig, descriptor({ berlin: { blockNumber: 1 }, london: { blockNumber: 2 } }));
  await rejected(validateNetworkUserConfig, descriptor({ london: { blockNumber: 2, unexpected: true } }),
    ["chainDescriptors", "1", "hardforkHistory", "london"], /unexpected/i);
  await rejected(validateNetworkUserConfig, descriptor({ london: { blockNumber: 2, timestamp: 3 } }),
    ["chainDescriptors", "1", "hardforkHistory", "london"]);
  await rejected(validateNetworkUserConfig, descriptor({ berlin: { blockNumber: 2 }, london: { blockNumber: 1 } }),
    ["chainDescriptors", "1", "hardforkHistory", "london"], /ascending/);
  await rejected(validateNetworkUserConfig, descriptor({ fictional: { blockNumber: 1 } }),
    ["chainDescriptors", "1", "hardforkHistory", "fictional"], /Invalid hardfork/);
});

test("compiler variants retain nested error paths through conditional unions", async () => {
  for (const solidity of ["0.8.34", ["0.8.34"], { version: "0.8.34" },
    { compilers: [{ version: "0.8.34" }], overrides: { "Fictional.sol": { version: "0.8.34" } } },
    { profiles: { default: { version: "0.8.34" }, fixture: { compilers: [{ version: "0.8.34" }] } } }]) {
    await valid(validateSolidityUserConfig, { solidity });
  }
  await rejected(validateSolidityUserConfig, { solidity: [] }, ["solidity"]);
  await rejected(validateSolidityUserConfig, { solidity: { compilers: [] } }, ["solidity", "compilers"]);
  await rejected(validateSolidityUserConfig, { solidity: { compilers: [{ version: 34 }] } },
    ["solidity", "compilers", 0, "version"]);
  await rejected(validateSolidityUserConfig, { solidity: { profiles: { fixture: { version: "0.8.34" } } } },
    ["solidity", "profiles"], /default/);
});

test("incompatible compiler fields preserve the actionable custom message", async () => {
  await rejected(validateSolidityUserConfig, { solidity: { version: "0.8.34", compilers: [] } },
    ["solidity", "compilers"], /incompatible with `version`/);
  await rejected(validateSolidityUserConfig, { solidity: { profiles: { default: { version: "0.8.34" } }, overrides: {} } },
    ["solidity", "overrides"], /incompatible with `profiles`/);
  await rejected(validateSolidityUserConfig, { solidity: { compilers: [{ version: "0.8.34" }], type: "solc" } },
    ["solidity", "type"], /incompatible with `compilers`/);
});

test("source-path variants reject wrong types and empty lists without throwing", async () => {
  for (const sources of ["contracts", ["contracts"], { solidity: "contracts" }, { solidity: ["contracts"] }]) {
    await valid(validateSolidityUserConfig, { paths: { sources } });
  }
  await rejected(validateSolidityUserConfig, { paths: { sources: 7 } }, ["paths", "sources"]);
  await rejected(validateSolidityUserConfig, { paths: { sources: [] } }, ["paths", "sources"]);
  await rejected(validateSolidityUserConfig, { paths: { sources: { solidity: [7] } } },
    ["paths", "sources", "solidity", 0]);
});
