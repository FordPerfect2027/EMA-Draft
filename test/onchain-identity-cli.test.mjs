import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { encodeFunctionData, encodeFunctionResult, erc20Abi } from "viem";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";

const HASH="0x"+"ab".repeat(32), OTHER="0x"+"cd".repeat(32);
const METHODS=["name","symbol","decimals","totalSupply"];
async function runCli(mode) {
  const calls=[],contextErrors=[];let headers=0;
  const server=createServer(async(request,response)=>{
    let body="";for await(const chunk of request)body+=chunk;
    const rpc=JSON.parse(body);calls.push(rpc);let result,error;
    if(rpc.method==="eth_chainId")result="0x2105";
    else if(rpc.method==="eth_getBlockByNumber")result={number:"0x4d2",hash:++headers>1&&mode==="reorg"?OTHER:HASH};
    else if(rpc.method==="eth_getCode"||rpc.method==="eth_call"){
      try{assert.deepEqual(rpc.params[1],{blockHash:HASH,requireCanonical:true});}catch(e){contextErrors.push(e.message);}
      if(mode==="unsupported")error={code:-32602,message:"test-only-secret-provider-detail",data:request.url};
      else if(rpc.method==="eth_getCode")result="0x60006000";
      else{
        const functionName=METHODS.find(name=>rpc.params[0].data===encodeFunctionData({abi:erc20Abi,functionName:name}));
        if(!functionName)error={code:-32601,message:"Unexpected method"};
        else{
          const values={name:DEPLOYED_TOKEN.tokenName,symbol:DEPLOYED_TOKEN.tokenSymbol,decimals:DEPLOYED_TOKEN.decimals,totalSupply:BigInt(DEPLOYED_TOKEN.supplyUnits)*10n**18n};
          result=encodeFunctionResult({abi:erc20Abi,functionName,result:values[functionName]});
        }
      }
    }else error={code:-32601,message:"Forbidden RPC"};
    response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({jsonrpc:"2.0",id:rpc.id,...error?{error}:{result}}));
  });
  try{
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const env={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,BASE_MAINNET_READ_RPC_URL:"http://127.0.0.1:"+server.address().port+"/?apiKey=test-only-secret-url"};
    const script=fileURLToPath(new URL("../scripts/verify-base-mainnet.js",import.meta.url));
    const outcome=await new Promise((resolve,reject)=>execFile(process.execPath,[script],{env,windowsHide:true,timeout:15000,maxBuffer:32*1024},(error,stdout,stderr)=>{
      if(error&&(error.killed||typeof error.code!=="number"))reject(error);else resolve({exitCode:error?.code??0,stdout,stderr});
    }));
    assert.deepEqual(contextErrors,[]);return {...outcome,calls};
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test("real viem HTTP transport preserves canonical block parameters and emits the observation",async()=>{
  const r=await runCli("success");assert.equal(r.exitCode,0,r.stderr);assert.equal(r.stderr,"");
  const value=JSON.parse(r.stdout);assert.equal(value.blockHash,HASH);assert.equal(value.blockNumber,"1234");assert.equal(value.canonicalBlockRequired,true);
  assert.equal(r.calls.length,9);assert(r.calls.every(row=>["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_call"].includes(row.method)));
});
test("unsupported hash parameter fails once without printing RPC credentials or response details",async()=>{
  const r=await runCli("unsupported");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");
  assert.equal(r.stderr,"Read-only "+DEPLOYED_TOKEN.tokenSymbol+" verification failed: RPC_ERROR\n");
  assert(!r.stderr.includes("test-only-secret"));assert.equal(r.calls.length,3);
});
test("reorganized final block cannot produce a successful CLI report",async()=>{
  const r=await runCli("reorg");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");
  assert.equal(r.stderr,"Read-only "+DEPLOYED_TOKEN.tokenSymbol+" verification failed: BLOCK_CHANGED\n");assert.equal(r.calls.length,8);
});
