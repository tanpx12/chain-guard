import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  AccountFactory,
  EntryPoint,
  AccountFactory__factory,
  EntryPoint__factory,
} from "../typechain";
import { createAccountOwner } from "./utils/testUtils";

describe("AccountFactory test", async () => {
  const ethersSigner = ethers.provider.getSigner();
  let entryPoint: EntryPoint;
  let accountFactory: AccountFactory;
  let accountOwner: Wallet = createAccountOwner();
  let salt: string;
  before(async () => {
    entryPoint = await new EntryPoint__factory(ethersSigner).deploy();
    accountFactory = await new AccountFactory__factory(ethersSigner).deploy(
      entryPoint.address
    );
    salt = "0x".padEnd(66, "0");
  });

  it("Should create account", async () => {
    const accountAddress = await accountFactory.getAddress(
      accountOwner.address,
      salt
    );
    expect(
      await ethers.provider.getCode(accountAddress).then((code) => code.length)
    ).to.eq(2);
    await accountFactory.createAccount(accountOwner.address, salt);
    expect(
      await ethers.provider.getCode(accountAddress).then((code) => code.length)
    ).to.gt(2);
  });

  it("Should have the same owner", async () => {
    const accountAddress = await accountFactory.getAddress(
      accountOwner.address,
      salt
    );
    const account = await ethers.getContractAt(
      "Account",
      accountAddress,
      ethersSigner
    );
    expect(accountOwner.address).to.be.eq(await account.owner());
  });
});
