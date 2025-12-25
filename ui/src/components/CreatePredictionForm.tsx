import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

import { PREDICTION_ABI, PREDICTION_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/Cards.css';

type CreatePredictionFormProps = {
  onCreated?: () => void;
};

export function CreatePredictionForm({ onCreated }: CreatePredictionFormProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();

  const [name, setName] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (index: number, value: string) => {
    const copy = [...options];
    copy[index] = value;
    setOptions(copy);
  };

  const addOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const copy = options.filter((_, idx) => idx !== index);
    setOptions(copy);
  };

  const handleCreate = async () => {
    setError(null);
    if (!address) {
      setError('Connect a wallet to create a market.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('No signer available.');
      return;
    }

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (!name.trim()) {
      setError('Prediction name is required.');
      return;
    }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 4) {
      setError('Provide between 2 and 4 options.');
      return;
    }

    try {
      setIsSubmitting(true);
      const contract = new ethers.Contract(PREDICTION_ADDRESS, PREDICTION_ABI, resolvedSigner);
      const tx = await contract.createPrediction(name.trim(), trimmedOptions);
      await tx.wait();
      setName('');
      setOptions(['Yes', 'No']);
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create prediction';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Launch a board</p>
          <h3>Create prediction</h3>
        </div>
        <span className="pill-badge">2-4 options</span>
      </div>

      <div className="form-row">
        <label>Name</label>
        <input
          type="text"
          value={name}
          placeholder="Will ETH flip BTC in market cap by 2030?"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label>Options</label>
        <div className="option-list">
          {options.map((opt, idx) => (
            <div className="option-row" key={idx}>
              <input
                type="text"
                value={opt}
                placeholder={`Option ${idx + 1}`}
                onChange={(e) => updateOption(idx, e.target.value)}
              />
              <div className="option-actions">
                <button className="ghost" onClick={() => removeOption(idx)} disabled={options.length <= 2}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button className="ghost" onClick={addOption} disabled={options.length >= 4}>
            Add option
          </button>
        </div>
      </div>

      <button className="primary" onClick={handleCreate} disabled={isSubmitting || !address}>
        {isSubmitting ? 'Creating...' : 'Create prediction'}
      </button>
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
