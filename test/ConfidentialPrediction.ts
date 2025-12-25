import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ConfidentialPrediction", function () {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let coin: any;
  let market: any;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [owner, alice] = signers;

    const coinFactory = await ethers.getContractFactory("ConfidentialCoin");
    coin = await coinFactory.deploy();
    const coinAddress = await coin.getAddress();

    const marketFactory = await ethers.getContractFactory("ConfidentialPrediction");
    market = await marketFactory.deploy(coinAddress);
  });

  it("mints cCoin for ETH purchases", async function () {
    const oneEth = ethers.parseEther("1");
    const coinAddress = await coin.getAddress();

    await expect(coin.connect(alice).purchase({ value: oneEth })).to.emit(coin, "CoinPurchased");

    const encryptedBalance = await coin.confidentialBalanceOf(alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      coinAddress,
      alice,
    );

    expect(clearBalance).to.equal(BigInt(1_000_000));
  });

  it("creates predictions, accepts encrypted bets, and exposes totals publicly after finalization", async function () {
    const coinAddress = await coin.getAddress();
    const marketAddress = await market.getAddress();

    await coin.connect(alice).purchase({ value: ethers.parseEther("0.5") });

    const currentCount = await market.predictionCount();
    const predictionId = Number(currentCount);
    await expect(market.connect(owner).createPrediction("Market sentiment", ["Bull", "Bear"])).to.emit(
      market,
      "PredictionCreated",
    );

    const betAmount = 42_000;
    const selectionInput = await fhevm.createEncryptedInput(marketAddress, coinAddress).add32(1).encrypt();
    const amountInput = await fhevm.createEncryptedInput(coinAddress, alice.address).add64(betAmount).encrypt();

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bytes32", "bytes"],
      [predictionId, selectionInput.handles[0], selectionInput.inputProof],
    );

    await expect(
      coin
        .connect(alice)
        ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
          marketAddress,
          amountInput.handles[0],
          amountInput.inputProof,
          data,
        ),
    ).to.emit(market, "BetPlaced");

    const storedBet = await market.getEncryptedBet(predictionId, alice.address);
    const clearBetAmount = await fhevm.userDecryptEuint(FhevmType.euint64, storedBet.amount, marketAddress, alice);
    expect(clearBetAmount).to.equal(BigInt(betAmount));

    await expect(market.connect(owner).finalizePrediction(predictionId)).to.emit(market, "PredictionFinalized");

    const totals = await market.getOptionTotals(predictionId);
    const decryptedTotal = await fhevm.publicDecryptEuint(FhevmType.euint64, totals[1]);
    expect(decryptedTotal).to.equal(BigInt(betAmount));
  });
});
