import { http } from "viem";

export const READ_HTTP_LIMITS = Object.freeze({ timeoutMs: 12000, responseBytes: 10 * 1024 * 1024 });

/** Keep viem's request deadline active until the entire bounded body arrives.
 * Its native fetch deadline otherwise ends when response headers arrive.
 * This transport does not grant wallet permission or add any RPC methods.
 */
export function createReadOnlyHttp(url, {
  timeoutMs = READ_HTTP_LIMITS.timeoutMs,
  responseBytes = READ_HTTP_LIMITS.responseBytes,
} = {}) {
  for (const [value, maximum] of [[timeoutMs, READ_HTTP_LIMITS.timeoutMs], [responseBytes, READ_HTTP_LIMITS.responseBytes]]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw Error("INVALID_READ_HTTP_LIMIT");
  }
  return http(url, {
    timeout: timeoutMs, retryCount: 0, maxResponseBodySize: responseBytes,
    async fetchFn(input, init) {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (init.signal?.aborted) cancel();
      else init.signal?.addEventListener("abort", cancel, { once: true });
      // Keep our deadline even when viem forwards a caller-supplied signal.
      const timer = setTimeout(cancel, timeoutMs);
      try {
        const response = await fetch(input, { ...init, signal: controller.signal });
        return await consumeBoundedResponse(response, responseBytes);
      } finally {
        clearTimeout(timer);
        init.signal?.removeEventListener("abort", cancel);
      }
    },
  });
}

async function consumeBoundedResponse(response, responseBytes) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0, complete = false;
  try {
    if (Number(response.headers.get("content-length")) > responseBytes) throw Error("RPC_RESPONSE_LIMIT");
    while (true) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      size += value.byteLength;
      if (size > responseBytes) throw Error("RPC_RESPONSE_LIMIT");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } finally {
    if (!complete) {
      try { await reader.cancel(); } catch { /* Preserve the original read failure. */ }
    }
    reader.releaseLock();
  }
}
