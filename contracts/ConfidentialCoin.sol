// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "confidential-contracts-v91/contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ConfidentialCoin is ERC7984, ZamaEthereumConfig, Ownable {
    uint64 public constant PURCHASE_RATE = 1_000_000;

    event CoinPurchased(address indexed buyer, uint256 ethSpent, uint64 mintedAmount, euint64 encryptedAmount);
    event EtherWithdrawn(address indexed recipient, uint256 amount);

    constructor() ERC7984("cCoin", "CC", "") Ownable(msg.sender) {}

    function purchase() external payable returns (euint64 mintedAmount) {
        require(msg.value > 0, "No ETH sent");

        uint64 clearAmount = uint64((msg.value * PURCHASE_RATE) / 1 ether);
        require(clearAmount > 0, "Amount too small");

        mintedAmount = _mintWithAmount(msg.sender, clearAmount);
        emit CoinPurchased(msg.sender, msg.value, clearAmount, mintedAmount);
    }

    function mint(address to, uint64 clearAmount) external onlyOwner returns (euint64 mintedAmount) {
        require(clearAmount > 0, "Amount too small");
        mintedAmount = _mintWithAmount(to, clearAmount);
        emit CoinPurchased(to, 0, clearAmount, mintedAmount);
    }

    function withdraw(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        uint256 valueToSend = amount == 0 ? address(this).balance : amount;
        require(valueToSend <= address(this).balance, "Insufficient balance");

        (bool success, ) = recipient.call{value: valueToSend}("");
        require(success, "Withdraw failed");
        emit EtherWithdrawn(recipient, valueToSend);
    }

    function rate() external pure returns (uint64) {
        return PURCHASE_RATE;
    }

    function _mintWithAmount(address to, uint64 clearAmount) private returns (euint64 mintedAmount) {
        euint64 encryptedAmount = FHE.asEuint64(clearAmount);
        mintedAmount = _mint(to, encryptedAmount);
        FHE.allow(mintedAmount, to);
    }
}
