import { ethers } from "hardhat";
import { Account__factory, ERC1967Proxy__factory } from "../typechain";
import {
  createAccountOwner,
  getAccountInitCode,
} from "../test/utils/testUtils";
import { hexConcat, keccak256 } from "ethers/lib/utils";
async function main() {
  const ethersSigner = ethers.provider.getSigner();
  const accountOwner = createAccountOwner();
  const ep = await (await ethers.getContractFactory("EntryPoint")).deploy();
  const accountFactory = await (
    await ethers.getContractFactory("AccountFactory")
  ).deploy(ep.address);
  const account = await new Account__factory(ethersSigner).deploy(ep.address);
  const functionCall = await ep.populateTransaction
    .depositTo(account.address)
    .then((tx) => tx.data!);
  console.log(
    await account.populateTransaction
      .execute(ep.address, ethers.utils.parseEther("0.01"), functionCall)
      .then((tx) => tx.data!)
  );
  console.log(
    Account__factory.createInterface().encodeFunctionData("execute", [
      ep.address,
      ethers.utils.parseEther("0.01"),
      functionCall,
    ])
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
