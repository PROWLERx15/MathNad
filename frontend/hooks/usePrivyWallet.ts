'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo } from 'react';

export function usePrivyWallet() {
  const { authenticated, login, logout, user, ready } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy'),
    [wallets]
  );

  const address = embeddedWallet?.address as `0x${string}` | undefined;

  return {
    wallet: embeddedWallet,
    address,
    isConnected: authenticated && !!embeddedWallet,
    authenticated,
    login,
    logout,
    user,
    ready,
  };
}
