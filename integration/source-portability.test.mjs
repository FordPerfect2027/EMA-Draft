import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, lstatSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { checkContractSources } from "../scripts/check-contract-source.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourcePaths = checkContractSources(root);
const parent = resolve(tmpdir());
function fixture(t) {
  const path = mkdtempSync(join(parent, "threecore-source-portability-"));
  t.after(() => {
    assert.equal(dirname(resolve(path)), parent);
    assert(basename(path).startsWith("threecore-source-portability-"));
    assert(!lstatSync(path).isSymbolicLink());
    rmSync(path, { recursive: true, force: true });
  });
  return path;
}
function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|comspec|pathext)$/i.test(key)));
}

test("contract source checker accepts every actual UTF-8 LF contract", () => {
  assert(sourcePaths.length > 0);
  for (const path of sourcePaths) assert(!readFileSync(join(root, path)).includes(13));
});

test("actual source bytes survive Git checkouts with both autocrlf settings", t => {
  const temporary = fixture(t), source = join(temporary, "source repository");
  mkdirSync(source); writeFileSync(join(source, ".gitattributes"), readFileSync(join(root, ".gitattributes")));
  for (const path of sourcePaths) { mkdirSync(dirname(join(source, path)), { recursive: true }); writeFileSync(join(source, path), readFileSync(join(root, path))); }
  const env = { ...cleanEnv(), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(temporary, "empty-gitconfig"), GIT_TERMINAL_PROMPT: "0" };
  writeFileSync(env.GIT_CONFIG_GLOBAL, "");
  const git = (cwd, ...args) => execFileSync("git", ["-c", "core.hooksPath=" + join(temporary, "no-hooks"), "-c", "core.autocrlf=false", ...args], { cwd, env, windowsHide: true, timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  git(source, "init", "--quiet"); git(source, "add", ".");
  git(source, "-c", "user.name=Source portability test", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture source");
  for (const setting of ["true", "false"]) {
    const target = join(temporary, "checkout " + setting);
    git(temporary, "clone", "--quiet", "--no-hardlinks", "--no-checkout", source, target);
    git(target, "-c", "core.autocrlf=" + setting, "checkout", "HEAD", "--", ".");
    assert.deepEqual(checkContractSources(target), sourcePaths);
    for (const path of sourcePaths) assert.deepEqual(readFileSync(join(target, path)), readFileSync(join(root, path)), setting + ": " + path);
  }
});

test("the CLI rejects CRLF before compilation without rewriting the source", t => {
  const temporary = fixture(t);
  mkdirSync(join(temporary, "scripts")); mkdirSync(join(temporary, "contracts"));
  writeFileSync(join(temporary, "package.json"), '{"type":"module"}');
  writeFileSync(join(temporary, "scripts/check-contract-source.js"), readFileSync(join(root, "scripts/check-contract-source.js")));
  const bytes = Buffer.from(readFileSync(join(root, sourcePaths[0]), "utf8").replaceAll("\n", "\r\n"));
  const path = join(temporary, "contracts/Converted.sol"); writeFileSync(path, bytes);
  const result = spawnSync(process.execPath, [join(temporary, "scripts/check-contract-source.js")], { cwd: temporary, env: cleanEnv(), encoding: "utf8", timeout: 15000, windowsHide: true });
  assert.equal(result.status, 1); assert.equal(result.stdout, ""); assert.match(result.stderr, /UTF-8 without BOM and LF/);
  assert.deepEqual(readFileSync(path), bytes);
});

test("source checker refuses missing sources, BOM, lone CR and invalid UTF-8", t => {
  const temporary = fixture(t); mkdirSync(join(temporary, "contracts"));
  assert.throws(() => checkContractSources(temporary));
  const path = join(temporary, "contracts/Invalid.sol");
  for (const bytes of [Buffer.from([239,187,191,10]), Buffer.from("pragma solidity ^0.8.24;\r"), Buffer.from([0xff,0xfe,10])]) {
    writeFileSync(path, bytes); assert.throws(() => checkContractSources(temporary));
  }
});
