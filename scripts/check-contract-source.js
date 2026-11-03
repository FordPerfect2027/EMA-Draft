import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Solidity metadata includes source hashes. Reject edited/converted bytes rather
// than silently repairing them while compiling a deployment candidate.
export function checkContractSources(root) {
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error("CONTRACT_SOURCE_SYMLINK");
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".sol")) files.push(path);
    }
  }
  walk(resolve(root, "contracts"));
  if (!files.length) throw Error("NO_CONTRACT_SOURCE");
  for (const path of files) {
    const bytes = readFileSync(path);
    if (bytes.includes(13) || bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) throw Error("CONTRACT_SOURCE_REQUIRES_UTF8_LF");
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  return files.sort().map(path => relative(root, path).replaceAll("\\", "/"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const files = checkContractSources(fileURLToPath(new URL("..", import.meta.url)));
    process.stdout.write(JSON.stringify({ sourceEncoding: "UTF-8 without BOM", lineEndings: "LF", files }) + "\n");
  } catch {
    process.stderr.write("Contract source check failed: use UTF-8 without BOM and LF line endings for every Solidity source.\n");
    process.exitCode = 1;
  }
}
