import { expect } from "chai";
import { ethers } from "hardhat";
import { Wallet, providers } from "ethers";
import {
  AccountFactory,
  EntryPoint,
  AccountFactory__factory,
  EntryPoint__factory,
  DepositPaymaster,
  DepositPaymaster__factory,
  Account,
  TestToken,
  TestToken__factory,
  MockOracle,
  MockOracle__factory,
} from "../typechain";
import {
  ETH_1,
  ETH_1000,
  ETH_2,
  ETH_2000,
  ETH_5,
  createAccountOwner,
  createAddress,
  sendEth,
  userOpsWithoutAgg,
} from "./utils/testUtils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { fillAndSign } from "./utils/UserOp";
import { hexConcat, hexZeroPad } from "ethers/lib/utils";

describe("Paymaster test", async () => {
  const ethersSigner = ethers.provider.getSigner();
  let signers: SignerWithAddress[];
  let entryPoint: EntryPoint;
  let accountFactory: AccountFactory;
  let paymaster: DepositPaymaster;
  let token1: TestToken;
  let token2: TestToken;
  let oracle1: MockOracle;
  let oracle2: MockOracle;
  let accountOwner: Wallet = createAccountOwner();
  let account: Account;
  before(async () => {
    let salt: string = "0x".padEnd(66, "0");
    let accountAddress;
    signers = await ethers.getSigners();

    entryPoint = await new EntryPoint__factory(ethersSigner).deploy();
    accountFactory = await new AccountFactory__factory(ethersSigner).deploy(
      entryPoint.address
    );
    paymaster = await new DepositPaymaster__factory(ethersSigner).deploy(
      entryPoint.address
    );

    await accountFactory.createAccount(accountOwner.address, salt);

    // deploy token1 and token2
    token1 = await new TestToken__factory(ethersSigner).deploy();
    token2 = await new TestToken__factory(ethersSigner).deploy();

    // mint token1 for signers
    await token1.connect(ethersSigner).mint(signers[0].address, ETH_1000);
    await token1.connect(ethersSigner).mint(signers[1].address, ETH_1000);

    // mint token2 for signers
    await token2.connect(ethersSigner).mint(signers[0].address, ETH_2000);
    await token2.connect(ethersSigner).mint(signers[1].address, ETH_2000);

    // deploy oracle1 and oracle2
    oracle1 = await new MockOracle__factory(ethersSigner).deploy(2);
    oracle2 = await new MockOracle__factory(ethersSigner).deploy(5);

    accountAddress = await accountFactory.getAddress(
      accountOwner.address,
      salt
    );
    account = await ethers.getContractAt(
      "Account",
      accountAddress,
      ethersSigner
    );

    await sendEth(ethersSigner, accountOwner.address);
    await paymaster.connect(ethersSigner).addStake(1, { value: ETH_2 });
    await entryPoint.depositTo(paymaster.address, { value: ETH_1 });
  });

  describe("- deposit and withdraw", async () => {
    it("Should token deployed", async () => {
      expect(token1.address).to.be.not.eq(token2.address);
      expect(await token1.balanceOf(signers[0].address)).to.be.eq(ETH_1000);
      expect(await token2.balanceOf(signers[0].address)).to.be.eq(ETH_2000);
    });

    it("Should be 2 different oracles", async () => {
      expect(oracle1.address).to.be.not.eq(oracle2.address);
      expect(await oracle1.getEthPrice()).to.be.eq(2);
      expect(await oracle2.getEthPrice()).to.be.eq(5);
    });

    it("Should add token to paymaster", async () => {
      await paymaster.addToken(token1.address, oracle1.address);
      await paymaster.addToken(token2.address, oracle2.address);

      expect(await paymaster.oracles(token1.address)).to.be.eq(oracle1.address);
      expect(await paymaster.oracles(token2.address)).to.be.eq(oracle2.address);
    });

    it("Should add deposit for accounts", async () => {
      await token1.connect(signers[0]).approve(paymaster.address, ETH_5);
      await token2.connect(signers[1]).approve(paymaster.address, ETH_5);

      await paymaster
        .connect(signers[0])
        .addDepositFor(token1.address, signers[0].address, ETH_5);
      await paymaster
        .connect(signers[1])
        .addDepositFor(token2.address, signers[1].address, ETH_5);

      expect(
        (await paymaster.depositInfo(token1.address, signers[0].address)).amount
      ).to.be.eq(ETH_5);
      expect(
        (await paymaster.depositInfo(token2.address, signers[1].address)).amount
      ).to.be.eq(ETH_5);
    });

    it("Should be able to withdraw token", async () => {
      await paymaster.connect(signers[0]).unlockTokenDeposit();
      await paymaster.withdrawTokensTo(
        token1.address,
        signers[2].address,
        ETH_2
      );
      expect(await token1.balanceOf(signers[2].address)).to.be.eq(ETH_2);
      expect(
        (await paymaster.depositInfo(token1.address, signers[0].address)).amount
      ).to.be.eq(ethers.utils.parseEther("3"));
    });
  });

  describe("- validatePaymasterUserOp", async () => {
    it("Should fail if no token", async () => {
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: paymaster.address,
        },
        accountOwner,
        entryPoint
      );
      expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.revertedWith("paymasterAndData must specify token");
    });

    it("Should fail with wrong token", async () => {
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad("0x1245", 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.revertedWith("DepositPaymaster: unsupported token");
    });

    it("Should reject if no deposit", async () => {
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.revertedWith("DepositPaymaster: deposit too low");
    });

    it("Should reject if deposit is not locked", async () => {
      await token1.connect(signers[0]).approve(paymaster.address, ETH_5);
      await paymaster
        .connect(signers[0])
        .addDepositFor(token1.address, account.address, ETH_5);

      const paymasterUnlock = await paymaster.populateTransaction
        .unlockTokenDeposit()
        .then((tx) => tx.data!);
      await account
        .connect(accountOwner)
        .execute(paymaster.address, 0, paymasterUnlock);
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      expect(
        entryPoint.callStatic.simulateValidation(userOp)
      ).to.be.revertedWith("DepositPaymaster: deposit not locked");
    });

    it("Should succeed with valid deposit", async () => {
      const paymasterLock = await paymaster.populateTransaction
        .lockTokenDeposit()
        .then((tx) => tx.data!);
      await account
        .connect(accountOwner)
        .execute(paymaster.address, 0, paymasterLock);

      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      await entryPoint.callStatic
        .simulateValidation(userOp)
        .catch((err) => console.log(err.errorArgs));
    });
  });

  describe("handleUserOps", async () => {
    before(async () => {
      await token1.connect(ethersSigner).mint(account.address, ETH_1000);
    });
    it("Should pay deposit (and revert user's call) if user can't pay with token", async () => {
      const beneficiary = createAddress();
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleAggregatedOps(userOpsWithoutAgg([userOp]), beneficiary);
      const [log] = await entryPoint.queryFilter(
        entryPoint.filters.UserOperationEvent()
      );

      expect(log.args.success).to.eq(false);
      expect(await ethers.provider.getBalance(beneficiary)).to.be.gt(0);
    });

    it("Should pay with tokens if available", async () => {
      const beneficiary = createAddress();
      const beneficiary1 = createAddress();

      const tokenApprovePaymaster = await token1.populateTransaction
        .approve(paymaster.address, ETH_5)
        .then((tx) => tx.data!);
      const execApprove = await account.populateTransaction
        .execute(token1.address, 0, tokenApprovePaymaster)
        .then((tx) => tx.data!);
      const userOp1 = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
          callData: execApprove,
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleOps([userOp1], beneficiary1, {
          gasLimit: 1000000,
        });

      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          paymasterAndData: hexConcat([
            paymaster.address,
            hexZeroPad(token1.address, 20),
          ]),
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleAggregatedOps(userOpsWithoutAgg([userOp]), beneficiary, {
          gasLimit: 1000000,
        });
      const [log] = await entryPoint.queryFilter(
        entryPoint.filters.UserOperationEvent(),
        await ethers.provider.getBlockNumber()
      );

      expect(log.args.success).to.eq(true);
      const charge = log.args.actualGasCost;
      expect(await ethers.provider.getBalance(beneficiary)).to.eq(charge);
    });
  });
});
