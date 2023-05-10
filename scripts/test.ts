import { ethers } from "hardhat";
import { Account__factory, ERC1967Proxy__factory } from "../typechain";
import { createAccountOwner } from "../test/utils/testUtils";
async function main() {
  const accountOwner = createAccountOwner();
  const ep = await (await ethers.getContractFactory("EntryPoint")).deploy();
  const accountFactory = await (
    await ethers.getContractFactory("AccountFactory")
  ).deploy(ep.address);
  const salt = "0x".padEnd(66, "0");
  console.log(await accountFactory.accountImplementation());
  console.log(await accountFactory.getAddress(accountOwner.address, salt));

  const functionCallEncoded =
    Account__factory.createInterface().encodeFunctionData("initialize", [
      accountOwner.address,
    ]);

  const bytes = new ethers.utils.AbiCoder().encode(
    ["address", "bytes"],
    [await accountFactory.accountImplementation(), functionCallEncoded]
  );
  const initCodeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["bytes", "bytes"],
      [ERC1967Proxy__factory.bytecode, bytes]
    )
  );
  console.log(
    ethers.utils.getCreate2Address(accountFactory.address, salt, initCodeHash)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
