// Test child processes only: preserve viem's real HTTP request body while
// redirecting the fixed public endpoint to this test's isolated loopback server.
const destination = process.env.THREECORE_TEST_TRANSPORT;
if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/$/.test(destination ?? "")) {
  throw Error("A test-owned loopback transport is required");
}
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const source = input instanceof Request ? input.url : String(input);
  if (source !== "https://mainnet.base.org" && source !== "https://mainnet.base.org/") {
    throw Error("Unexpected network destination in isolated CLI test");
  }
  return originalFetch(destination, init);
};
