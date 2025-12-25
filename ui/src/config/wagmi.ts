import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CryptoForesight',
  projectId: '8f43c6f9c5224f2e9b9ec57c60b6d2fb',
  chains: [sepolia],
  ssr: false,
});
