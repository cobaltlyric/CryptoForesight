# CryptoForesight

CryptoForesight is a privacy-preserving prediction app built on Zama FHEVM. Users buy cCoin with ETH
(1 ETH = 1,000,000 cCoin), create predictions with 2-4 options, place encrypted bets, and later reveal
encrypted totals when the prediction is finalized. All sensitive inputs stay confidential on-chain
until the creator chooses to make totals publicly decryptable.

## Core Features
- ETH to cCoin purchase at a fixed on-chain rate (1 ETH = 1,000,000 cCoin).
- Predictions with 2-4 options, created by any user.
- Encrypted bet selection and encrypted bet amount per user.
- Encrypted per-option totals stored on-chain and updated homomorphically.
- Creator-only finalization that makes totals publicly decryptable.
- Fully on-chain audit trail via events (creation, bet placement, finalization).

## Problems Solved
- Prevents early signaling and copy-betting by keeping selections private.
- Reduces manipulation risk by hiding live totals until finalization.
- Keeps user amounts private without relying on off-chain custodians.
- Preserves verifiable on-chain history while protecting sensitive data.

## Advantages
- Strong privacy with FHEVM: compute on encrypted data without decryption.
- Simple economic flow: buy cCoin, bet confidentially, reveal totals later.
- Clear ownership and access control: only the creator can finalize.
- Transparent logic and state transitions with predictable on-chain rules.

## Tech Stack
- Smart contracts: Solidity 0.8.27, Hardhat, hardhat-deploy
- Privacy layer: Zama FHEVM (FHE) + ERC7984 confidential token standard
- Libraries: OpenZeppelin (Ownable)
- Frontend: React + Vite, RainbowKit, wagmi, viem (reads), ethers (writes)
- Styling: CSS stylesheets (no Tailwind)

## Architecture Overview
- On-chain core: encrypted token + encrypted prediction market contracts.
- Deployment pipeline: Hardhat scripts in `deploy/`.
- Developer utilities: Hardhat tasks in `tasks/` and tests in `test/`.
- Frontend app: React UI in `ui/` using contract ABIs and deployed addresses.

## Smart Contracts

### ConfidentialCoin (`contracts/ConfidentialCoin.sol`)
- ERC7984 confidential token used for betting.
- `purchase()` mints encrypted cCoin based on ETH sent.
- `mint()` is owner-only for administrative minting.
- `withdraw()` is owner-only to withdraw ETH from contract.
- Fixed rate constant: `PURCHASE_RATE = 1_000_000`.

### ConfidentialPrediction (`contracts/ConfidentialPrediction.sol`)
- `createPrediction(name, options)` with 2-4 options.
- Bets are placed via confidential transfer callbacks.
- Encrypted totals are updated on-chain with FHE operations.
- `finalizePrediction()` makes totals publicly decryptable and closes the market.
- Only the prediction creator can finalize.

## Privacy and Data Model
- Bet selections and bet amounts are encrypted end-to-end on-chain.
- Option totals are maintained as encrypted aggregates.
- Finalization marks totals as publicly decryptable for anyone to read.
- No plaintext bet data is stored before finalization.

## Current Scope and Limitations
- No automatic payouts or winner settlement (records only).
- Predictions are closed manually by the creator.
- No dispute system or oracle integration in this version.
- Designed for testnet usage; not audited for mainnet deployment.

## Repository Structure
```
.
├── contracts/           # Smart contracts
├── deploy/              # Deployment scripts
├── deployments/         # Network deployment artifacts
├── tasks/               # Hardhat tasks
├── test/                # Contract tests
├── ui/                  # React frontend
├── hardhat.config.ts    # Hardhat configuration
└── README.md
```

## Setup

### 1) Install dependencies
```bash
npm install
cd ui && npm install
```

### 2) Configure environment variables
Create a `.env` in the project root with:
```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=optional_etherscan_key
```
Notes:
- Deployments use `PRIVATE_KEY` (no mnemonic).
- If `INFURA_API_KEY` is not set, Sepolia falls back to a public RPC URL.

### 3) Compile and test
```bash
npx hardhat compile
npx hardhat test
```

### 4) Local node (optional for development)
```bash
npx hardhat node
npx hardhat deploy --network anvil
```

### 5) Deploy to Sepolia
```bash
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### 6) Update frontend contract config
1. Copy ABIs from `deployments/sepolia`.
2. Paste them into `ui/src/config/contracts.ts`.
3. Update `COIN_ADDRESS` and `PREDICTION_ADDRESS` with the Sepolia addresses.

### 7) Run the frontend
```bash
cd ui
npm run dev
```
The UI connects to Sepolia via RainbowKit/wagmi. Ensure your wallet is on Sepolia.

## User Flow
1. Connect a wallet on Sepolia.
2. Buy cCoin with ETH.
3. Create a prediction with 2-4 options.
4. Place an encrypted bet using cCoin.
5. Finalize the prediction to reveal encrypted totals publicly.

## Developer Notes
- Read-only calls use viem; state-changing calls use ethers.
- Prediction totals become publicly decryptable only after finalization.
- Contracts rely on FHEVM for encrypted computation and access control.

## Future Roadmap
- Automated settlement and payout logic for winning options.
- Time-based auto-finalization and optional creator timeouts.
- Multi-asset betting (support for additional confidential tokens).
- Enhanced analytics views over publicly decryptable totals.
- Indexer integration for faster UI queries and history views.
- Governance for market rules and fee structures.
- Security reviews and production-hardening for mainnet readiness.

## License
BSD-3-Clause-Clear. See `LICENSE`.
