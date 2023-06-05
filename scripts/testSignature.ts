import { ethers } from "hardhat";
import {
  Account__factory,
  ERC1967Proxy__factory,
  MockAccount__factory,
} from "../typechain";
import {
  createAccountOwner,
  getAccountInitCode,
} from "../test/utils/testUtils";
import { arrayify, hexConcat, keccak256 } from "ethers/lib/utils";
import { fillAndSign, getUserOpHash, signUserOp } from "../test/utils/UserOp";
async function main() {
  const ethersSigner = ethers.provider.getSigner();
  const accountOwner = createAccountOwner();
  const ep = await (await ethers.getContractFactory("EntryPoint")).deploy();
  const accountFactory = await (
    await ethers.getContractFactory("AccountFactory")
  ).deploy(ep.address);
  await accountFactory.createAccount(
    accountOwner.address,
    "0x".padEnd(66, "0")
  );
  const mockAccount = await new MockAccount__factory(ethersSigner).deploy();

  const accountAddress = await accountFactory.getAddress(
    accountOwner.address,
    "0x".padEnd(66, "0")
  );
  const account = await ethers.getContractAt("Account", accountAddress);
  await ethersSigner.sendTransaction({
    from: await ethersSigner.getAddress(),
    to: accountAddress,
    value: ethers.utils.parseEther("1"),
  });

  const tx = await account.populateTransaction
    .execute(accountOwner.address, ethers.utils.parseEther("0.2"), "0x")
    .then((tx) => tx.data!);

  const op = await fillAndSign(
    accountFactory,
    {
      sender: accountAddress,
      callData: tx,
    },
    accountOwner,
    ep
  );
  console.log(op.signature);

  const opHash = getUserOpHash(
    op,
    ep.address,
    (await ethers.provider.getNetwork()).chainId
  );
  // console.log(opHash);
  // console.log(await ep.callStatic.getUserOpHash(op));
  // const opHash =
  //   "0x8221913ee5f09a3e6ce32f2548310319b3635eada4ed60672d0614b11c9b2345";

  // console.log(await mockAccount._validateSignature(op, opHash));

  // console.log(op.signature);
  // console.log(opHash);
  console.log(
    ethers.utils.computeAddress(
      ethers.utils.recoverPublicKey(
        arrayify(
          ethers.utils.hashMessage(
            arrayify(
              "0x6f5b24fa0334c28af1c2e12d6692816d5636cf18ee9f061027b511345e8c4762"
            )
          )
        ),
        "0x6c096c4437b7b1cc19b5fafbc187e7dfc66a5f9634dec86329682649b49e7cb90ed00391f8597b1e756adb84dd6868861c116fd1be8ec976a7e7ae8e0fa106f11c"
      )
    )
  );
  // console.log(ethers.utils.hashMessage(arrayify(opHash)));
  // console.log("owner: ", accountOwner.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
