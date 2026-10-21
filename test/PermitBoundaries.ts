import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseSignature } from "viem";

// All accounts and contracts below exist exclusively in Hardhat's simulated
// EVM. This suite never reads a real wallet, keystore or remote chain.
describe("EMACore permit authorization boundaries", async function () {
  const { viem } = await network.create({ network: "hardhatOp", chainType: "op" });
  const publicClient = await viem.getPublicClient();
  const [holder, spender, outsider] = await viem.getWalletClients();
  const deadline = (1n << 256n) - 1n;
  const value = 5n;
  const permitTypes = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;
  const cases = [
    "wrong chain", "wrong contract", "wrong domain name", "wrong version",
    "wrong nonce", "wrong signer", "changed owner", "changed spender",
    "changed value", "changed deadline",
  ] as const;

  for (const scenario of cases) {
    it("rejects " + scenario + " without changing state or consuming the valid permit", async () => {
      const token = await viem.deployContract("EMACore", [holder.account.address]);
      await token.write.approve([spender.account.address, 9n]);
      const chainId = await publicClient.getChainId();
      const domain = {
        name: "EMA CORE", version: "1", chainId, verifyingContract: token.address,
      };
      const message = {
        owner: holder.account.address, spender: spender.account.address,
        value, nonce: 0n, deadline,
      };
      const signedDomain = { ...domain };
      const signedMessage = { ...message };
      const submitted = { ...message };
      let signer = holder;
      if (scenario === "wrong chain") signedDomain.chainId = chainId + 1;
      if (scenario === "wrong contract") {
        const other = await viem.deployContract("EMACore", [holder.account.address]);
        signedDomain.verifyingContract = other.address;
      }
      if (scenario === "wrong domain name") signedDomain.name += " other token";
      if (scenario === "wrong version") signedDomain.version = "2";
      if (scenario === "wrong nonce") signedMessage.nonce = 1n;
      if (scenario === "wrong signer") signer = outsider;
      if (scenario === "changed owner") submitted.owner = outsider.account.address;
      if (scenario === "changed spender") submitted.spender = outsider.account.address;
      if (scenario === "changed value") submitted.value = 6n;
      if (scenario === "changed deadline") submitted.deadline -= 1n;

      const signature = parseSignature(await signer.signTypedData({
        account: signer.account, domain: signedDomain, types: permitTypes,
        primaryType: "Permit", message: signedMessage,
      }));
      const initialSupply = await token.read.totalSupply();
      const initialBalance = await token.read.balanceOf([holder.account.address]);
      await assert.rejects(() => token.write.permit([
        submitted.owner, submitted.spender, submitted.value, submitted.deadline,
        Number(signature.v), signature.r, signature.s,
      ], { account: outsider.account }), /ERC2612InvalidSigner/);

      assert.equal(await token.read.nonces([holder.account.address]), 0n);
      assert.equal(await token.read.nonces([outsider.account.address]), 0n);
      assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), 9n);
      assert.equal(await token.read.allowance([holder.account.address, outsider.account.address]), 0n);
      assert.equal(await token.read.allowance([outsider.account.address, spender.account.address]), 0n);
      assert.equal(await token.read.totalSupply(), initialSupply);
      assert.equal(await token.read.balanceOf([holder.account.address]), initialBalance);

      // A valid signature after the rejection must still work, proving the
      // failed call did not consume the nonce or break the permit path.
      const valid = parseSignature(await holder.signTypedData({
        account: holder.account, domain, types: permitTypes,
        primaryType: "Permit", message,
      }));
      await token.write.permit([
        message.owner, message.spender, value, deadline,
        Number(valid.v), valid.r, valid.s,
      ], { account: outsider.account });
      assert.equal(await token.read.nonces([holder.account.address]), 1n);
      assert.equal(await token.read.allowance([holder.account.address, spender.account.address]), value);
    });
  }
});
