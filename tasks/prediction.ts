import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:contracts", "Print deployed contract addresses").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const coin = await deployments.get("ConfidentialCoin");
  const market = await deployments.get("ConfidentialPrediction");

  console.log(`ConfidentialCoin: ${coin.address}`);
  console.log(`ConfidentialPrediction: ${market.address}`);
});

task("task:prediction-count", "Print prediction count from the market").setAction(async function (_taskArguments, hre) {
  const { deployments, ethers } = hre;
  const deployment = await deployments.get("ConfidentialPrediction");
  const contract = await ethers.getContractAt("ConfidentialPrediction", deployment.address);

  const count = await contract.predictionCount();
  console.log(`Prediction count: ${count}`);
});
