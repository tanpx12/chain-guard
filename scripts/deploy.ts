// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  const owner = (await ethers.getSigners())[0];
  const salt =
    "0x7c5ea36004851c764c44143b1dcb59679b11c9a68e5f41497f6cf3d480715331";
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.deployed();
  console.log("Entry point deployed to: " + entryPoint.address);

  const SimpleAccountFactory = await ethers.getContractFactory(
    "SimpleAccountFactory"
  );
  const simpleAccountFactory = await SimpleAccountFactory.deploy(
    entryPoint.address
  );
  await simpleAccountFactory.deployed();
  console.log("AccountFactory deployed to:", simpleAccountFactory.address);
  console.log(
    "Account will be deploy to: " +
      (await simpleAccountFactory.getAddress(owner.address, salt))
  );
  await (await simpleAccountFactory.createAccount(owner.address, salt)).wait();

  const simpleAccount = await ethers.getContractAt(
    "SimpleAccount",
    await simpleAccountFactory.getAddress(owner.address, salt)
  );

  console.log(await simpleAccount.owner());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
