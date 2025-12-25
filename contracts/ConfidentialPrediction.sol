// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, ebool, euint32, euint64, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984Receiver} from "confidential-contracts-v91/contracts/interfaces/IERC7984Receiver.sol";

import {ConfidentialCoin} from "./ConfidentialCoin.sol";

contract ConfidentialPrediction is ZamaEthereumConfig, IERC7984Receiver {
    struct Prediction {
        string name;
        string[] options;
        address creator;
        bool isActive;
        bool totalsPublic;
        uint256 createdAt;
    }

    struct EncryptedBet {
        euint32 option;
        euint64 amount;
        bool exists;
    }

    uint8 private constant MIN_OPTIONS = 2;
    uint8 private constant MAX_OPTIONS = 4;

    ConfidentialCoin public immutable coin;
    Prediction[] private _predictions;
    mapping(uint256 id => euint64[]) private _optionTotals;
    mapping(uint256 id => mapping(address user => EncryptedBet)) private _bets;

    event PredictionCreated(uint256 indexed predictionId, address indexed creator, string name, string[] options);
    event BetPlaced(uint256 indexed predictionId, address indexed user, euint32 encryptedOption, euint64 encryptedAmount);
    event PredictionFinalized(uint256 indexed predictionId, address indexed requester);

    constructor(address coinAddress) {
        coin = ConfidentialCoin(coinAddress);
    }

    function predictionCount() external view returns (uint256) {
        return _predictions.length;
    }

    function getPrediction(uint256 predictionId) external view returns (Prediction memory) {
        return _predictions[predictionId];
    }

    function getOptionTotals(uint256 predictionId) external view returns (euint64[] memory) {
        return _optionTotals[predictionId];
    }

    function getEncryptedBet(uint256 predictionId, address user) external view returns (EncryptedBet memory) {
        return _bets[predictionId][user];
    }

    function createPrediction(string memory name, string[] memory options) external returns (uint256 predictionId) {
        require(bytes(name).length > 0, "Name required");
        require(options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS, "Invalid option count");

        predictionId = _predictions.length;

        Prediction storage created = _predictions.push();
        created.name = name;
        created.creator = msg.sender;
        created.isActive = true;
        created.totalsPublic = false;
        created.createdAt = block.timestamp;

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Empty option");
            created.options.push(options[i]);
            euint64 zero = FHE.asEuint64(0);
            FHE.allowThis(zero);
            _optionTotals[predictionId].push(zero);
        }

        emit PredictionCreated(predictionId, msg.sender, name, options);
    }

    function onConfidentialTransferReceived(
        address operator,
        address from,
        euint64 amount,
        bytes calldata data
    ) external returns (ebool) {
        require(msg.sender == address(coin), "Unsupported token");

        (uint256 predictionId, externalEuint32 encryptedSelection, bytes memory selectionProof) = abi.decode(
            data,
            (uint256, externalEuint32, bytes)
        );

        require(operator == from, "Operator mismatch");
        Prediction storage prediction = _predictions[predictionId];
        require(prediction.isActive, "Prediction closed");

        EncryptedBet storage userBet = _bets[predictionId][from];
        require(!userBet.exists, "Bet already placed");

        euint32 selection = FHE.fromExternal(encryptedSelection, selectionProof);

        euint64[] storage totals = _optionTotals[predictionId];
        for (uint256 i = 0; i < totals.length; i++) {
            ebool matches = FHE.eq(selection, FHE.asEuint32(uint32(i)));
            euint64 increment = FHE.select(matches, amount, FHE.asEuint64(0));
            euint64 updatedTotal = FHE.add(totals[i], increment);
            FHE.allowThis(updatedTotal);
            totals[i] = updatedTotal;
        }

        userBet.option = selection;
        userBet.amount = amount;
        userBet.exists = true;
        FHE.allow(selection, from);
        FHE.allow(selection, msg.sender);
        FHE.allow(amount, from);
        FHE.allow(amount, msg.sender);
        FHE.allowThis(selection);
        FHE.allowThis(amount);

        emit BetPlaced(predictionId, from, selection, amount);
        ebool confirmed = FHE.asEbool(true);
        FHE.allow(confirmed, msg.sender);
        return confirmed;
    }

    function finalizePrediction(uint256 predictionId) external {
        Prediction storage prediction = _predictions[predictionId];
        require(prediction.isActive, "Prediction already closed");
        require(prediction.creator == msg.sender, "Only creator can finalize");

        prediction.isActive = false;
        prediction.totalsPublic = true;

        euint64[] storage totals = _optionTotals[predictionId];
        for (uint256 i = 0; i < totals.length; i++) {
            FHE.makePubliclyDecryptable(totals[i]);
            FHE.allow(totals[i], msg.sender);
        }

        emit PredictionFinalized(predictionId, msg.sender);
    }
}
