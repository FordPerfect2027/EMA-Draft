import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { encodeEventTopics, encodeAbiParameters, decodeFunctionData, erc20Abi } from "viem";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { TRANSFER_EVENT } from "../src/transfer-history.js";
import { APPROVAL_EVENT } from "../src/approval-history.js";
import { CLASSIC_ROUTER } from "../src/wallet-readiness.js";
import { parseHistoryCli, historyRpcUrl, HistoryCliInputError } from "../src/history-cli-input.js";

const ACCOUNT="0x"+"11".repeat(20), SENDER="0x"+"22".repeat(20);
const HASH="0x"+"ab".repeat(32), OTHER_HASH="0x"+"cd".repeat(32), TX="0x"+"ef".repeat(32);
const MAX=(1n<<256n)-1n;
const errorCode=code=>error=>error instanceof HistoryCliInputError&&error.code===code;

test("CLI preserves default, zero block and exact maximum uint256 inputs",()=>{
  assert.deepEqual(parseHistoryCli([ACCOUNT],2000n),{address:ACCOUNT,from:undefined,to:undefined});
  assert.deepEqual(parseHistoryCli([ACCOUNT,"0","1999"],2000n),{address:ACCOUNT,from:0n,to:1999n});
  assert.equal(parseHistoryCli([ACCOUNT,MAX.toString(),MAX.toString()],2000n).to,MAX);
});
test("invalid addresses and argument counts are rejected before parsing a range",()=>{
  for(const args of [[],[ACCOUNT,"1","2","extra"]])assert.throws(()=>parseHistoryCli(args,2000n),errorCode("USAGE"));
  for(const address of [null,"","bad","0x"+"00".repeat(20),"0x"+"11".repeat(32)])assert.throws(()=>parseHistoryCli([address],2000n),errorCode("INVALID_ADDRESS"));
});
test("decimal block input is bounded before BigInt conversion",()=>{
  for(const value of ["",null,"-1","1.5","1e9","01"," 2","0x2","9".repeat(79),(MAX+1n).toString()]){
    assert.throws(()=>parseHistoryCli([ACCOUNT,value],2000n),errorCode("INVALID_BLOCK"));
    assert.throws(()=>parseHistoryCli([ACCOUNT,"0",value],2000n),errorCode("INVALID_BLOCK"));
  }
});
test("known reversed or excessive ranges fail locally, including inclusive endpoints",()=>{
  for(const args of [[ACCOUNT,"2","1"],[ACCOUNT,"0","2000"]])assert.throws(()=>parseHistoryCli(args,2000n),errorCode("INVALID_RANGE"));
});
test("RPC URLs accept HTTPS only and do not echo credentials on refusal",()=>{
  assert.equal(historyRpcUrl("https://base-rpc.publicnode.com"),"https://base-rpc.publicnode.com/");
  for(const value of ["http://localhost","not a URL","https://user:test-only-secret@example.invalid","https://example.invalid/?key=test-only-secret","https://example.invalid/#test-only-secret"]){
    assert.throws(()=>historyRpcUrl(value),error=>errorCode("INVALID_RPC_URL")(error)&&!error.message.includes("test-only-secret"));
  }
});

async function runCli(kind, args, mode="positive", envOverride={}) {
  const calls=[],serverErrors=[];let headerCount=0;
  const script=kind==="transfer"?"inspect-transfers.js":"inspect-approvals.js";
  const server=createServer(async(request,response)=>{
    let body="";for await(const chunk of request)body+=chunk;
    const query=JSON.parse(body);calls.push(query);let result,error;
    try{
      if(mode==="provider-error")error={code:-32005,message:"test-only-secret-provider-detail",data:"https://dummy.invalid/path/test-only-secret"};
      else if(query.method==="eth_chainId")result="0x2105";
      else if(query.method==="eth_blockNumber")result="0x4d2";
      else if(query.method==="eth_getBlockByNumber"){
        ++headerCount;result={number:query.params[0],hash:mode==="reorg"&&headerCount>1?OTHER_HASH:HASH,transactions:[]};
      }else if(query.method==="eth_getLogs"){
        const filter=query.params[0];
        assert.equal(filter.address.toLowerCase(),DEPLOYED_TOKEN.contractAddress.toLowerCase());
        const event=kind==="transfer"?TRANSFER_EVENT:APPROVAL_EVENT;
        const eventArgs=kind==="transfer"?{from:SENDER,to:ACCOUNT}:{owner:ACCOUNT,spender:CLASSIC_ROUTER};
        const topics=encodeEventTopics({abi:[event],eventName:event.name,args:eventArgs});
        const log={address:DEPLOYED_TOKEN.contractAddress,topics,data:encodeAbiParameters([{type:"uint256"}],[5n]),blockNumber:"0x4d2",blockHash:HASH,transactionHash:TX,transactionIndex:"0x0",logIndex:"0x1",removed:false};
        const matches=filter.topics.every((topic,index)=>topic===null||topic===topics[index]);
        result=mode==="empty"||!matches?[]:[log];
      }else if(query.method==="eth_call"){
        assert.equal(kind,"approval");assert.deepEqual(query.params[1],{blockHash:HASH,requireCanonical:true});
        const call=decodeFunctionData({abi:erc20Abi,data:query.params[0].data});assert.equal(call.functionName,"allowance");
        assert.deepEqual(call.args.map(a=>a.toLowerCase()),[ACCOUNT,CLASSIC_ROUTER]);
        result=encodeAbiParameters([{type:"uint256"}],[1n]);
      }else throw Error("Forbidden RPC "+query.method);
    }catch(e){serverErrors.push(e.message);error={code:-32601,message:"Fixture assertion failed"};}
    response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({jsonrpc:"2.0",id:query.id,...error?{error}:{result}}));
  });
  try{
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const env={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,THREECORE_TEST_TRANSPORT:"http://127.0.0.1:"+server.address().port+"/",THREECORE_TEST_EXPECTED_ENDPOINT:"https://base-rpc.publicnode.com/",...envOverride};
    const preload=new URL("./support/local-rpc-preload.mjs",import.meta.url).href;
    const file=fileURLToPath(new URL("../scripts/"+script,import.meta.url));
    const result=await new Promise((resolve,reject)=>execFile(process.execPath,["--import",preload,file,...args],{env,windowsHide:true,timeout:15000,maxBuffer:65536},(error,stdout,stderr)=>{
      if(error&&(error.killed||typeof error.code!=="number"))reject(error);else resolve({exitCode:error?.code??0,stdout,stderr});
    }));
    assert.deepEqual(serverErrors,[]);return {...result,calls};
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

for(const kind of ["transfer","approval"]){
  test(kind+" CLI decodes a positive event through real viem HTTP, not a hard-coded empty result",async()=>{
    const r=await runCli(kind,[ACCOUNT,"1000","1234"]);assert.equal(r.exitCode,0,r.stderr);assert.equal(r.stderr,"");
    const report=JSON.parse(r.stdout),events=kind==="transfer"?report.events:report.approvalEvents;
    assert.equal(events.length,1);assert.equal(events[0].blockHash,HASH);assert.equal(events[0].blockNumber,"1234");
    assert.equal(report.fromBlock,"1000");assert.equal(report.toBlock,"1234");assert.equal(report.toBlockHash,HASH);assert.equal(report.endBlockRechecked,true);
    assert.equal(report.historyComplete,false);assert.equal(report.canonicalityVerified,false);assert.equal(report.transactionSent,false);
    if(kind==="approval"){
      assert.equal(events[0].approvedAmountBaseUnits,"5");assert.equal(report.allowanceAtSampleBlockBaseUnits,"1");assert.equal(report.eventHistoryIsNotAllowanceBalance,true);
    }else{
      assert.equal(events[0].amountBaseUnits,"5");assert.equal(events[0].direction,"incoming");assert.equal(events[0].from,SENDER);assert.equal(events[0].to,ACCOUNT);
    }
    assert.equal(r.calls.filter(row=>row.method==="eth_blockNumber").length,1,"Explicit end does not need an extra tip call before library validation");
    assert(r.calls.every(row=>["eth_chainId","eth_blockNumber","eth_getBlockByNumber","eth_getLogs","eth_call"].includes(row.method)));
  });
  test(kind+" CLI default window remains exactly 250 blocks and empty history is allowed",async()=>{
    const r=await runCli(kind,[ACCOUNT],"empty");assert.equal(r.exitCode,0,r.stderr);const report=JSON.parse(r.stdout);
    assert.equal(report.fromBlock,"985");assert.equal(report.toBlock,"1234");assert.equal((kind==="transfer"?report.events:report.approvalEvents).length,0);
    for(const query of r.calls.filter(row=>row.method==="eth_getLogs"))assert.deepEqual([query.params[0].fromBlock,query.params[0].toBlock],["0x3d9","0x4d2"]);
  });
  test(kind+" CLI rejects excessive ranges before any RPC",async()=>{
    const r=await runCli(kind,[ACCOUNT,"0","2000"]);assert.equal(r.calls.length,0);assert.equal(r.exitCode,2);assert.equal(r.stdout,"");assert.match(r.stderr,/INVALID_RANGE/);
  });
  test(kind+" CLI rejects oversized block text before any RPC",async()=>{
    const r=await runCli(kind,[ACCOUNT,"9".repeat(79)]);assert.equal(r.calls.length,0);assert.equal(r.exitCode,2);assert.equal(r.stdout,"");assert.match(r.stderr,/INVALID_BLOCK/);
  });
  test(kind+" CLI rejects invalid account and credential-bearing URL without network or echoed input",async()=>{
    const badAccount=await runCli(kind,["test-only-secret-private-input"]);assert.equal(badAccount.exitCode,2);assert.equal(badAccount.calls.length,0);assert(!badAccount.stderr.includes("test-only-secret"));
    const badUrl=await runCli(kind,[ACCOUNT],"positive",{THREECORE_READONLY_LOG_RPC:"https://user:test-only-secret@example.invalid"});assert.equal(badUrl.exitCode,2);assert.equal(badUrl.calls.length,0);assert(!badUrl.stderr.includes("test-only-secret"));assert.match(badUrl.stderr,/INVALID_RPC_URL/);
  });
  test(kind+" CLI fails on a changed canonical end block",async()=>{
    const r=await runCli(kind,[ACCOUNT,"1000","1234"],"reorg");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");assert.match(r.stderr,/BLOCK_CHANGED\n$/);
  });
  test(kind+" CLI reports one failed provider request without retry or leaked details",async()=>{
    const r=await runCli(kind,[ACCOUNT],"provider-error");assert.equal(r.exitCode,1);assert.equal(r.stdout,"");assert.equal(r.calls.length,1);assert.match(r.stderr,/RPC_ERROR\n$/);assert(!r.stderr.includes("test-only-secret"));
  });
}
