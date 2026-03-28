'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  createPublicClient,
  http,
  decodeEventLog,
  type WalletClient,
} from 'viem';
import { usePrivyWallet } from './usePrivyWallet';
import {
  MATHNAD_ABI,
  USDC_ABI,
  CONTRACT_ADDRESS,
  USDC_ADDRESS,
} from '@/lib/contract';
import { monadTestnet } from '@/config/privy';

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

export function useMathNadContract() {
  const { wallet, address } = usePrivyWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: monadTestnet,
        transport: http(RPC_URL),
      }),
    []
  );

  const getWalletClient = useCallback(async (): Promise<WalletClient> => {
    if (!wallet) throw new Error('Wallet not connected');
    const provider = await wallet.getEthereumProvider();
    const { createWalletClient, custom } = await import('viem');
    return createWalletClient({
      chain: monadTestnet,
      transport: custom(provider),
      account: address as `0x${string}`,
    });
  }, [wallet, address]);

  const approveUSDC = useCallback(
    async (amount: bigint) => {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amount],
        chain: monadTestnet,
        account: address as `0x${string}`,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [getWalletClient, publicClient, address]
  );

  const createDuel = useCallback(
    async (
      stakeAmount: bigint,
      duration: number,
      joinCode: string
    ): Promise<{ hash: `0x${string}`; duelId: bigint }> => {
      setIsLoading(true);
      setError(null);
      try {
        // Approve USDC first
        await approveUSDC(stakeAmount);

        const walletClient = await getWalletClient();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'createDuel',
          args: [stakeAmount, duration, joinCode],
          chain: monadTestnet,
          account: address as `0x${string}`,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted');
        }

        let duelId: bigint = 0n;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: MATHNAD_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'DuelCreated') {
              duelId = (decoded.args as { duelId: bigint }).duelId;
              break;
            }
          } catch {
            // Not our event
          }
        }

        return { hash, duelId };
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [approveUSDC, getWalletClient, publicClient, address]
  );

  const joinDuel = useCallback(
    async (joinCode: string): Promise<{ hash: `0x${string}` }> => {
      setIsLoading(true);
      setError(null);
      try {
        // Get duel stake amount first
        const duelId = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'codeToId',
          args: [joinCode],
        })) as bigint;

        const duelData = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'duels',
          args: [duelId],
        })) as [string, string, bigint, number, string, boolean, boolean, bigint];

        const stake = duelData[2];

        // Approve USDC
        await approveUSDC(stake);

        // Get entropy fee
        const entropyFee = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'getEntropyFee',
        })) as bigint;

        const walletClient = await getWalletClient();
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'joinDuel',
          args: [joinCode],
          value: entropyFee,
          chain: monadTestnet,
          account: address as `0x${string}`,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted');
        }

        return { hash };
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [approveUSDC, getWalletClient, publicClient, address]
  );

  const getDuel = useCallback(
    async (duelId: bigint) => {
      const result = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MATHNAD_ABI,
        functionName: 'duels',
        args: [duelId],
      })) as [string, string, bigint, number, string, boolean, boolean, bigint];

      return {
        player1: result[0] as `0x${string}`,
        player2: result[1] as `0x${string}`,
        stake: result[2],
        gameDuration: result[3],
        joinCode: result[4],
        active: result[5],
        fulfilled: result[6],
        randomSeed: result[7],
      };
    },
    [publicClient]
  );

  const watchDuelSeedFulfilled = useCallback(
    (duelId: bigint, callback: (seed: bigint) => void): (() => void) => {
      const unwatch = publicClient.watchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: MATHNAD_ABI,
        eventName: 'DuelSeedFulfilled',
        args: { duelId },
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as { duelId: bigint; seed: bigint };
            if (args.duelId === duelId) {
              callback(args.seed);
            }
          }
        },
      });
      return unwatch;
    },
    [publicClient]
  );

  const watchDuelJoined = useCallback(
    (
      duelId: bigint,
      callback: (player2: `0x${string}`) => void
    ): (() => void) => {
      const unwatch = publicClient.watchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: MATHNAD_ABI,
        eventName: 'DuelJoined',
        args: { duelId },
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              duelId: bigint;
              player2: `0x${string}`;
            };
            if (args.duelId === duelId) {
              callback(args.player2);
            }
          }
        },
      });
      return unwatch;
    },
    [publicClient]
  );

  return {
    createDuel,
    joinDuel,
    getDuel,
    watchDuelSeedFulfilled,
    watchDuelJoined,
    approveUSDC,
    isLoading,
    error,
    publicClient,
  };
}
