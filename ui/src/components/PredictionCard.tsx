import { useMemo, useState } from 'react';
import { ethers } from 'ethers';

import { COIN_ABI, COIN_ADDRESS, PREDICTION_ABI, PREDICTION_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/Cards.css';

export type PredictionEntry = {
  id: number;
  name: string;
  options: string[];
  isActive: boolean;
  totalsPublic: boolean;
  creator: string;
  createdAt: bigint;
  totals: readonly string[];
  bet?: {
    amount: string;
    option: string;
    exists: boolean;
  };
};

type PredictionCardProps = {
  entry: PredictionEntry;
  address?: string;
  instance: any;
  onAction?: () => void;
};

export function PredictionCard({ entry, address, instance, onAction }: PredictionCardProps) {
  const signer = useEthersSigner();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [stakeInput, setStakeInput] = useState('');
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decryptedTotals, setDecryptedTotals] = useState<string[] | null>(null);
  const [isDecryptingTotals, setIsDecryptingTotals] = useState(false);
  const [isDecryptingBet, setIsDecryptingBet] = useState(false);
  const [myBet, setMyBet] = useState<string | null>(null);

  const createdLabel = useMemo(() => {
    const date = new Date(Number(entry.createdAt) * 1000);
    return date.toLocaleString();
  }, [entry.createdAt]);

  const formatCoin = (value: string | number) =>
    (Number(value) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const handleBet = async () => {
    if (!address) {
      setTxStatus('Connect a wallet to bet.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setTxStatus('No signer available.');
      return;
    }
    if (selectedOption === null) {
      setTxStatus('Choose an option first.');
      return;
    }
    const parsed = Number(stakeInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setTxStatus('Enter a valid stake.');
      return;
    }
    if (!instance) {
      setTxStatus('Encryption SDK not ready.');
      return;
    }

    try {
      setIsSubmitting(true);
      setTxStatus(null);
      setMyBet(null);

      const amount = BigInt(Math.round(parsed * 1_000_000));
      const selectionInput = instance.createEncryptedInput(PREDICTION_ADDRESS, COIN_ADDRESS);
      selectionInput.add32(selectedOption);
      const encryptedSelection = await selectionInput.encrypt();

      const amountInput = instance.createEncryptedInput(COIN_ADDRESS, address);
      amountInput.add64(amount);
      const encryptedAmount = await amountInput.encrypt();

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'bytes32', 'bytes'],
        [entry.id, encryptedSelection.handles[0], encryptedSelection.inputProof]
      );

      const coin = new ethers.Contract(COIN_ADDRESS, COIN_ABI, resolvedSigner);
      const tx = await coin['confidentialTransferAndCall(address,bytes32,bytes,bytes)'](
        PREDICTION_ADDRESS,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        data
      );
      await tx.wait();
      onAction?.();
      setTxStatus('Encrypted bet submitted.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bet failed';
      setTxStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizePrediction = async () => {
    const resolvedSigner = await signer;
    if (!resolvedSigner) return;
    try {
      setIsSubmitting(true);
      setTxStatus(null);
      const contract = new ethers.Contract(PREDICTION_ADDRESS, PREDICTION_ABI, resolvedSigner);
      const tx = await contract.finalizePrediction(entry.id);
      await tx.wait();
      onAction?.();
      setTxStatus('Prediction finalized.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Finalize failed';
      setTxStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const decryptTotals = async () => {
    if (!instance || !entry.totalsPublic) return;
    try {
      setIsDecryptingTotals(true);
      setTxStatus(null);
      const result = await instance.publicDecrypt(entry.totals);
      const values = entry.totals.map((handle) => {
        const value = (result.clearValues && result.clearValues[handle]) || '0';
        return formatCoin(value);
      });
      setDecryptedTotals(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to decrypt totals';
      setTxStatus(message);
    } finally {
      setIsDecryptingTotals(false);
    }
  };

  const decryptMyBet = async () => {
    if (!instance || !address || !entry.bet?.exists) return;
    const resolvedSigner = await signer;
    if (!resolvedSigner) return;
    try {
      setIsDecryptingBet(true);
      setTxStatus(null);
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [PREDICTION_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const handles = [
        { handle: entry.bet.option, contractAddress: PREDICTION_ADDRESS },
        { handle: entry.bet.amount, contractAddress: PREDICTION_ADDRESS },
      ];

      const result = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const optionIndex = Number(result[entry.bet.option] || 0);
      const amountValue = Number(result[entry.bet.amount] || 0) / 1_000_000;
      const optionLabel = entry.options[optionIndex] || `Option ${optionIndex + 1}`;
      setMyBet(`${optionLabel} • ${amountValue.toLocaleString(undefined, { maximumFractionDigits: 4 })} cCoin`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to decrypt your bet';
      setTxStatus(message);
    } finally {
      setIsDecryptingBet(false);
    }
  };

  return (
    <div className={`card prediction ${!entry.isActive ? 'muted' : ''}`}>
      <div className="card-head">
        <div>
          <p className="eyebrow">{entry.isActive ? 'Open market' : 'Closed market'}</p>
          <h3>{entry.name}</h3>
          <p className="meta">Created {createdLabel}</p>
        </div>
        {entry.creator.toLowerCase() === (address || '').toLowerCase() && entry.isActive && (
          <button className="ghost" onClick={finalizePrediction} disabled={isSubmitting}>
            {isSubmitting ? 'Finalizing...' : 'Finalize'}
          </button>
        )}
      </div>

      <div className="options">
        {entry.options.map((opt, idx) => (
          <label key={idx} className={`option ${selectedOption === idx ? 'selected' : ''}`}>
            <input
              type="radio"
              name={`prediction-${entry.id}`}
              checked={selectedOption === idx}
              onChange={() => setSelectedOption(idx)}
              disabled={!entry.isActive || isSubmitting}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      {entry.isActive && (
        <div className="form-row inline">
          <div className="input-group">
            <label>Stake (cCoin)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="1000"
            />
          </div>
          <button className="primary" onClick={handleBet} disabled={isSubmitting || !address || !instance}>
            {isSubmitting ? 'Submitting...' : 'Place encrypted bet'}
          </button>
        </div>
      )}

      {!entry.isActive && (
        <div className="totals-row">
          <button
            className="ghost"
            onClick={decryptTotals}
            disabled={!entry.totalsPublic || isDecryptingTotals || !instance}
          >
            {isDecryptingTotals ? 'Decrypting...' : 'Decrypt totals'}
          </button>
          {decryptedTotals && (
            <div className="totals">
              {decryptedTotals.map((val, idx) => (
                <div key={idx} className="total-chip">
                  <span>{entry.options[idx]}</span>
                  <strong>{val} cCoin</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {entry.bet?.exists && (
        <div className="bet-panel">
          <p className="eyebrow">Your encrypted bet</p>
          <div className="actions">
            <button className="ghost" onClick={decryptMyBet} disabled={isDecryptingBet || !instance}>
              {isDecryptingBet ? 'Decrypting...' : 'Decrypt my bet'}
            </button>
            {myBet && <span className="pill-badge success">{myBet}</span>}
          </div>
        </div>
      )}

      {txStatus && <p className="status">{txStatus}</p>}
    </div>
  );
}
