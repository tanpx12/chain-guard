import { ethers } from "hardhat";
import { Account__factory, ERC1967Proxy__factory } from "../typechain";
import {
  createAccountOwner,
  getAccountInitCode,
} from "../test/utils/testUtils";
import { hexConcat, keccak256 } from "ethers/lib/utils";
async function main() {
  const accountOwner = createAccountOwner();
  const ep = await (await ethers.getContractFactory("EntryPoint")).deploy();
  const accountFactory = await (
    await ethers.getContractFactory("AccountFactory")
  ).deploy(ep.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
