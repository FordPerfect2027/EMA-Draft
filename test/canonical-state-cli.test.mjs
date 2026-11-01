import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rpc, HASH, OTHER_HASH, ACCOUNT } from "./support/state-rpc.mjs";
import { canonicalStateRead } from "../src/canonical-state-read.js";

async function runCli(script, args, mode = "success") {
  const client = rpc(mode === "reorg" ? {after:{number:"0x4d2",hash:OTHER_HASH}} : {});
  const actualCalls = [], contextErrors = [];
  const server = createServer(async (request,response) => {
    let body=""; for await(const chunk of request)body+=chunk;
    const query=JSON.parse(body);actualCalls.push(query);let result,error;
    if(["eth_getCode","eth_getBalance","eth_call"].includes(query.method)){
      try{assert.deepEqual(query.params[1],{blockHash:HASH,requireCanonical:true});}catch(e){contextErrors.push(e.message);}
    }
    if(mode==="unsupported"&&query.method==="eth_getCode")error={code:-32602,message:"test-only-secret-provider-response",data:"https://dummy.invalid/?apiKey=test-only-secret"};
    else try{result=await client.request(query);}catch{error={code:-32601,message:"Unexpected RPC"};}
    response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({jsonrpc:"2.0",id:query.id,...error?{error}:{result}}));
  });
  try{
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const env={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,THREECORE_TEST_TRANSPORT:"http://127.0.0.1:"+server.address().port+"/"};
    const preload=new URL("./support/local-rpc-preload.mjs",import.meta.url).href;
    const target=fileURLToPath(new URL("../scripts/"+script,import.meta.url));
    const result=await new Promise((resolve,reject)=>execFile(process.execPath,["--import",preload,target,...args],{env,windowsHide:true,timeout:15000,maxBuffer:32768},(error,stdout,stderr)=>{
      if(error&&(error.killed||typeof error.code!=="number"))reject(error);else resolve({exitCode:error?.code??0,stdout,stderr});
    }));
    assert.deepEqual(contextErrors,[]);return {...result,calls:actualCalls};
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
for(const kind of [
  {script:"inspect-wallet-readiness.js",args:[ACCOUNT],hashField:"observedBlockHash",calls:9},
  {script:"quote-dex.js",args:["buy","1000000"],hashField:"blockHash",calls:14},
]){
  test(kind.script+" real CLI/viem HTTP preserves every canonical parameter",async()=>{
    const r=await runCli(kind.script,kind.args);assert.equal(r.exitCode,0,r.stderr);assert.equal(r.stderr,"");
    assert.equal(JSON.parse(r.stdout)[kind.hashField],HASH);assert.equal(r.calls.length,kind.calls);
    assert(r.calls.every(row=>["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_getBalance","eth_call"].includes(row.method)));
  });
  test(kind.script+" reorganization exits unsuccessfully without output",async()=>{
    const r=await runCli(kind.script,kind.args,"reorg");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");assert.match(r.stderr,/BLOCK_CHANGED\n$/);assert.equal(r.calls.length,kind.calls-1);
  });
  test(kind.script+" unsupported hash cannot retry weaker reads or leak provider details",async()=>{
    const r=await runCli(kind.script,kind.args,"unsupported");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");assert.match(r.stderr,/RPC_ERROR\n$/);assert(!r.stderr.includes("test-only-secret"));
    assert.equal(r.calls.filter(row=>row.method==="eth_getBlockByNumber").length,1);
    assert(r.calls.filter(row=>row.method==="eth_getCode").every(row=>row.params[1].requireCanonical));
  });
}
test("quote CLI bounds integer text before conversion or network access",async()=>{
  const r=await runCli("quote-dex.js",["buy","9".repeat(79)]);assert.equal(r.exitCode,2);assert.equal(r.calls.length,0);assert.equal(r.stdout,"");
});
test("state reader rejects a write ABI function before eth_call",async()=>{
  const client=rpc(),fail=(code)=>{throw Object.assign(Error(code),{code});};
  const snapshot=await canonicalStateRead(client,8453,fail,"WRONG_NETWORK");
  await assert.rejects(snapshot.readContract(ACCOUNT,[{type:"function",name:"approve",stateMutability:"nonpayable",inputs:[],outputs:[]}],"approve"),error=>error.code==="INVALID_READ_METHOD");
  assert.equal(client.calls.length,2);
});
