import { network } from "hardhat";
import { getAddress, isAddress, zeroAddress } from "viem";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const EXPECTED_INITIAL_SUPPLY = 777_000_000n * 10n ** 18n;

if (process.env.DEPLOY_APPROVAL !== "BASE_SEPOLIA_TEST_ONLY") {
  throw new Error("Deployment refused: set DEPLOY_APPROVAL=BASE_SEPOLIA_TEST_ONLY only after explicit testnet approval.");
}
if (!process.env.INITIAL_HOLDER) {
  throw new Error("Deployment refused: INITIAL_HOLDER must be explicitly provided and confirmed.");
}

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chainId = await publicClient.getChainId();

if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(
    `Deployment refused: expected Base Sepolia chain ID ${BASE_SEPOLIA_CHAIN_ID}, received ${chainId}.`,
  );
}

const requestedInitialHolder =
  process.env.INITIAL_HOLDER;

if (!isAddress(requestedInitialHolder)) {
  throw new Error("INITIAL_HOLDER must be a valid EVM address.");
}

const initialHolder = getAddress(requestedInitialHolder);

if (initialHolder === zeroAddress) {
  throw new Error("INITIAL_HOLDER must not be the zero address.");
}

const datCore = await viem.deployContract("EMACore", [initialHolder]);
const bytecode = await publicClient.getBytecode({ address: datCore.address });

if (bytecode === undefined || bytecode === "0x") {
  throw new Error("Deployment transaction completed without contract bytecode.");
}

const totalSupply = await datCore.read.totalSupply();
const initialHolderBalance = await datCore.read.balanceOf([initialHolder]);

if (totalSupply !== EXPECTED_INITIAL_SUPPLY) {
  throw new Error(
    `Unexpected total supply: expected ${EXPECTED_INITIAL_SUPPLY}, received ${totalSupply}.`,
  );
}

if (initialHolderBalance !== EXPECTED_INITIAL_SUPPLY) {
  throw new Error(
    `Unexpected initial-holder balance: expected ${EXPECTED_INITIAL_SUPPLY}, received ${initialHolderBalance}.`,
  );
}

console.log(
  JSON.stringify(
    {
      network: "Base Sepolia",
      chainId,
      deployer: deployer.account.address,
      initialHolder,
      contractAddress: datCore.address,
      totalSupply: totalSupply.toString(),
      initialHolderBalance: initialHolderBalance.toString(),
      explorer: `https://sepolia.basescan.org/address/${datCore.address}`,
    },
    null,
    2,
  ),
);

