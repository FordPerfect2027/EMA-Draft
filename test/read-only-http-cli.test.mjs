import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ACCOUNT = "0x" + "11".repeat(20);
const commands = [
  ["verify-base-mainnet.js", [], "https://mainnet.base.org/"],
  ["inspect-wallet-readiness.js", [ACCOUNT], "https://mainnet.base.org/"],
  ["quote-dex.js", ["buy", "1000000"], "https://mainnet.base.org/"],
  ["inspect-transfers.js", [ACCOUNT], "https://base-rpc.publicnode.com/"],
  ["inspect-approvals.js", [ACCOUNT], "https://base-rpc.publicnode.com/"],
];

// Exercise the actual CLI's normal 12-second limit, not an accelerated mock timer.
// Only the endpoint is redirected, using the existing child-process-only preload.
test("read-only CLI response-body deadlines", { concurrency: 5 }, async t => {
  await Promise.all(commands.map(([script, args, endpoint]) => t.test(script, async subtest => {
    const calls = [];
    let headersSent = false;
    let child, bodyWatchdog, bodyStarted;
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const query = JSON.parse(body);
      calls.push(query.method);
      response.writeHead(200, { "content-type": "application/json" });
      response.write(JSON.stringify({ jsonrpc: "2.0", id: query.id, result: "test-only-secret" }).slice(0, -2));
      headersSent = true; // Deliberately leave this tiny body unfinished.
      if (bodyStarted === undefined) {
        bodyStarted = performance.now();
        bodyWatchdog = setTimeout(() => child.kill(), 15000);
      }
    });
    try {
      await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
      const env = {
        PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT,
        THREECORE_TEST_TRANSPORT: "http://127.0.0.1:" + server.address().port + "/",
        THREECORE_TEST_EXPECTED_ENDPOINT: endpoint,
      };
      const result = await new Promise(resolve => { child = execFile(process.execPath, [
        "--import", new URL("./support/local-rpc-preload.mjs", import.meta.url).href,
        fileURLToPath(new URL("../scripts/" + script, import.meta.url)), ...args,
      ], { env, windowsHide: true, timeout: 45000, maxBuffer: 32768 }, (error, stdout, stderr) => {
        resolve({ code: error?.code ?? 0, killed: Boolean(error?.killed), stdout, stderr });
      }); });
      const bodyElapsedMs = performance.now() - bodyStarted;
      subtest.diagnostic("Response body observed to process exit: " + Math.round(bodyElapsedMs) + " ms");
      assert(headersSent, "The response must reach the body-reading stage");
      assert.equal(result.killed, false, "CLI stalled after response headers and required external termination");
      assert.equal(result.code, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /RPC_ERROR\n$/);
      assert(!result.stderr.includes("test-only-secret"), "Provider body leaked into diagnostic");
      assert.equal(calls.length, 1, "Timeout caused a retry or subsequent RPC");
      assert(bodyElapsedMs < 15000, "CLI did not settle before the body watchdog");
    } finally {
      clearTimeout(bodyWatchdog);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  })));
});
