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
  const salt = "0x".padEnd(66, "0");
  console.log(await accountFactory.accountImplementation());
  console.log(await accountFactory.getAddress(accountOwner.address, salt));
  const initCode = accountFactory.interface.encodeFunctionData(
    "createAccount",
    [accountOwner.address, 0]
  );

  console.log(
    "0x" +
      keccak256(
        hexConcat([
          "0xff",
          "0x4e59b44847b379578588920ca78fbf26c0b4956c",
          salt,
          keccak256(initCode),
        ])
      ).slice(-40)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
