import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { config, network } from "hardhat";
import { createPublicClient, custom } from "viem";
import { DEPLOYED_TOKEN } from "../src/onchain-identity.js";
import { inspectAccountTransfers } from "../src/transfer-history.js";
import { inspectApprovalHistory } from "../src/approval-history.js";

const contracts = {
  "@0628dao/datcore": "DATCore",
  "@0628dao/emacore": "EMACore",
  "@0628dao/caweloncore": "CAWELONCore",
};
const contract = contracts[JSON.parse(readFileSync("package.json", "utf8")).name];
assert.ok(contract, "Run from a supported token repository");
assert.equal(config.networks.hardhatOp.type, "edr-simulated");
assert.equal(config.networks.hardhatOp.forking, undefined, "No remote fork is permitted");

describe(`${contract}: event history against the local EVM`, async () => {
  const connection = await network.create({
    network: "hardhatOp", chainType: "op", override: { chainId: 8453 },
  });
  after(() => connection.close());
  const { viem, provider } = connection;
  const client = await viem.getPublicClient();
  const pinnedCalls = [];
  const pinnedClient = createPublicClient({
    batch: { multicall: false },
    transport: custom({
      request(args) {
        assert.equal(args.method, "eth_call");
        assert.match(args.params[0].data, /^0xdd62ed3e[0-9a-fA-F]{128}$/);
        assert.match(args.params[1].blockHash, /^0x[0-9a-f]{64}$/);
        assert.equal(args.params[1].requireCanonical, true);
        assert.equal(args.params[1].blockNumber, undefined);
        pinnedCalls.push(args);
        return provider.request(args);
      },
    }, { retryCount: 0 }),
  });
  const [holder, spender, receiver] = await viem.getWalletClients();
  let token, firstBlock;
  beforeEach(async () => {
    pinnedCalls.length = 0;
    token = await viem.deployContract(contract, [holder.account.address]);
    firstBlock = await client.getBlockNumber({ cacheTime: 0 });
  });

  // This test maps ONLY the published token address to the local deployment.
  // Event values, amounts, hashes and positions come from the actual local EVM.
  // It does not claim to inspect the deployed Base Mainnet contract.
  function reader(transform = logs => logs) {
    return {
      getChainId: () => client.getChainId(),
      getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
      getBlock: args => client.getBlock(args),
      async getLogs(args) {
        assert.equal(args.address.toLowerCase(), DEPLOYED_TOKEN.contractAddress.toLowerCase());
        const logs = await client.getLogs({ ...args, address: token.address, strict: true });
        return transform(logs.map(log => ({ ...log, address: DEPLOYED_TOKEN.contractAddress })), args);
      },
      async readContract(args) {
        assert.equal(args.address.toLowerCase(), DEPLOYED_TOKEN.contractAddress.toLowerCase());
        assert.equal(args.functionName, "allowance");
        assert.match(args.blockHash, /^0x[0-9a-f]{64}$/);
        assert.equal(args.requireCanonical, true);
        assert.equal(args.blockNumber, undefined);
        return pinnedClient.readContract({ ...args, address: token.address });
      },
    };
  }
  const transferOptions = () => ({ accountAddress: holder.account.address, fromBlock: firstBlock });
  const approvalOptions = () => ({
    ownerAddress: holder.account.address, spenderAddress: spender.account.address, fromBlock: firstBlock,
  });
  async function unchanged(operation) {
    const snapshot = async () => ({
      block: await client.getBlockNumber({ cacheTime: 0 }),
      holderNonce: await client.getTransactionCount({ address: holder.account.address }),
      spenderNonce: await client.getTransactionCount({ address: spender.account.address }),
      supply: await token.read.totalSupply(),
      balance: await token.read.balanceOf([holder.account.address]),
      allowance: await token.read.allowance([holder.account.address, spender.account.address]),
      permitNonce: await token.read.nonces([holder.account.address]),
    });
    const before = await snapshot();
    try { return await operation(); }
    finally { assert.deepEqual(await snapshot(), before, "History reads must not change EVM state"); }
  }

  it("reads actual mint, transfer, self-transfer and burn logs with mined identities", async () => {
    await token.write.transfer([receiver.account.address, 5n]);
    await token.write.transfer([holder.account.address, 3n]);
    await token.write.burn([4n]);
    const report = await unchanged(() => inspectAccountTransfers(reader(), transferOptions()));
    assert.equal(report.events.length, 4);
    assert.deepEqual(report.events.map(x => x.direction), ["incoming", "outgoing", "self", "outgoing"]);
    assert.equal(report.events[0].mintEvent, true);
    assert.equal(report.events[3].burnEvent, true);
    assert.equal(report.events[2].amountBaseUnits, "3");
    for (const event of report.events) {
      assert.equal(event.blockHash, (await client.getBlock({ blockNumber: BigInt(event.blockNumber) })).hash);
    }
    assert.equal(report.canonicalityVerified, false);
    assert.equal(report.historyComplete, false);
  });
  it("keeps Approval event amounts distinct from allowance consumed by transferFrom", async () => {
    await token.write.approve([spender.account.address, 100n]);
    await token.write.transferFrom([holder.account.address, receiver.account.address, 20n], {
      account: spender.account,
    });
    const report = await unchanged(() => inspectApprovalHistory(reader(), approvalOptions()));
    assert.deepEqual(report.approvalEvents.map(x => x.approvedAmountBaseUnits), ["100"]);
    assert.equal(report.allowanceAtSampleBlockBaseUnits, "80");
    assert.equal(report.eventHistoryIsNotAllowanceBalance, true);
  });
  it("preserves maximum approval and a later zero-amount revocation exactly", async () => {
    const maximum = (1n << 256n) - 1n;
    await token.write.approve([spender.account.address, maximum]);
    const approved = await unchanged(() => inspectApprovalHistory(reader(), approvalOptions()));
    assert.equal(approved.allowanceAtSampleBlockBaseUnits, maximum.toString());
    await token.write.approve([spender.account.address, 0n]);
    const revoked = await unchanged(() => inspectApprovalHistory(reader(), approvalOptions()));
    assert.deepEqual(revoked.approvalEvents.map(x => x.approvedAmountBaseUnits), [maximum.toString(), "0"]);
    assert.equal(revoked.approvalEvents[1].revocationEvent, true);
    assert.equal(revoked.allowanceAtSampleBlockBaseUnits, "0");
  });
  it("keeps the sampled allowance when the local chain advances during history reads", async () => {
    await token.write.approve([spender.account.address, 7n]);
    const original = await client.getBlock();
    let advanced = false;
    const rpc = reader(async logs => {
      if (!advanced) {
        advanced = true;
        // Only this test fixture writes; the history reader has read-only methods.
        await token.write.approve([spender.account.address, 11n]);
      }
      return logs;
    });
    const report = await inspectApprovalHistory(rpc, approvalOptions());
    assert.equal(advanced, true);
    assert.equal(report.toBlockHash, original.hash);
    assert.equal(report.allowanceAtSampleBlockBaseUnits, "7");
    assert.deepEqual(report.approvalEvents.map(x => x.approvedAmountBaseUnits), ["7"]);
    assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), 11n);
    assert.ok(pinnedCalls.length > 0);
    assert.ok(pinnedCalls.every(args => args.params[1].blockHash === original.hash));
  });
  for (const kind of ["Transfer", "Approval"]) {
    const inspect = rpc => kind === "Transfer"
      ? inspectAccountTransfers(rpc, transferOptions())
      : inspectApprovalHistory(rpc, approvalOptions());
    it(`${kind}: refuses removed flags injected into otherwise real local logs`, async () => {
      await token.write.approve([spender.account.address, 1n]);
      const rpc = reader(logs => logs.map(log => ({ ...log, removed: true })));
      await unchanged(() => assert.rejects(inspect(rpc), error => error.code === "REMOVED_LOG"));
    });
    it(`${kind}: refuses a conflicting duplicate of an actual local event`, async () => {
      await token.write.approve([spender.account.address, 1n]);
      const rpc = reader(logs => logs.length
        ? [...logs, { ...logs[0], transactionIndex: logs[0].transactionIndex + 1 }]
        : logs);
      await unchanged(() => assert.rejects(inspect(rpc), error => error.code === "CONFLICTING_LOG"));
    });
    it(`${kind}: rejects a local chain replacement and succeeds on a fresh snapshot`, async () => {
      const checkpoint = await provider.request({ method: "evm_snapshot" });
      const write = value => kind === "Transfer"
        ? token.write.transfer([receiver.account.address, value])
        : token.write.approve([spender.account.address, value]);
      await write(7n);
      const removed = await client.getBlock();
      let replacement;
      const rpc = reader(async logs => {
        if (!replacement) {
          replacement = (async () => {
            assert.equal(await provider.request({ method: "evm_revert", params: [checkpoint] }), true);
            await write(11n);
          })();
        }
        await replacement;
        return logs;
      });
      await assert.rejects(inspect(rpc), error =>
        ["BLOCK_CHANGED", "LOG_BLOCK_CHANGED", "CONFLICTING_LOG"].includes(error.code) ||
        /not found|not exist|canonical|unknown block|invalid block/i.test(error.message));
      assert.ok(replacement, "The actual local chain must have been replaced");
      await replacement;
      const current = await client.getBlock();
      assert.equal(current.number, removed.number);
      assert.notEqual(current.hash, removed.hash);
      const fresh = await unchanged(() => inspect(reader()));
      assert.equal(fresh.toBlockHash, current.hash);
      if (kind === "Approval") {
        assert.equal(fresh.allowanceAtSampleBlockBaseUnits, "11");
      } else {
        assert.deepEqual(fresh.events.filter(x => x.direction === "outgoing").map(x => x.amountBaseUnits), ["11"]);
      }
    });
  }
});
