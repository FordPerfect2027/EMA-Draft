import test from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { CLASSIC_ROUTER, WalletReadinessError, inspectWalletReadiness } from "../src/wallet-readiness.js";
import { rpc, HASH, OTHER_HASH, ACCOUNT, MAX } from "./support/state-rpc.mjs";
const code = expected => error => error instanceof WalletReadinessError && error.code === expected;

test("readiness reports exact public balances and existing allowance at one canonical hash", async () => {
  const client = rpc(), result = await inspectWalletReadiness(client, ACCOUNT);
  assert.equal(CLASSIC_ROUTER,"0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43");
  assert.equal(result.agent,DEPLOYED_TOKEN.tokenSymbol); assert.equal(result.chainId,8453);
  assert.equal(result.observedBlockNumber,"1234"); assert.equal(result.observedBlockHash,HASH);
  assert.equal(result.canonicalBlockRequired,true); assert.equal(result.canonicalBlockRechecked,true);
  assert.equal(result.nativeGasBalanceWei,"291"); assert.equal(result.tokenBalanceBaseUnits,"320");
  assert.equal(result.existingClassicRouterAllowanceBaseUnits,"15"); assert.equal(result.missingNativeGas,false);
  assert.equal(result.existingClassicRouterApproval,true); assert.equal(result.readOnly,true);
  for(const field of ["transactionSent","approvalGranted","walletConnected","contractAudited"])assert.equal(result[field],false);
  assert(Object.isFrozen(result)); assert.equal(JSON.parse(JSON.stringify(result)).tokenBalanceBaseUnits,"320");
  const reads=client.calls.filter(row=>["eth_getCode","eth_getBalance","eth_call"].includes(row.method));
  assert.equal(reads.length,5);for(const row of reads)assert.deepEqual(row.params[1],{blockHash:HASH,requireCanonical:true});
  assert.deepEqual(client.decoded.map(row=>[row.functionName,row.address,row.args]),[
    ["balanceOf",DEPLOYED_TOKEN.contractAddress,[ACCOUNT]],
    ["allowance",DEPLOYED_TOKEN.contractAddress,[ACCOUNT,getAddress(CLASSIC_ROUTER)]],
  ]);
  assert.deepEqual(client.calls.filter(row=>row.method==="eth_getCode").map(row=>row.params[0]),[DEPLOYED_TOKEN.contractAddress,CLASSIC_ROUTER]);
  assert.deepEqual(client.calls.filter(row=>row.method==="eth_getBlockByNumber").map(row=>row.params),[["latest",false],["0x4d2",false]]);
  assert.equal(client.calls.filter(row=>row.method==="eth_chainId").length,2);
  assert(client.calls.every(row=>["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_getBalance","eth_call"].includes(row.method)));
});
test("zero gas, balance and allowance remain separate facts",async()=>{
  const r=await inspectWalletReadiness(rpc({balance:"0x0",values:{balanceOf:0n,allowance:0n}}),ACCOUNT);
  assert.equal(r.missingNativeGas,true);assert.equal(r.existingClassicRouterApproval,false);assert.equal(r.tokenBalanceBaseUnits,"0");
});
test("maximum uint256 balances and existing allowance remain exact",async()=>{
  const r=await inspectWalletReadiness(rpc({balance:"0x"+MAX.toString(16),values:{balanceOf:MAX,allowance:MAX}}),ACCOUNT);
  assert.equal(r.nativeGasBalanceWei,MAX.toString());assert.equal(r.tokenBalanceBaseUnits,MAX.toString());assert.equal(r.existingClassicRouterAllowanceBaseUnits,MAX.toString());
});
test("invalid or zero public addresses fail before RPC",async()=>{
  const client=rpc();for(const address of [null,"","bad","0x123","0x"+"00".repeat(20)])await assert.rejects(inspectWalletReadiness(client,address),code("INVALID_ADDRESS"));assert.equal(client.calls.length,0);
});
test("mixed case public address normalizes before reads",async()=>{
  const address="0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",client=rpc();
  const result=await inspectWalletReadiness(client,address);assert.equal(result.publicWalletAddress,address.toLowerCase());
  assert.equal(client.calls.find(row=>row.method==="eth_getBalance").params[0],address.toLowerCase());
});
test("missing and transaction-only clients fail",async()=>{
  for(const client of [null,{}, {sendTransaction(){throw Error("Forbidden");}}])await assert.rejects(inspectWalletReadiness(client,ACCOUNT),code("INVALID_CLIENT"));
});
test("wrong chain fails before contract reads",async()=>{
  const client=rpc({chain:"0x14a34"});await assert.rejects(inspectWalletReadiness(client,ACCOUNT),code("WRONG_NETWORK"));assert.equal(client.calls.length,1);
});
for(const before of [null,{}, {number:"0x-1",hash:HASH},{number:"123",hash:HASH},{number:"0x"+"1".repeat(65),hash:HASH},{number:"0x4d2",hash:null}])test("invalid sampled block: "+JSON.stringify(before),async()=>{
  const client=rpc({before});await assert.rejects(inspectWalletReadiness(client,ACCOUNT),error=>code("INVALID_BLOCK")(error)||code("INVALID_RPC_RESULT")(error));assert.equal(client.calls.length,2);
});
for(const address of [DEPLOYED_TOKEN.contractAddress,CLASSIC_ROUTER])test("missing code aborts before balance reads: "+address,async()=>{
  const client=rpc({codeFor:a=>a===address?"0x":"0x6000"});await assert.rejects(inspectWalletReadiness(client,ACCOUNT),code("MISSING_CONTRACT"));assert(!client.calls.some(row=>row.method==="eth_getBalance"||row.method==="eth_call"));
});
for(const bytecode of [null,"0x1","hello","0xXX",123])test("invalid bytecode: "+String(bytecode),async()=>{
  await assert.rejects(inspectWalletReadiness(rpc({bytecode}),ACCOUNT),code("MISSING_CONTRACT"));
});
test("oversized code is rejected before ABI decoding",async()=>{await assert.rejects(inspectWalletReadiness(rpc({bytecode:"0x"+"00".repeat(256*1024+1)}),ACCOUNT),code("RPC_RESPONSE_LIMIT"));});
for(const balance of [null,2,"-1","0x00","0x-1","0x"+"1".repeat(65)])test("invalid native balance quantity: "+String(balance),async()=>{
  await assert.rejects(inspectWalletReadiness(rpc({balance}),ACCOUNT),code("INVALID_RPC_RESULT"));
});
for(const method of ["balanceOf","allowance"])test("malformed and oversized ABI response: "+method,async()=>{
  for(const raw of [null,"0x","0x1234","0x"+"00".repeat(4097)])await assert.rejects(inspectWalletReadiness(rpc({rawFor:{[method]:raw}}),ACCOUNT),code("INVALID_RPC_RESULT"));
});
test("reorganized block cannot produce a readiness report",async()=>{await assert.rejects(inspectWalletReadiness(rpc({after:{number:"0x4d2",hash:OTHER_HASH}}),ACCOUNT),code("BLOCK_CHANGED"));});
test("network switch cannot produce a readiness report",async()=>{await assert.rejects(inspectWalletReadiness(rpc({afterChain:"0x1"}),ACCOUNT),code("NETWORK_CHANGED"));});
for(const method of ["eth_getCode","eth_getBalance","eth_call"])test("failed state read never falls back or dispatches a transaction: "+method,async()=>{
  const client=rpc({failMethod:method});await assert.rejects(inspectWalletReadiness(client,ACCOUNT),/Dummy provider failure/);
  assert(client.calls.filter(row=>row.method===method).every(row=>row.params[1].requireCanonical===true));
  assert.equal(client.calls.filter(row=>row.method==="eth_getBlockByNumber").length,1);assert(!client.calls.some(row=>/send|sign|approve|write/i.test(row.method)));
});
