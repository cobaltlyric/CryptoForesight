import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';

import { PREDICTION_ABI, PREDICTION_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import type { PredictionEntry } from './PredictionCard';
import { PredictionCard } from './PredictionCard';
import '../styles/PredictionApp.css';

type PredictionListProps = {
  refreshKey?: number;
  onAction?: () => void;
};

export function PredictionList({ refreshKey, onAction }: PredictionListProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance, isLoading: zamaLoading } = useZamaInstance();

  const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: predictionCount } = useReadContract({
    address: PREDICTION_ADDRESS,
    abi: PREDICTION_ABI,
    functionName: 'predictionCount',
  });

  useEffect(() => {
    const fetchPredictions = async () => {
      if (!publicClient || predictionCount === undefined) return;
      setIsLoading(true);
      try {
        const count = Number(predictionCount || 0n);
        const items: PredictionEntry[] = [];

        for (let i = 0; i < count; i++) {
          const prediction = (await publicClient.readContract({
            address: PREDICTION_ADDRESS,
            abi: PREDICTION_ABI,
            functionName: 'getPrediction',
            args: [BigInt(i)],
          })) as any;

          const totals = (await publicClient.readContract({
            address: PREDICTION_ADDRESS,
            abi: PREDICTION_ABI,
            functionName: 'getOptionTotals',
            args: [BigInt(i)],
          })) as readonly string[];

          let bet;
          if (address) {
            bet = (await publicClient.readContract({
              address: PREDICTION_ADDRESS,
              abi: PREDICTION_ABI,
              functionName: 'getEncryptedBet',
              args: [BigInt(i), address],
            })) as any;
          }

          const name = (prediction.name as string) ?? (prediction[0] as string);
          const options = (prediction.options as string[]) ?? (prediction[1] as string[]);
          const creator = (prediction.creator as string) ?? (prediction[2] as string);
          const isActive = (prediction.isActive as boolean) ?? (prediction[3] as boolean);
          const totalsPublic = (prediction.totalsPublic as boolean) ?? (prediction[4] as boolean);
          const createdAt = (prediction.createdAt as bigint) ?? (prediction[5] as bigint);

          items.push({
            id: i,
            name,
            options,
            creator,
            isActive,
            totalsPublic,
            createdAt,
            totals,
            bet: bet
              ? {
                  option: (bet.option as string) ?? (bet[0] as string),
                  amount: (bet.amount as string) ?? (bet[1] as string),
                  exists: (bet.exists as boolean) ?? (bet[2] as boolean),
                }
              : undefined,
          });
        }

        setPredictions(items);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();
  }, [predictionCount, address, publicClient, refreshKey]);

  if (isLoading) {
    return <p className="hint">Loading predictions...</p>;
  }

  if (!predictions.length) {
    return <p className="hint">No predictions yet. Launch one to get started.</p>;
  }

  return (
    <div className="prediction-grid">
      {predictions.map((entry) => (
        <PredictionCard
          key={entry.id}
          entry={entry}
          address={address}
          instance={instance}
          onAction={onAction}
        />
      ))}
      {zamaLoading && <p className="hint">Initializing encryption toolkit...</p>}
    </div>
  );
}
