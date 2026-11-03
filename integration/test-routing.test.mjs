import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,lstatSync} from "node:fs";
import {resolve,dirname,basename,join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("..",import.meta.url)),parent=resolve(tmpdir());
function fixture(t,exit=0,empty=false){
 const path=mkdtempSync(join(parent,"threecore-test-routing-"));
 t.after(()=>{assert.equal(dirname(resolve(path)),parent);assert(basename(path).startsWith("threecore-test-routing-"));assert(!lstatSync(path).isSymbolicLink());rmSync(path,{recursive:true,force:true});});
 for(const dir of ["scripts","contracts","test/support","node_modules/hardhat/dist/src"])mkdirSync(join(path,dir),{recursive:true});
 for(const file of ["scripts/test-contracts.js","scripts/check-contract-source.js"])writeFileSync(join(path,file),readFileSync(join(root,file)));
 writeFileSync(join(path,"package.json"),'{"type":"module"}');writeFileSync(join(path,"node_modules/hardhat/package.json"),'{"type":"module"}');
 writeFileSync(join(path,"contracts/Fixture.sol"),"pragma solidity ^0.8.24;\ncontract Fixture {}\n");
 const files=["test/operational.test.mjs","test/support/preload.mjs","test/support/helper.ts","test/types.d.ts"];
 if(!empty)files.push("test/Beta.ts","test/Alpha.ts");
 for(const file of files)writeFileSync(join(path,file),'throw Error("The routing fixture must not execute test files");\n');
 writeFileSync(join(path,"node_modules/hardhat/dist/src/cli.js"),'console.log(JSON.stringify(process.argv.slice(2)));process.exit('+exit+');\n');
 return path;
}
function run(path){return spawnSync(process.execPath,[join(path,"scripts/test-contracts.js"),"--no-compile"],{cwd:path,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|comspec|pathext)$/i.test(key))),encoding:"utf8",timeout:15000,windowsHide:true});}
test("actual runner includes TypeScript specs and excludes operational/support files",t=>{
 const result=run(fixture(t));assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),["test","nodejs","test/Alpha.ts","test/Beta.ts","--no-compile"]);
});
test("actual runner propagates a failing Hardhat result",t=>{const result=run(fixture(t,7));assert.equal(result.status,7);});
test("actual runner rejects an empty TypeScript suite before starting Hardhat",t=>{const result=run(fixture(t,0,true));assert.equal(result.status,1);assert.equal(result.stdout,"");assert.match(result.stderr,/Contract test runner failed/);});
