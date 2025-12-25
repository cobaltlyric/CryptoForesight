import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const confidentialCoin = await deploy("ConfidentialCoin", {
    from: deployer,
    log: true,
  });

  const prediction = await deploy("ConfidentialPrediction", {
    from: deployer,
    args: [confidentialCoin.address],
    log: true,
  });

  console.log(`ConfidentialCoin contract: ${confidentialCoin.address}`);
  console.log(`ConfidentialPrediction contract: ${prediction.address}`);
};
export default func;
func.id = "deploy_confidential_prediction"; // id required to prevent reexecution
func.tags = ["ConfidentialPrediction"];
