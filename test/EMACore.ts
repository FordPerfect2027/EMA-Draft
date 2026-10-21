import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseSignature, zeroAddress } from "viem";

const INITIAL_SUPPLY_UNITS = 777_000_000n;
const INITIAL_SUPPLY = INITIAL_SUPPLY_UNITS * 10n ** 18n;

describe("EMACore", async function () {
  const { viem } = await network.create({
    network: "hardhatOp",
    chainType: "op",
  });
  const publicClient = await viem.getPublicClient();
  const [holder, recipient, spender, outsider] =
    await viem.getWalletClients();

  async function deploy() {
    return viem.deployContract("EMACore", [holder.account.address]);
  }

  async function signPermit(
    token: Awaited<ReturnType<typeof deploy>>,
    value: bigint,
    deadline: bigint,
  ) {
    const nonce = (await token.read.nonces([holder.account.address])) as bigint;
    const chainId = await publicClient.getChainId();
    const signature = await holder.signTypedData({
      account: holder.account,
      domain: {
        name: "EMA CORE",
        version: "1",
        chainId,
        verifyingContract: token.address,
      },
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      message: {
        owner: holder.account.address,
        spender: spender.account.address,
        value,
        nonce,
        deadline,
      },
    });

    return { nonce, ...parseSignature(signature) };
  }

  it("uses EMA CORE as the token name", async function () {
    const token = await deploy();
    assert.equal(await token.read.name(), "EMA CORE");
  });

  it("uses EMA as the token symbol", async function () {
    const token = await deploy();
    assert.equal(await token.read.symbol(), "EMA");
  });

  it("uses 18 decimals", async function () {
    const token = await deploy();
    assert.equal(await token.read.decimals(), 18);
  });

  it("publishes the fixed supply unit constant", async function () {
    const token = await deploy();
    assert.equal(await token.read.INITIAL_SUPPLY_UNITS(), INITIAL_SUPPLY_UNITS);
  });

  it("publishes the fixed base-unit supply constant", async function () {
    const token = await deploy();
    assert.equal(await token.read.INITIAL_SUPPLY(), INITIAL_SUPPLY);
  });

  it("mints the complete supply exactly once", async function () {
    const token = await deploy();
    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY);
  });

  it("assigns the complete supply to the initial holder", async function () {
    const token = await deploy();
    assert.equal(
      await token.read.balanceOf([holder.account.address]),
      INITIAL_SUPPLY,
    );
  });

  it("rejects the zero address as initial holder", async function () {
    await assert.rejects(() => viem.deployContract("EMACore", [zeroAddress]));
  });

  it("transfers EMA between holders", async function () {
    const token = await deploy();
    const amount = 125n * 10n ** 18n;

    await token.write.transfer([recipient.account.address, amount]);

    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      amount,
    );
  });

  it("rejects transfers greater than the holder balance", async function () {
    const token = await deploy();
    await assert.rejects(() =>
      token.write.transfer([recipient.account.address, INITIAL_SUPPLY + 1n]),
    );
    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY);
    assert.equal(await token.read.balanceOf([holder.account.address]), INITIAL_SUPPLY);
  });

  it("mints to a separate initial holder, not the transaction sender", async function () {
    const token = await viem.deployContract("EMACore", [recipient.account.address]);
    assert.equal(await token.read.balanceOf([recipient.account.address]), INITIAL_SUPPLY);
    assert.equal(await token.read.balanceOf([holder.account.address]), 0n);
  });

  it("rejects a burn exceeding the spender allowance", async function () {
    const token = await deploy();
    await token.write.approve([spender.account.address, 1n]);
    await assert.rejects(() =>
      token.write.burnFrom([holder.account.address, 2n], { account: spender.account }),
    );
    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY);
  });

  it("rejects a permit signed for another contract", async function () {
    const firstToken = await deploy();
    const secondToken = await deploy();
    const deadline = 2n ** 256n - 1n;
    const signature = await signPermit(firstToken, 1n, deadline);
    await assert.rejects(() =>
      secondToken.write.permit([
        holder.account.address, spender.account.address, 1n, deadline,
        Number(signature.v), signature.r, signature.s,
      ]),
    );
    assert.equal(await secondToken.read.nonces([holder.account.address]), 0n);
  });

  it("records ERC-20 allowances", async function () {
    const token = await deploy();
    const amount = 25n * 10n ** 18n;

    await token.write.approve([spender.account.address, amount]);

    assert.equal(
      await token.read.allowance([
        holder.account.address,
        spender.account.address,
      ]),
      amount,
    );
  });

  it("supports allowance-based transfers", async function () {
    const token = await deploy();
    const amount = 40n * 10n ** 18n;

    await token.write.approve([spender.account.address, amount]);
    await token.write.transferFrom(
      [holder.account.address, recipient.account.address, amount],
      { account: spender.account },
    );

    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      amount,
    );
  });

  it("lets a holder burn its own EMA", async function () {
    const token = await deploy();
    const amount = 10n * 10n ** 18n;

    await token.write.burn([amount]);

    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY - amount);
    assert.equal(
      await token.read.balanceOf([holder.account.address]),
      INITIAL_SUPPLY - amount,
    );
  });

  it("allows burnFrom only through an explicit allowance", async function () {
    const token = await deploy();
    const amount = 12n * 10n ** 18n;

    await token.write.approve([spender.account.address, amount]);
    await token.write.burnFrom([holder.account.address, amount], {
      account: spender.account,
    });

    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY - amount);
    assert.equal(
      await token.read.allowance([
        holder.account.address,
        spender.account.address,
      ]),
      0n,
    );
  });

  it("blocks burnFrom without an allowance", async function () {
    const token = await deploy();

    await assert.rejects(() =>
      token.write.burnFrom([holder.account.address, 1n], {
        account: outsider.account,
      }),
    );
  });

  it("blocks transfers to the zero address", async function () {
    const token = await deploy();

    await assert.rejects(() => token.write.transfer([zeroAddress, 1n]));
  });

  it("supports EIP-2612 nonce tracking", async function () {
    const token = await deploy();
    assert.equal(await token.read.nonces([holder.account.address]), 0n);
  });

  it("executes a signed EIP-2612 permit and rejects its replay", async function () {
    const token = await deploy();
    const permittedAmount = 30n * 10n ** 18n;
    const transferAmount = 10n * 10n ** 18n;
    const burnAmount = permittedAmount - transferAmount;
    const deadline = 2n ** 256n - 1n;
    const signature = await signPermit(token, permittedAmount, deadline);

    await token.write.permit(
      [
        holder.account.address,
        spender.account.address,
        permittedAmount,
        deadline,
        Number(signature.v),
        signature.r,
        signature.s,
      ],
      { account: outsider.account },
    );

    assert.equal(signature.nonce, 0n);
    assert.equal(await token.read.nonces([holder.account.address]), 1n);
    assert.equal(
      await token.read.allowance([
        holder.account.address,
        spender.account.address,
      ]),
      permittedAmount,
    );

    await token.write.transferFrom(
      [holder.account.address, recipient.account.address, transferAmount],
      { account: spender.account },
    );
    await token.write.burnFrom([holder.account.address, burnAmount], {
      account: spender.account,
    });

    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      transferAmount,
    );
    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY - burnAmount);
    assert.equal(
      await token.read.allowance([
        holder.account.address,
        spender.account.address,
      ]),
      0n,
    );

    await assert.rejects(() =>
      token.write.permit(
        [
          holder.account.address,
          spender.account.address,
          permittedAmount,
          deadline,
          Number(signature.v),
          signature.r,
          signature.s,
        ],
        { account: outsider.account },
      ),
    );
  });

  it("rejects an expired EIP-2612 permit", async function () {
    const token = await deploy();
    const amount = 1n * 10n ** 18n;
    const deadline = 0n;
    const signature = await signPermit(token, amount, deadline);

    await assert.rejects(() =>
      token.write.permit(
        [
          holder.account.address,
          spender.account.address,
          amount,
          deadline,
          Number(signature.v),
          signature.r,
          signature.s,
        ],
        { account: outsider.account },
      ),
    );
  });

  it("publishes the expected EIP-712 domain", async function () {
    const token = await deploy();
    const domain = (await token.read.eip712Domain()) as readonly [
      `0x${string}`,
      string,
      string,
      bigint,
      `0x${string}`,
      `0x${string}`,
      readonly bigint[],
    ];

    assert.equal(domain[1], "EMA CORE");
    assert.equal(domain[2], "1");
    assert.equal(domain[3], BigInt(await publicClient.getChainId()));
    assert.equal(domain[4].toLowerCase(), token.address.toLowerCase());
  });

  it("does not expose administrator mint, pause, or upgrade functions", async function () {
    const token = await deploy();
    const functionNames = new Set(
      token.abi
        .filter((item) => item.type === "function")
        .map((item) => item.name),
    );

    for (const forbiddenFunction of [
      "mint",
      "pause",
      "unpause",
      "upgradeTo",
      "upgradeToAndCall",
    ]) {
      assert.equal(functionNames.has(forbiddenFunction), false);
    }
  });

  it("does not expose an owner or administrator getter", async function () {
    const token = await deploy();
    const functionNames = new Set(
      token.abi
        .filter((item) => item.type === "function")
        .map((item) => item.name),
    );

    assert.equal(functionNames.has("owner"), false);
    assert.equal(functionNames.has("admin"), false);
  });
});
