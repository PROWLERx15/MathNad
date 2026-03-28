import { PrivyClientConfig } from '@privy-io/react-auth';
import { type Chain } from 'viem';

export const monadTestnet: Chain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MONAD',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadExplorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
};

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'dark',
    accentColor: '#836ef9',
    showWalletLoginFirst: false,
  },
  loginMethods: ['google', 'email'],
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  defaultChain: monadTestnet,
  supportedChains: [monadTestnet],
};
