import test from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, encodeFunctionResult, erc20Abi, keccak256 } from "viem";
import { DEPLOYED_TOKEN, TokenIdentityError, verifyDeployedToken } from "../src/onchain-identity.js";

const HASH="0x"+"ab".repeat(32), OTHER="0x"+"cd".repeat(32);
const METHODS=["name","symbol","decimals","totalSupply"];
const issuance=BigInt(DEPLOYED_TOKEN.supplyUnits)*10n**BigInt(DEPLOYED_TOKEN.decimals);
const code=value=>error=>error instanceof TokenIdentityError&&error.code===value;
function mockClient(options={}) {
  const calls=[];let headers=0,chains=0;
  return {calls,async request(request){
    calls.push(structuredClone(request));options.onRequest?.(request);
    if(request.method==="eth_chainId"){
      chains++;if(chains>1&&Object.hasOwn(options,"afterChain"))return options.afterChain;
      return Object.hasOwn(options,"chain")?options.chain:"0x2105";
    }
    if(request.method==="eth_getBlockByNumber"){
      const key=++headers===1?"before":"after";
      return Object.hasOwn(options,key)?options[key]:{number:"0x4d2",hash:HASH};
    }
    if(request.method==="eth_getCode"){
      if(options.codeError)throw options.codeError;
      return Object.hasOwn(options,"bytecode")?options.bytecode:"0x60006000";
    }
    if(request.method==="eth_call"){
      const functionName=METHODS.find(name=>request.params[0].data===encodeFunctionData({abi:erc20Abi,functionName:name}));
      assert(functionName,"Only metadata and totalSupply reads are supported");
      if(options.callError)throw options.callError;
      if(Object.hasOwn(options,"raw"))return options.raw;
      const values={name:DEPLOYED_TOKEN.tokenName,symbol:DEPLOYED_TOKEN.tokenSymbol,decimals:DEPLOYED_TOKEN.decimals,totalSupply:issuance,...options.values};
      return encodeFunctionResult({abi:erc20Abi,functionName,result:values[functionName]});
    }
    throw Error("Forbidden RPC method: "+request.method);
  }};
}
test("published token specification remains immutable",()=>{
  assert(Object.isFrozen(DEPLOYED_TOKEN));assert.equal(DEPLOYED_TOKEN.chainId,8453);
  assert.match(DEPLOYED_TOKEN.contractAddress,/^0x[\da-fA-F]{40}$/);assert.equal(DEPLOYED_TOKEN.decimals,18);
});
test("all state reads require the same canonical hash and final header/chain checks",async()=>{
  const client=mockClient(),result=await verifyDeployedToken(client);
  assert.equal(result.tokenName,DEPLOYED_TOKEN.tokenName);assert.equal(result.tokenSymbol,DEPLOYED_TOKEN.tokenSymbol);
  assert.equal(result.blockNumber,"1234");assert.equal(result.blockHash,HASH);
  assert.equal(result.totalSupplyBaseUnits,issuance.toString());assert.equal(result.runtimeBytecodeKeccak256,keccak256("0x60006000"));
  assert.equal(result.canonicalBlockRequired,true);assert.equal(result.canonicalBlockRechecked,true);assert.equal(result.chainRechecked,true);
  assert.equal(result.readOnly,true);assert.equal(result.transactionSent,false);assert.equal(result.securityAudit,false);assert(Object.isFrozen(result));
  const states=client.calls.filter(row=>["eth_getCode","eth_call"].includes(row.method));assert.equal(states.length,5);
  for(const row of states)assert.deepEqual(row.params[1],{blockHash:HASH,requireCanonical:true});
  assert.deepEqual(client.calls.filter(row=>row.method==="eth_getBlockByNumber").map(row=>row.params),[["latest",false],["0x4d2",false]]);
  assert.equal(client.calls.filter(row=>row.method==="eth_chainId").length,2);
  assert(client.calls.every(row=>["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_call"].includes(row.method)));
});
test("wrong network fails before state reads",async()=>{
  const client=mockClient({chain:"0x1"});await assert.rejects(verifyDeployedToken(client),code("WRONG_NETWORK"));
  assert.deepEqual(client.calls,[{method:"eth_chainId"}]);
});
for(const chain of [null,8453,"8453","0x02105","0x","0x"+"f".repeat(65)])test("invalid chain: "+String(chain),async()=>{
  const client=mockClient({chain});await assert.rejects(verifyDeployedToken(client),code("INVALID_CHAIN"));assert.equal(client.calls.length,1);
});
for(const before of [null,{}, {number:"pending",hash:HASH},{number:"0x00",hash:HASH},{number:"0x1",hash:null},{number:"0x1",hash:"0x1234"}])test("invalid numbered block: "+JSON.stringify(before),async()=>{
  const client=mockClient({before});await assert.rejects(verifyDeployedToken(client),code("INVALID_BLOCK"));assert.equal(client.calls.length,2);
});
for(const bytecode of [null,"0x","not-hex","0x1"])test("invalid contract code: "+String(bytecode),async()=>{
  const client=mockClient({bytecode});await assert.rejects(verifyDeployedToken(client),code("NO_DEPLOYED_CODE"));assert(!client.calls.some(row=>row.method==="eth_call"));
});
test("oversized code is bounded before metadata",async()=>{
  await assert.rejects(verifyDeployedToken(mockClient({bytecode:"0x"+"00".repeat(256*1024+1)})),code("RPC_RESPONSE_LIMIT"));
});
for(const values of [{name:"Wrong"},{symbol:"Wrong"},{decimals:6}])test("metadata mismatch: "+JSON.stringify(values),async()=>{
  await assert.rejects(verifyDeployedToken(mockClient({values})),code("METADATA_MISMATCH"));
});
test("issuance limit and valid burn reductions remain checked",async()=>{
  await assert.rejects(verifyDeployedToken(mockClient({values:{totalSupply:issuance+1n}})),code("SUPPLY_EXCEEDS_ISSUANCE"));
  assert.equal((await verifyDeployedToken(mockClient({values:{totalSupply:issuance-123n}}))).estimatedBurnedBaseUnits,"123");
});
for(const raw of [null,"0x","0x1234","bad",42,"0x"+"00".repeat(4097)])test("invalid ABI response: "+(typeof raw==="string"?raw.slice(0,20):raw),async()=>{
  await assert.rejects(verifyDeployedToken(mockClient({raw})),code("INVALID_TOKEN_RESPONSE"));
});
for(const after of [{number:"0x4d2",hash:OTHER},{number:"0x4d3",hash:HASH}])test("changed block rejected: "+after.number+after.hash.slice(0,8),async()=>{
  await assert.rejects(verifyDeployedToken(mockClient({after})),code("BLOCK_CHANGED"));
});
test("vanished final block fails verification",async()=>{await assert.rejects(verifyDeployedToken(mockClient({after:null})),code("INVALID_BLOCK"));});
test("network switch during reads fails verification",async()=>{await assert.rejects(verifyDeployedToken(mockClient({afterChain:"0x1"})),code("CHAIN_CHANGED"));});
test("unsupported canonical code read propagates without weaker retry",async()=>{
  const failure=Object.assign(Error("unsupported hash parameter"),{code:-32602}),client=mockClient({codeError:failure});
  await assert.rejects(verifyDeployedToken(client),error=>error===failure);
  assert.equal(client.calls.filter(row=>row.method==="eth_getCode").length,1);assert(!client.calls.some(row=>row.method==="eth_call"));
});
test("metadata hash rejection has no latest/number fallback",async()=>{
  const failure=Error("not canonical"),client=mockClient({callError:failure});
  await assert.rejects(verifyDeployedToken(client),error=>error===failure);
  assert.equal(client.calls.filter(row=>row.method==="eth_getBlockByNumber").length,1);
  assert(client.calls.filter(row=>row.method==="eth_call").every(row=>row.params[1].requireCanonical===true));
});
test("expected identity is captured before asynchronous reads",async()=>{
  const expected={...DEPLOYED_TOKEN},client=mockClient({onRequest(){expected.tokenSymbol="MUTATED";expected.contractAddress="0x"+"ff".repeat(20);}});
  const result=await verifyDeployedToken(client,expected);assert.equal(result.tokenSymbol,DEPLOYED_TOKEN.tokenSymbol);assert.equal(result.contractAddress,DEPLOYED_TOKEN.contractAddress);
});
for(const expected of [null,{...DEPLOYED_TOKEN,decimals:256},{...DEPLOYED_TOKEN,supplyUnits:"9".repeat(78)},{...DEPLOYED_TOKEN,contractAddress:"bad"}])test("invalid expected specification: "+JSON.stringify(expected),async()=>{
  const client=mockClient();await assert.rejects(verifyDeployedToken(client,expected),code("INVALID_SPECIFICATION"));assert.equal(client.calls.length,0);
});
test("missing and transaction-only clients are rejected",async()=>{
  await assert.rejects(verifyDeployedToken(null),code("INVALID_CLIENT"));await assert.rejects(verifyDeployedToken({sendTransaction(){throw Error("Forbidden");}}),code("INVALID_CLIENT"));
});
