import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";

import { Account } from "../typechain";

import {
  createAccount,
  createAccountOwner,
  getBalance,
  ETH_1,
  HashZero,
} from "./utils/testUtils";
import { fillUserOpDefault, getUserOpHash, signUserOp } from "./utils/UserOp";
import { parseEther } from "ethers/lib/utils";
import { UserOperation } from "./utils/UserOperation";

describe("Account Test", function () {
  const entryPoint = "0x".padEnd(42, "2");
  let accounts: string[];
  let accountOwner: Wallet;
  const ethersSigner = ethers.provider.getSigner();

  before(async function () {
    accounts = await ethers.provider.listAccounts();
    if (accounts.length < 2) this.skip();
    accountOwner = createAccountOwner();
  });

  it("owner should be able to call transfer", async () => {
    const { proxy: account } = await createAccount(
      ethersSigner,
      accounts[0],
      entryPoint
    );
    console.log(await account.nonce());
    await ethersSigner.sendTransaction({
      from: accounts[0],
      to: account.address,
      value: parseEther("2"),
    });
    await account.execute(accounts[2], ETH_1, "0x");
  });

  it("other account should not be able to call transfer", async () => {
    const { proxy: account } = await createAccount(
      ethersSigner,
      accounts[0],
      entryPoint
    );
    await expect(
      account
        .connect(ethers.provider.getSigner(1))
        .execute(accounts[2], ETH_1, "0x")
    ).to.be.revertedWith(
      "Account:: _requireFromEntryPointOrOwner : not Owner or EntryPoint"
    );
  });

  describe("#validateUserOp", async () => {
    let account: Account;
    let userOp: UserOperation;
    let userOpHash: string;
    let preBalance: number;
    let expectedPay: number;

    const actualGasPrice = 1e9;

    before(async () => {
      const entryPoint = accounts[2];
      ({ proxy: account } = await createAccount(
        await ethers.getSigner(entryPoint),
        accountOwner.address,
        entryPoint
      ));
      await ethersSigner.sendTransaction({
        from: accounts[0],
        to: account.address,
        value: parseEther("0.2"),
      });
      const callGasLimit = 200000;
      const verificationGasLimit = 100000;
      const maxFeePerGas = 3e9;
      const chainId = await ethers.provider
        .getNetwork()
        .then((net) => net.chainId);

      userOp = signUserOp(
        fillUserOpDefault({
          sender: account.address,
          callGasLimit,
          verificationGasLimit,
          maxFeePerGas,
        }),
        accountOwner,
        entryPoint,
        chainId
      );
      userOpHash = getUserOpHash(userOp, entryPoint, chainId);

      expectedPay = actualGasPrice * (callGasLimit + verificationGasLimit);

      preBalance = await getBalance(account.address);

      const ret = await account.validateUserOp(
        userOp,
        userOpHash,
        expectedPay,
        { gasPrice: actualGasPrice }
      );
      await ret.wait();
    });

    it("should pay", async () => {
      const postBalance = await getBalance(account.address);
      expect(preBalance - postBalance).to.eq(expectedPay);
    });

    it("should increment nonce", async () => {
      expect(await account.nonce()).to.eq(2);
    });

    it("should reject same tx on nonce error", async () => {
      await expect(
        account.validateUserOp(userOp, userOpHash, 0)
      ).to.revertedWith("Account:: _validateAndUpdateNonce : invalid nonce");
    });

    it("should return NO_SIG_VALIDATION on wrong signature", async () => {
      const userOpHash = HashZero;
      const deadline = await account.callStatic.validateUserOp(
        { ...userOp, nonce: 2 },
        userOpHash,
        0
      );
      expect(deadline).to.eq(1);
    });
  });
});
