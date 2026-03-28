import { createPublicClient, http, type Abi } from 'viem';
import { monadTestnet } from '@/config/privy';

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL),
});

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi;

export const MATHNAD_ABI = [
  // Read functions
  {
    name: 'duels',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'duelId', type: 'uint256' }],
    outputs: [
      { name: 'player1', type: 'address' },
      { name: 'player2', type: 'address' },
      { name: 'stake', type: 'uint256' },
      { name: 'gameDuration', type: 'uint8' },
      { name: 'joinCode', type: 'string' },
      { name: 'active', type: 'bool' },
      { name: 'fulfilled', type: 'bool' },
      { name: 'randomSeed', type: 'uint256' },
    ],
  },
  {
    name: 'codeToId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'code', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'duelCounter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getEntropyFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'PLATFORM_FEE_BPS',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'useFallbackRandomness',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Write functions
  {
    name: 'createDuel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'stakeAmount', type: 'uint256' },
      { name: 'duration', type: 'uint8' },
      { name: 'joinCode', type: 'string' },
    ],
    outputs: [{ name: 'duelId', type: 'uint256' }],
  },
  {
    name: 'joinDuel',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'joinCode', type: 'string' }],
    outputs: [],
  },
  {
    name: 'settleDuel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'duelId', type: 'uint256' },
      { name: 'winner', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  // Events
  {
    name: 'DuelCreated',
    type: 'event',
    inputs: [
      { name: 'duelId', type: 'uint256', indexed: true },
      { name: 'player1', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'duration', type: 'uint8', indexed: false },
      { name: 'joinCode', type: 'string', indexed: false },
    ],
  },
  {
    name: 'DuelJoined',
    type: 'event',
    inputs: [
      { name: 'duelId', type: 'uint256', indexed: true },
      { name: 'player2', type: 'address', indexed: true },
    ],
  },
  {
    name: 'DuelSeedFulfilled',
    type: 'event',
    inputs: [
      { name: 'duelId', type: 'uint256', indexed: true },
      { name: 'seed', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'DuelSettled',
    type: 'event',
    inputs: [
      { name: 'duelId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi;
