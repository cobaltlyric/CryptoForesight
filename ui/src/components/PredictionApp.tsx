import { useState } from 'react';
import { useAccount } from 'wagmi';

import { Header } from './Header';
import { TokenPurchase } from './TokenPurchase';
import { CreatePredictionForm } from './CreatePredictionForm';
import { PredictionList } from './PredictionList';
import '../styles/PredictionApp.css';

export function PredictionApp() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="page">
      <Header />
      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Confidential forecasting on FHE</p>
            <h1>CryptoForesight</h1>
            <p className="lede">
              Create encrypted prediction markets, buy cCoin with ETH, and wager privately.
              Encrypted selections and stakes stay opaque until the market is finalized.
            </p>
          </div>
          <div className="hero-pill">
            <p>1 ETH = 1,000,000 cCoin</p>
            <span className="pill-badge">Zama FHE</span>
          </div>
        </section>

        <div className="grid two-col">
          <TokenPurchase onAction={handleRefresh} />
          <CreatePredictionForm onCreated={handleRefresh} />
        </div>

        <section className="markets">
          <div className="section-head">
            <div>
              <p className="eyebrow">Live boards</p>
              <h2>Prediction markets</h2>
              <p className="section-copy">
                {address ? 'Pick a side and encrypt your stake.' : 'Connect a wallet to place encrypted wagers.'}
              </p>
            </div>
          </div>
          <PredictionList refreshKey={refreshKey} onAction={handleRefresh} />
        </section>
      </main>
    </div>
  );
}
