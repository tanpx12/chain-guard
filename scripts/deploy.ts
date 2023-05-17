// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import * as dotenv from "dotenv";
import { ethers } from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
dotenv.config();

async function main() {
  const AccountFactory = await ethers.getContractFactory("AccountFactory");
  const accountFactory = await AccountFactory.deploy(
    process.env.ENTRYPOINT as string
  );
  await accountFactory.deployed();

  const Paymaster = await ethers.getContractFactory("DepositPaymaster");
  const paymaster = await Paymaster.deploy(process.env.ENTRYPOINT as string);
  await paymaster.deployed();

  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(2);
  await oracle.deployed();

  const Token = await ethers.getContractFactory("TestToken");
  const token = await Token.deploy();
  await token.deployed();

  const deployedAddresses = {
    accountFactoryAddr: accountFactory.address,
    paymasterAddr: paymaster.address,
    oracleAddr: oracle.address,
    tokenAddr: token.address,
  };

  writeFileSync(
    resolve("./scripts/addresses.ts"),
    "export const deployedAddresses =" + JSON.stringify(deployedAddresses),
    "utf-8"
  );

  console.log(
    "======================== Contracts deployed ========================"
  );
  console.log("AccountFactory at: ", accountFactory.address);
  console.log("Paymaster at: ", paymaster.address);
  console.log("Oracle at: ", oracle.address);
  console.log("Token at: ", token.address);
  console.log(
    "===================================================================="
  );
  await paymaster.addToken(token.address, oracle.address);

  await paymaster.oracles(token.address).then((res) => console.log(res));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
