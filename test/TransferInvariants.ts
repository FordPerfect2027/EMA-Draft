import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("EMACore balance and allowance invariants", async function () {
  const { viem } = await network.create({
    network: "hardhatOp",
    chainType: "op",
  });
  const [holder, recipient, spender, outsider] = await viem.getWalletClients();

  async function deploy() {
    return viem.deployContract("EMACore", [holder.account.address]);
  }

  it("preserves total supply and account balances across delegated transfers", async function () {
    const token = await deploy();
    const originalSupply = await token.read.totalSupply();
    const originalHolderBalance = (await token.read.balanceOf([holder.account.address])) as bigint;

    await token.write.approve([spender.account.address, 11n]);
    await token.write.transferFrom(
      [holder.account.address, recipient.account.address, 4n],
      { account: spender.account },
    );
    assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), 7n);

    await token.write.transferFrom(
      [holder.account.address, recipient.account.address, 7n],
      { account: spender.account },
    );
    assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), 0n);
    assert.equal(await token.read.balanceOf([recipient.account.address]), 11n);
    assert.equal(await token.read.balanceOf([holder.account.address]), originalHolderBalance - 11n);
    assert.equal(await token.read.totalSupply(), originalSupply);
  });

  it("rejects an unapproved transferFrom without changing balances", async function () {
    const token = await deploy();
    const initialSupply = (await token.read.totalSupply()) as bigint;
    const initialBalance = await token.read.balanceOf([holder.account.address]);

    await assert.rejects(() =>
      token.write.transferFrom(
        [holder.account.address, recipient.account.address, 1n],
        { account: outsider.account },
      ),
    );
    assert.equal(await token.read.balanceOf([holder.account.address]), initialBalance);
    assert.equal(await token.read.balanceOf([recipient.account.address]), 0n);
    assert.equal(await token.read.totalSupply(), initialSupply);
  });

  it("does not allow delegated spending beyond remaining allowance", async function () {
    const token = await deploy();
    await token.write.approve([spender.account.address, 5n]);
    await token.write.transferFrom(
      [holder.account.address, recipient.account.address, 3n],
      { account: spender.account },
    );
    await assert.rejects(() =>
      token.write.transferFrom(
        [holder.account.address, recipient.account.address, 3n],
        { account: spender.account },
      ),
    );
    assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), 2n);
    assert.equal(await token.read.balanceOf([recipient.account.address]), 3n);
  });

  it("reduces supply exactly by cumulative burns without changing other balances", async function () {
    const token = await deploy();
    const initialSupply = (await token.read.totalSupply()) as bigint;
    await token.write.transfer([recipient.account.address, 19n]);
    await token.write.burn([7n]);
    await token.write.burn([5n], { account: recipient.account });

    assert.equal(await token.read.totalSupply(), initialSupply - 12n);
    assert.equal(await token.read.balanceOf([recipient.account.address]), 14n);
    assert.equal(await token.read.balanceOf([holder.account.address]), initialSupply - 26n);
    assert.equal(
      ((await token.read.balanceOf([holder.account.address])) as bigint) +
        ((await token.read.balanceOf([recipient.account.address])) as bigint),
      await token.read.totalSupply(),
    );
  });
});
