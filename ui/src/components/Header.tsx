import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">CF</div>
        <div>
          <p className="brand-title">CryptoForesight</p>
          <p className="brand-subtitle">Encrypted predictions on Sepolia</p>
        </div>
      </div>
      <ConnectButton />
    </header>
  );
}
