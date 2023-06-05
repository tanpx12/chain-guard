import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Account,
  AccountFactory,
  EntryPoint,
  GuardianManager,
  GuardianExecutor,
  EntryPoint__factory,
  AccountFactory__factory,
  GuardianExecutor__factory,
  GuardianManager__factory,
} from "../typechain";
import { fillAndSign } from "./utils/UserOp";
import { createAccountOwner, fund } from "./utils/testUtils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { before } from "mocha";
import { hexConcat, keccak256 } from "ethers/lib/utils";

describe("Guardian test", async () => {
  const ethersSigner = ethers.provider.getSigner();
  let signers: SignerWithAddress[];
  let entryPoint: EntryPoint;
  let accountFactory: AccountFactory;
  let accountOwner: Wallet = createAccountOwner();
  let account: Account;
  let guardianManager: GuardianManager;
  let guardianExecutor: GuardianExecutor;

  let guardian1: Wallet = createAccountOwner();
  let guardian2: Wallet = createAccountOwner();
  let guardian3: Wallet = createAccountOwner();
  let guardian4: Wallet = createAccountOwner();

  let txHash0: string;
  let txHash1: string;

  before(async () => {
    let salt: string = "0x".padEnd(66, "0");
    signers = await ethers.getSigners();

    entryPoint = await new EntryPoint__factory(ethersSigner).deploy();
    accountFactory = await new AccountFactory__factory(ethersSigner).deploy(
      entryPoint.address
    );
    await accountFactory.createAccount(accountOwner.address, salt);
    let accountAddress = await accountFactory.getAddress(
      accountOwner.address,
      salt
    );
    account = await ethers.getContractAt(
      "Account",
      accountAddress,
      ethersSigner
    );
    guardianExecutor = await new GuardianExecutor__factory(
      ethersSigner
    ).deploy();
    guardianManager = await new GuardianManager__factory(ethersSigner).deploy();

    await fund(accountOwner.address, "5");
    await fund(account.address, "5");
    await fund(guardian1.address, "5");
    // await fund(guardianExecutor.address, "5");
    // await fund(guardianManager.address, "5");
  });

  it("Should initialize", async () => {
    await guardianExecutor.initialize(account.address, 0, 100000);
    await guardianManager.initialize(guardianExecutor.address, account.address);
    expect(await guardianManager.owner()).to.be.eq(accountOwner.address);
    expect(await guardianManager.account()).to.be.eq(account.address);
    expect(await guardianExecutor.account()).to.be.eq(account.address);
  });

  it("Should setup guardians", async () => {
    const setupCallData = await guardianManager.populateTransaction
      .setupGuardians(
        [guardian1.address, guardian2.address, guardian3.address],
        2
      )
      .then((tx) => tx.data!);
    const execSetup = await account.populateTransaction
      .execute(guardianManager.address, 0, setupCallData)
      .then((tx) => tx.data!);

    const userOp = await fillAndSign(
      accountFactory,
      {
        sender: account.address,
        callData: execSetup,
      },
      accountOwner,
      entryPoint
    );

    await entryPoint
      .connect(ethersSigner)
      .handleOps([userOp], guardian1.address, {
        gasLimit: 1000000,
      });

    expect(await guardianManager.guardianCount()).to.be.eq(3);
    expect(await guardianManager.threshold()).to.be.eq(2);
    expect(await guardianManager.guardians(guardian1.address)).to.be.true;
    expect(await guardianManager.guardians(guardian2.address)).to.be.true;
    expect(await guardianManager.guardians(guardian3.address)).to.be.true;
  });
  describe("#guardian executor", async () => {
    let setThresholdCalldata0: BytesLike;
    let setThresholdCalldata1: BytesLike;

    let queueCalldata0: BytesLike;
    let queueCalldata1: BytesLike;

    let queueCall0: BytesLike;
    let queueCall1: BytesLike;
    let eta: BigNumberish;

    before(async () => {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      eta = block.timestamp + 2;
      setThresholdCalldata0 = await guardianManager.populateTransaction
        .setThershold(3)
        .then((tx) => tx.data!);
      setThresholdCalldata1 = await guardianManager.populateTransaction
        .setThershold(1)
        .then((tx) => tx.data!);

      queueCalldata0 = await guardianExecutor.populateTransaction
        .queue(guardianManager.address, 0, "", setThresholdCalldata0, eta)
        .then((tx) => tx.data!);
      queueCalldata1 = await guardianExecutor.populateTransaction
        .queue(guardianManager.address, 0, "", setThresholdCalldata1, eta)
        .then((tx) => tx.data!);

      queueCall0 = await account.populateTransaction
        .execute(guardianExecutor.address, 0, queueCalldata0)
        .then((tx) => tx.data!);
      queueCall1 = await account.populateTransaction
        .execute(guardianExecutor.address, 0, queueCalldata1)
        .then((tx) => tx.data!);
    });

    it("Should queue up transaction", async () => {
      const userOp0 = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: queueCall0,
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleOps([userOp0], guardian1.address, {
          gasLimit: 1000000,
        });

      const userOp1 = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: queueCall1,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([userOp1], guardian1.address, {
          gasLimit: 1000000,
        });

      const [log0, log1] = await guardianExecutor.queryFilter(
        guardianExecutor.filters.TransactionQueued()
      );
      txHash0 = log0.args.txHash;
      txHash1 = log1.args.txHash;
      expect(await guardianExecutor.transactionQueue(txHash0)).to.be.true;
      expect(await guardianExecutor.transactionQueue(txHash1)).to.be.true;
    });

    it("Should execute transaction", async () => {
      await new Promise((r) => setTimeout(r, 1000));
      const execCalldata = await guardianExecutor.populateTransaction
        .execute(guardianManager.address, 0, "", setThresholdCalldata0, eta)
        .then((tx) => tx.data!);
      const execCall = await account.populateTransaction
        .execute(
          guardianExecutor.address,
          ethers.utils.parseEther("0.1"),
          execCalldata,
          { gasLimit: 1000000 }
        )
        .then((tx) => tx.data!);
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: execCall,
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleOps([userOp], guardian1.address, { gasLimit: 1000000 });
      expect(await guardianExecutor.transactionQueue(txHash0)).to.be.false;
      expect(await guardianManager.threshold()).to.be.eq(3);
    });

    it("Should cancel transaction", async () => {
      const cancelCalldata = await guardianExecutor.populateTransaction
        .cancel(guardianManager.address, 0, "", setThresholdCalldata1, eta)
        .then((tx) => tx.data!);
      const cancelCall = await account.populateTransaction
        .execute(guardianExecutor.address, 0, cancelCalldata)
        .then((tx) => tx.data!);
      const userOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: cancelCall,
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleOps([userOp], guardian1.address, { gasLimit: 1000000 });
      expect(await guardianExecutor.transactionQueue(txHash1)).to.be.false;
    });
  });

  describe("#guardian manager", async () => {
    let setThresholdCalldata: BytesLike;
    let addGuardianCalldata: BytesLike;
    let removeGuardianCalldata: BytesLike;
    let eta: BigNumberish;
    before(async () => {
      setThresholdCalldata = await guardianManager.populateTransaction
        .setThershold(2)
        .then((tx) => tx.data!);
      addGuardianCalldata = await guardianManager.populateTransaction
        .addGuardian(guardian4.address)
        .then((tx) => tx.data!);
      removeGuardianCalldata = await guardianManager.populateTransaction
        .removeGuardian(guardian3.address)
        .then((tx) => tx.data!);
    });

    it("should set threshold", async () => {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      eta = block.timestamp + 1;
      // queue setThreshold() call
      const queueCalldata = await guardianExecutor.populateTransaction
        .queue(guardianManager.address, 0, "", setThresholdCalldata, eta)
        .then((tx) => tx.data!);
      const queueCall = await account.populateTransaction
        .execute(guardianExecutor.address, 0, queueCalldata)
        .then((tx) => tx.data!);
      const queueUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: queueCall,
        },
        accountOwner,
        entryPoint
      );
      await entryPoint
        .connect(ethersSigner)
        .handleOps([queueUserOp], guardian1.address, { gasLimit: 1000000 });

      // execute setThreshold() call
      await new Promise((r) => setTimeout(r, 1000));
      const executeCalldata = await guardianExecutor.populateTransaction
        .execute(guardianManager.address, 0, "", setThresholdCalldata, eta)
        .then((tx) => tx.data!);
      const executeCall = await account.populateTransaction
        .execute(
          guardianExecutor.address,
          ethers.utils.parseEther("0.1"),
          executeCalldata
        )
        .then((tx) => tx.data!);
      const executeUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: executeCall,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([executeUserOp], guardian1.address, { gasLimit: 1000000 });
      expect(await guardianManager.threshold()).to.be.eq(2);
    });

    it("should add guardian", async () => {
      // queue addGuardian() call
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      eta = block.timestamp + 1;
      const queueCalldata = await guardianExecutor.populateTransaction
        .queue(guardianManager.address, 0, "", addGuardianCalldata, eta)
        .then((tx) => tx.data!);
      const queueCall = await account.populateTransaction
        .execute(guardianExecutor.address, 0, queueCalldata)
        .then((tx) => tx.data!);
      const queueUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: queueCall,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([queueUserOp], guardian1.address, { gasLimit: 1000000 });

      // execute addGuardian() call
      await new Promise((r) => setTimeout(r, 1000));
      const executeCalldata = await guardianExecutor.populateTransaction
        .execute(guardianManager.address, 0, "", addGuardianCalldata, eta)
        .then((tx) => tx.data!);
      const executeCall = await account.populateTransaction
        .execute(
          guardianExecutor.address,
          ethers.utils.parseEther("0.1"),
          executeCalldata
        )
        .then((tx) => tx.data!);
      const executeUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: executeCall,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([executeUserOp], guardian1.address, { gasLimit: 1000000 });
      expect(await guardianManager.guardians(guardian4.address)).to.be.true;
      expect(await guardianManager.guardianCount()).to.be.eq(4);
    });
    it("should remove guardian", async () => {
      // queue removeGuardian() call
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      eta = block.timestamp + 1;

      const queueCalldata = await guardianExecutor.populateTransaction
        .queue(guardianManager.address, 0, "", removeGuardianCalldata, eta)
        .then((tx) => tx.data!);
      const queueCall = await account.populateTransaction
        .execute(guardianExecutor.address, 0, queueCalldata)
        .then((tx) => tx.data!);
      const queueUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: queueCall,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([queueUserOp], guardian1.address, { gasLimit: 1000000 });

      // execute removeGuardian() call
      await new Promise((r) => setTimeout(r, 1000));
      const executeCalldata = await guardianExecutor.populateTransaction
        .execute(guardianManager.address, 0, "", removeGuardianCalldata, eta)
        .then((tx) => tx.data!);
      const executeCall = await account.populateTransaction
        .execute(
          guardianExecutor.address,
          ethers.utils.parseEther("0.1"),
          executeCalldata
        )
        .then((tx) => tx.data!);
      const executeUserOp = await fillAndSign(
        accountFactory,
        {
          sender: account.address,
          callData: executeCall,
        },
        accountOwner,
        entryPoint
      );

      await entryPoint
        .connect(ethersSigner)
        .handleOps([executeUserOp], guardian1.address, { gasLimit: 1000000 });
      expect(await guardianManager.guardians(guardian3.address)).to.be.false;
      expect(await guardianManager.guardianCount()).to.be.eq(3);
    });

    it("should verify signatures", async () => {
      const calldata = "0x00";
      const dataHash = ethers.utils.hashMessage(calldata);
      const guardians = [guardian1, guardian2, guardian4];
      guardians.sort((a, b) =>
        BigNumber.from(a.address).lt(BigNumber.from(b.address)) ? -1 : 1
      );
      const sigs = await Promise.all(
        guardians.map(async (w) => await w.signMessage(calldata))
      );
      const signature = hexConcat(sigs);
      expect(
        await guardianManager.checkSignatures(dataHash, calldata, signature, 3)
      ).to.be.true;
    });

    it("should change owner", async () => {
      await account
        .connect(accountOwner)
        .setUpGuardian(guardianManager.address, guardianExecutor.address);
      const newOwner = createAccountOwner();

      const dataHash = ethers.utils.hashMessage(newOwner.address);
      const guardians = [guardian1, guardian2, guardian4];
      guardians.sort((a, b) =>
        BigNumber.from(a.address).lt(BigNumber.from(b.address)) ? -1 : 1
      );
      const sigs = await Promise.all(
        guardians.map(async (w) => await w.signMessage(newOwner.address))
      );
      const signatures = hexConcat(sigs);
      await guardianManager
        .connect(guardian1)
        .changeOwner(dataHash, newOwner.address, signatures, {
          value: ethers.utils.parseEther("0.1"),
          gasLimit: 1000000,
        });
      expect(await account.owner()).to.be.eq(newOwner.address);
      expect(await guardianManager.owner()).to.be.eq(newOwner.address);
    });
  });
});
