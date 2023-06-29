import { ethers } from "hardhat";
import {
  AccountFactory__factory,
  Account__factory,
  ERC1967Proxy__factory,
} from "../typechain";
import {
  createAccountOwner,
  getAccountInitCode,
} from "../test/utils/testUtils";
import { hexConcat, keccak256 } from "ethers/lib/utils";
import { sign } from "crypto";
async function main() {
  // const ethersSigner = ethers.provider.getSigner();
  // const accountOwner = createAccountOwner();
  // const ep = await (await ethers.getContractFactory("EntryPoint")).deploy();
  // const accountFactory = await (
  //   await ethers.getContractFactory("AccountFactory")
  // ).deploy(ep.address);
  // const account = await new Account__factory(ethersSigner).deploy(ep.address);
  // const functionCall = await ep.populateTransaction
  //   .depositTo(account.address)
  //   .then((tx) => tx.data!);
  // console.log(
  //   await account.populateTransaction
  //     .execute(ep.address, ethers.utils.parseEther("0.01"), functionCall)
  //     .then((tx) => tx.data!)
  // );
  // console.log(
  //   Account__factory.createInterface().encodeFunctionData("execute", [
  //     ep.address,
  //     ethers.utils.parseEther("0.01"),
  //     functionCall,
  //   ])
  // );

  const provider = ethers.provider;
  const signer = ethers.provider.getSigner();
  console.log(await signer.getAddress());

  // const accountFactory = AccountFactory__factory.connect(
  //   "0x3cbBEB88D053331AFE95e318719F38c8263357C0",
  //   provider
  // );
  // const tx = await accountFactory
  //   .connect(signer)
  //   .createAccount(
  //     "0x242ed78bF0FE7672FF01AE6dE558E45B3749f197",
  //     "0x".padEnd(66, "0")
  //   );
  // await tx.wait();
  // const accountAddress = await accountFactory.getAddress(
  //   "0x242ed78bF0FE7672FF01AE6dE558E45B3749f197",
  //   "0x".padEnd(66, "0")
  // );
  // const account = Account__factory.connect(accountAddress, provider);
  // console.log(await account.nonce());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
