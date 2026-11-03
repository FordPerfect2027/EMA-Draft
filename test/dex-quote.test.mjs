import test from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { CLASSIC_DEX, DexQuoteError, quoteClassicDex } from "../src/dex-quote.js";
import { rpc,HASH,OTHER_HASH,POOL,USDC,MAX } from "./support/state-rpc.mjs";
const code=value=>error=>error instanceof DexQuoteError&&error.code===value;
const reserveToken=2000000n*10n**18n;
test("buy quote uses the registered volatile pool and one canonical state",async()=>{
  const client=rpc(),r=await quoteClassicDex(client);
  assert.equal(CLASSIC_DEX.factory,"0x420dd381b31aef6683db6b902084cb0ffece40da");assert.equal(CLASSIC_DEX.usdc,USDC);
  assert.equal(r.agent,DEPLOYED_TOKEN.tokenSymbol);assert.equal(r.poolAddress,POOL);assert.equal(r.chainId,8453);
  assert.equal(r.blockNumber,"1234");assert.equal(r.blockHash,HASH);assert.equal(r.canonicalBlockRequired,true);assert.equal(r.canonicalBlockRechecked,true);
  assert.equal(r.inputBaseUnits,"1000000");assert.equal(r.quotedOutputBaseUnits,"19000000000000000000000");
  assert.equal(r.reserveInBaseUnits,"100000000");assert.equal(r.reserveOutBaseUnits,reserveToken.toString());assert.equal(r.inputDecimals,6);assert.equal(r.outputDecimals,18);
  assert.equal(r.direction,"buy");assert.equal(r.feeIncludedByPoolQuote,true);assert.equal(r.readOnly,true);assert(Object.isFrozen(r));
  for(const field of ["tradeExecuted","walletConnected","approvalGranted","thirdPartyWebsiteConnected","securityAudited"])assert.equal(r[field],false);
  assert.deepEqual(client.decoded.find(row=>row.functionName==="getPool").args,[getAddress(DEPLOYED_TOKEN.contractAddress),getAddress(USDC),false]);
  assert.deepEqual(client.decoded.find(row=>row.functionName==="getAmountOut").args,[1000000n,getAddress(USDC)]);
  assert(client.calls.every(row=>["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_call"].includes(row.method)));
  for(const row of client.calls.filter(row=>["eth_call","eth_getCode"].includes(row.method)))assert.deepEqual(row.params[1],{blockHash:HASH,requireCanonical:true});
  assert.equal(client.calls.filter(row=>row.method==="eth_chainId").length,2);
  assert.deepEqual(client.calls.filter(row=>row.method==="eth_getBlockByNumber").map(row=>row.params),[["latest",false],["0x4d2",false]]);
});
test("sell quote switches exact base units and reserve direction",async()=>{
  const client=rpc({values:{getAmountOut:1000000n}}),r=await quoteClassicDex(client,{direction:"sell"});
  assert.equal(r.inputBaseUnits,"1000000000000000000");assert.equal(r.quotedOutputBaseUnits,"1000000");assert.equal(r.reserveInBaseUnits,reserveToken.toString());assert.equal(r.inputDecimals,18);assert.equal(r.outputDecimals,6);
  assert.deepEqual(client.decoded.find(row=>row.functionName==="getAmountOut").args,[10n**18n,getAddress(DEPLOYED_TOKEN.contractAddress)]);
});
test("reverse token ordering is handled without assuming pool order",async()=>{
  const r=await quoteClassicDex(rpc({values:{token0:USDC,token1:DEPLOYED_TOKEN.contractAddress,getReserves:[100000000n,reserveToken,1789000000n]}}));
  assert.equal(r.reserveInBaseUnits,"100000000");assert.equal(r.reserveOutBaseUnits,reserveToken.toString());
});
test("invalid directions and amounts fail before RPC",async()=>{
  const client=rpc();await assert.rejects(quoteClassicDex(client,{direction:"bridge"}),code("INVALID_DIRECTION"));
  for(const amountInBaseUnits of [0n,-1n,100,"100",null,MAX+1n])await assert.rejects(quoteClassicDex(client,{amountInBaseUnits}),code("INVALID_AMOUNT"));assert.equal(client.calls.length,0);
});
test("wrong network fails before pool lookup",async()=>{
  const client=rpc({chain:"0x14a34"});await assert.rejects(quoteClassicDex(client),code("WRONG_CHAIN"));assert.equal(client.calls.length,1);
});
test("missing or transaction-only clients fail",async()=>{
  for(const client of [null,{}, {sendTransaction(){throw Error("Forbidden");}}])await assert.rejects(quoteClassicDex(client),code("INVALID_CLIENT"));
});
test("absent pool fails before quote",async()=>{
  const client=rpc({values:{getPool:"0x"+"00".repeat(20)}});await assert.rejects(quoteClassicDex(client),code("NO_POOL"));assert.equal(client.decoded.length,1);
});
test("unregistered pool and missing bytecode fail before pricing",async()=>{
  await assert.rejects(quoteClassicDex(rpc({values:{isPool:false}})),code("UNREGISTERED_POOL"));
  await assert.rejects(quoteClassicDex(rpc({bytecode:"0x"})),code("MISSING_POOL_CODE"));
});
for(const values of [{token0:POOL},{token1:POOL},{token0:USDC,token1:USDC},{stable:true}])test("wrong pair or stable flag: "+JSON.stringify(values),async()=>{
  await assert.rejects(quoteClassicDex(rpc({values})),code("PAIR_MISMATCH"));
});
test("empty reserves and wrong decimals fail",async()=>{
  for(const getReserves of [[0n,100n,1n],[100n,0n,1n]])await assert.rejects(quoteClassicDex(rpc({values:{getReserves}})),code("EMPTY_POOL"));
  await assert.rejects(quoteClassicDex(rpc({values:{decimals:9}})),code("DECIMALS_MISMATCH"));
});
test("zero or excessive output is rejected",async()=>{
  for(const getAmountOut of [0n,reserveToken,reserveToken+1n])await assert.rejects(quoteClassicDex(rpc({values:{getAmountOut}})),code("INVALID_QUOTE"));
});
for(const method of ["getPool","isPool","token0","token1","stable","getReserves","decimals","getAmountOut"])test("malformed ABI cannot produce a quote: "+method,async()=>{
  await assert.rejects(quoteClassicDex(rpc({rawFor:{[method]:"0x1234"}})),code("INVALID_RPC_RESULT"));
});
test("reorganized block cannot produce a successful quote",async()=>{await assert.rejects(quoteClassicDex(rpc({after:{number:"0x4d2",hash:OTHER_HASH}})),code("BLOCK_CHANGED"));});
test("network switch cannot produce a successful quote",async()=>{await assert.rejects(quoteClassicDex(rpc({afterChain:"0x1"})),code("NETWORK_CHANGED"));});
test("missing final header fails instead of returning output",async()=>{await assert.rejects(quoteClassicDex(rpc({after:null})),code("INVALID_BLOCK"));});
for(const method of ["eth_getCode","eth_call"])test("failed hash selector never falls back: "+method,async()=>{
  const client=rpc({failMethod:method});await assert.rejects(quoteClassicDex(client),/Dummy provider failure/);
  assert(client.calls.filter(row=>row.method===method).every(row=>row.params[1].requireCanonical===true));assert.equal(client.calls.filter(row=>row.method==="eth_getBlockByNumber").length,1);
});
