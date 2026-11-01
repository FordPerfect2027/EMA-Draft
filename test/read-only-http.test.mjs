import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPublicClient } from "viem";
import { createReadOnlyHttp, READ_HTTP_LIMITS } from "../src/read-only-http.js";

async function withServer(handler, run) {
  let calls = 0;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    handler(JSON.parse(body), response, ++calls);
  });
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    await run("http://127.0.0.1:" + server.address().port, () => calls);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
const request = client => client.request({ method: "eth_chainId" });
const client = (url, options) => createPublicClient({ transport: createReadOnlyHttp(url, options) });

test("body deadline aborts an unfinished stream without retries", async () => {
  let closed;
  const connectionClosed = new Promise(resolve => { closed = resolve; });
  await withServer((query, response) => {
    response.on("close", closed);
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"jsonrpc":"2.0","id":' + query.id + ',"result":"');
  }, async (url, calls) => {
    await assert.rejects(request(client(url, { timeoutMs: 300 })));
    await Promise.race([connectionClosed, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Error("Response connection was not cancelled")), 2000);
      timer.unref();
    })]);
    assert.equal(calls(), 1);
  });
});

test("each request receives a fresh deadline and preserves split UTF-8 JSON", async () => {
  await withServer((query, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    const bytes = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: query.id, result: "応答" }));
    const split = bytes.indexOf(Buffer.from("応")) + 1;
    response.write(bytes.subarray(0, split));
    const timer = setTimeout(() => response.end(bytes.subarray(split)), 600);
    response.on("close", () => clearTimeout(timer));
  }, async (url, calls) => {
    const rpc = client(url, { timeoutMs: 1000 });
    assert.equal(await request(rpc), "応答");
    assert.equal(await request(rpc), "応答");
    assert.equal(calls(), 2);
  });
});

test("an unexpired caller signal cannot disable the body deadline", async () => {
  await withServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"result":"');
  }, async (url, calls) => {
    const caller = new AbortController();
    await assert.rejects(client(url, { timeoutMs: 300 }).request({ method: "eth_chainId" }, { signal: caller.signal }));
    assert.equal(caller.signal.aborted, false, "Transport must not abort the caller's controller");
    assert.equal(calls(), 1);
  });
});

test("caller cancellation during a body read remains effective", async () => {
  const caller = new AbortController();
  await withServer((_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"result":"');
    const timer = setTimeout(() => caller.abort(), 100);
    response.on("close", () => clearTimeout(timer));
  }, async (url, calls) => {
    await assert.rejects(client(url).request({ method: "eth_chainId" }, { signal: caller.signal }));
    assert.equal(caller.signal.aborted, true);
    assert.equal(calls(), 1);
  });
});

for (const declared of [true, false]) {
  test("oversized " + (declared ? "declared" : "chunked") + " body is refused without retries", async () => {
    await withServer((_, response) => {
      response.writeHead(200, { "content-type": "application/json", ...(declared ? { "content-length": "1000" } : {}) });
      response.write("x".repeat(declared ? 1 : 129));
    }, async (url, calls) => {
      await assert.rejects(request(client(url, { timeoutMs: 1000, responseBytes: 128 })), /RPC_RESPONSE_LIMIT/);
      assert.equal(calls(), 1);
    });
  });
}

test("complete HTTP JSON-RPC errors retain their error code", async () => {
  await withServer((query, response) => {
    response.writeHead(429, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: query.id, error: { code: -32005, message: "Fixture limit" } }));
  }, async (url, calls) => {
    await assert.rejects(request(client(url)), error => error.code === -32005);
    assert.equal(calls(), 1);
  });
});

test("transport limits cannot be disabled or raised beyond the supported caps", () => {
  assert.equal(READ_HTTP_LIMITS.timeoutMs, 12000);
  assert.equal(READ_HTTP_LIMITS.responseBytes, 10485760);
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: 12001 }, { timeoutMs: NaN }, { responseBytes: false }, { responseBytes: Infinity }, { responseBytes: 10485761 }]) {
    assert.throws(() => createReadOnlyHttp("http://127.0.0.1", options), /INVALID_READ_HTTP_LIMIT/);
  }
});
