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
import { createAccountOwner, fund, userOpsWithoutAgg } from "./utils/testUtils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";

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
  let txHash: string;
  let eta = Math.floor((Date.now() + 10000) / 1000);
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
    // await fund(guardianExecutor.address, "5");
    // await fund(guardianManager.address, "5");
  });

  it("Should initialize", async () => {
    await guardianExecutor.initialize(account.address, 1, 100000);
    await guardianManager.initialize(guardianExecutor.address, account.address);
    expect(await guardianManager.owner()).to.be.eq(accountOwner.address);
    expect(await guardianManager.account()).to.be.eq(account.address);
    expect(await guardianExecutor.owner()).to.be.eq(account.address);
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

  it("Should queue up transaction", async () => {
    const setThresholdCalldata = await guardianManager.populateTransaction
      .setThershold(3)
      .then((tx) => tx.data!);
    const queueCallData = await guardianExecutor.populateTransaction
      .queue(guardianManager.address, 0, "", setThresholdCalldata, eta)
      .then((tx) => tx.data!);
    const queueCall = await account.populateTransaction
      .execute(guardianExecutor.address, 0, queueCallData)
      .then((tx) => tx.data!);
    const userOp = await fillAndSign(
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
      .handleOps([userOp], guardian1.address, {
        gasLimit: 1000000,
      });

    const [log] = await guardianExecutor.queryFilter(
      guardianExecutor.filters.TransactionQueued(),
      await ethers.provider.getBlockNumber()
    );
    txHash = log.args.txHash;
    expect(await guardianExecutor.transactionQueue(txHash)).to.be.true;
  });

  it("Should execute transaction", async () => {
    const setThresholdCalldata = await guardianManager.populateTransaction
      .setThershold(3)
      .then((tx) => tx.data!);
    await new Promise((r) => setTimeout(r, 5000));
    const execCalldata = await guardianExecutor.populateTransaction
      .execute(guardianManager.address, 0, "", setThresholdCalldata, eta)
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
    expect(await guardianExecutor.transactionQueue(txHash)).to.be.false;
    expect(await guardianManager.threshold()).to.be.eq(3);
  });
});
