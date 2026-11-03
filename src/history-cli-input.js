import { MAX_UINT256 } from "./history-log.js";

export class HistoryCliInputError extends Error {
  constructor(code) { super(code); this.name = "HistoryCliInputError"; this.code = code; }
}
const fail = code => { throw new HistoryCliInputError(code); };
function block(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 78 || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    fail("INVALID_BLOCK");
  }
  const parsed = BigInt(value);
  if (parsed > MAX_UINT256) fail("INVALID_BLOCK");
  return parsed;
}

/** Validate CLI input before creating a transport or requesting a public tip. */
export function parseHistoryCli(argv, maximumBlockSpan) {
  if (!Array.isArray(argv) || argv.length < 1 || argv.length > 3) fail("USAGE");
  const [address, first, last] = argv;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/.test(address)) {
    fail("INVALID_ADDRESS");
  }
  const from = block(first), to = block(last);
  if (from !== undefined && to !== undefined && (from > to || to - from + 1n > maximumBlockSpan)) {
    fail("INVALID_RANGE");
  }
  return Object.freeze({ address: address.toLowerCase(), from, to });
}

export function historyRpcUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail("INVALID_RPC_URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    fail("INVALID_RPC_URL");
  }
  return url.href;
}
