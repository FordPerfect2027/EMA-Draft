import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkContractSources } from "./check-contract-source.js";

const root = fileURLToPath(new URL("..", import.meta.url));
try {
  checkContractSources(root);
  // Operational *.test.mjs files run in test:read-only. Their support preloads
  // require a fixture environment and must never be discovered as test entries.
  const files = readdirSync(new URL("../test/", import.meta.url), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:ts|mts|cts)$/.test(entry.name) && !/\.d\.(?:ts|mts|cts)$/.test(entry.name))
    .map(entry => "test/" + entry.name).sort();
  if (!files.length) throw Error("NO_HARDHAT_TESTS");
  const cli = fileURLToPath(new URL("../node_modules/hardhat/dist/src/cli.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "test", "nodejs", ...files, ...process.argv.slice(2)], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch {
  process.stderr.write("Contract test runner failed: check source encoding, TypeScript test files and installed Hardhat.\n");
  process.exitCode = 1;
}
