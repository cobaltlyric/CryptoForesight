import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ethers } from 'ethers';

import { COIN_ABI, COIN_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/Cards.css';

type TokenPurchaseProps = {
  onAction?: () => void;
};

export function TokenPurchase({ onAction }: TokenPurchaseProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading } = useZamaInstance();

  const [ethAmount, setEthAmount] = useState('0.1');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const {
    data: rateData,
    refetch: refetchRate,
  } = useReadContract({
    address: COIN_ADDRESS,
    abi: COIN_ABI,
    functionName: 'rate',
  });

  const {
    data: encryptedBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: COIN_ADDRESS,
    abi: COIN_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    refetchRate?.();
    if (address) {
      refetchBalance?.();
    }
  }, [address, refetchBalance, refetchRate]);

  const preview = useMemo(() => {
    const rate = Number(rateData ?? 0n);
    const eth = Number(ethAmount || 0);
    if (!rate || !eth) return '0';
    const raw = rate * eth;
    return raw.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, [ethAmount, rateData]);

  const handlePurchase = async () => {
    if (!address) {
      setStatus('Connect a wallet first.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatus('No signer available.');
      return;
    }
    try {
      setIsSubmitting(true);
      setStatus(null);
      setDecryptedBalance(null);

      const value = ethers.parseEther(ethAmount || '0');
      const contract = new ethers.Contract(COIN_ADDRESS, COIN_ABI, resolvedSigner);
      const tx = await contract.purchase({ value });
      await tx.wait();

      await refetchBalance?.();
      onAction?.();
      setStatus('Purchased cCoin successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to purchase tokens';
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const decryptBalance = async () => {
    if (!instance || !address || !encryptedBalance) {
      setBalanceError('Encryption service not ready.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setBalanceError('Connect a wallet to decrypt.');
      return;
    }
    try {
      setIsDecrypting(true);
      setBalanceError(null);

      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [COIN_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        [{ handle: encryptedBalance as string, contractAddress: COIN_ADDRESS }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const clearValue = result[encryptedBalance as string] || '0';
      const readable = Number(clearValue) / 1_000_000;
      setDecryptedBalance(readable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decrypt balance';
      setBalanceError(message);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Acquire cCoin</p>
          <h3>Buy with ETH</h3>
        </div>
        <span className="pill-badge muted">Confidential ERC-7984</span>
      </div>
      <div className="form-row">
        <label>ETH to swap</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={ethAmount}
          onChange={(e) => setEthAmount(e.target.value)}
          placeholder="0.10"
        />
        <small className="hint">Preview: ~{preview} cCoin</small>
      </div>

      <button className="primary" onClick={handlePurchase} disabled={isSubmitting || !address}>
        {isSubmitting ? 'Purchasing...' : 'Buy cCoin'}
      </button>

      {status && <p className="status">{status}</p>}

      <div className="balance-panel">
        <div>
          <p className="eyebrow">Encrypted balance</p>
          {address ? (
            <p className="code">{encryptedBalance ? `${(encryptedBalance as string).slice(0, 18)}...` : 'Loading...'}</p>
          ) : (
            <p className="hint">Connect to load your cCoin</p>
          )}
        </div>
        <div className="actions">
          <button className="ghost" onClick={decryptBalance} disabled={!address || !encryptedBalance || zamaLoading || isDecrypting}>
            {isDecrypting ? 'Decrypting...' : 'Decrypt balance'}
          </button>
          {decryptedBalance && <span className="pill-badge success">{decryptedBalance} cCoin</span>}
        </div>
        {balanceError && <p className="status error">{balanceError}</p>}
      </div>
    </div>
  );
}
