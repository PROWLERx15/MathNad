import { NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MATHNAD_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { monadTestnet } from '@/config/privy';
import { prisma } from '@/lib/prisma';

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

function getVerifierAccount() {
  const pk = process.env.SIGNER_PRIVATE_KEY!;
  const formatted = pk.startsWith('0x') ? pk : `0x${pk}`;
  return privateKeyToAccount(formatted as `0x${string}`);
}

export async function POST(req: Request) {
  try {
    const { duelId, winnerAddress, winnerScore, loserScore, loserAddress } = await req.json();

    if (!duelId || !winnerAddress) {
      return NextResponse.json(
        { error: 'Missing duelId or winnerAddress' },
        { status: 400 }
      );
    }

    const account = getVerifierAccount();

    // Sign the settlement message
    const msgHash = keccak256(
      encodePacked(
        ['uint256', 'address', 'string'],
        [BigInt(duelId), winnerAddress as `0x${string}`, 'MATHNAD_WINNER']
      )
    );

    const signature = await account.signMessage({
      message: { raw: msgHash as `0x${string}` },
    });

    // Call settleDuel on-chain
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(RPC_URL),
    });

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: MATHNAD_ABI,
      functionName: 'settleDuel',
      args: [
        BigInt(duelId),
        winnerAddress as `0x${string}`,
        signature as `0x${string}`,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'reverted') {
      return NextResponse.json(
        { error: 'Settlement transaction reverted' },
        { status: 500 }
      );
    }

    const winnerAddr = winnerAddress.toLowerCase();
    const loserAddr = loserAddress?.toLowerCase();

    // Update duel + player stats in a transaction
    await prisma.$transaction(async (tx) => {
      // Get duel to calculate payout
      const duel = await tx.duel.findFirst({
        where: { duelId: Number(duelId) },
      });

      if (!duel) return;

      const totalPot = duel.stake * 2n;
      const platformCut = (totalPot * 500n) / 10000n; // 5%
      const winnerPayout = totalPot - platformCut;

      // Update duel
      await tx.duel.update({
        where: { id: duel.id },
        data: {
          status: 'SETTLED',
          winnerAddress: winnerAddr,
          winnerScore: winnerScore ?? null,
          loserScore: loserScore ?? null,
          txHash: hash,
          settledAt: new Date(),
        },
      });

      // Update winner stats
      const winner = await tx.player.findUnique({ where: { address: winnerAddr } });
      if (winner) {
        const newStreak = winner.winStreak + 1;
        const totalGames = winner.totalWins + winner.totalLosses + 1;
        const newAvgScore = winnerScore != null
          ? ((winner.avgScore * (totalGames - 1)) + winnerScore) / totalGames
          : winner.avgScore;

        await tx.player.update({
          where: { address: winnerAddr },
          data: {
            totalWins: { increment: 1 },
            totalEarned: { increment: winnerPayout },
            totalStaked: { increment: duel.stake },
            winStreak: newStreak,
            bestStreak: Math.max(newStreak, winner.bestStreak),
            avgScore: newAvgScore,
          },
        });
      }

      // Update loser stats
      if (loserAddr) {
        const loser = await tx.player.findUnique({ where: { address: loserAddr } });
        if (loser) {
          const totalGames = loser.totalWins + loser.totalLosses + 1;
          const newAvgScore = loserScore != null
            ? ((loser.avgScore * (totalGames - 1)) + loserScore) / totalGames
            : loser.avgScore;

          await tx.player.update({
            where: { address: loserAddr },
            data: {
              totalLosses: { increment: 1 },
              totalStaked: { increment: duel.stake },
              winStreak: 0,
              avgScore: newAvgScore,
            },
          });
        }
      }
    });

    return NextResponse.json({ txHash: hash });
  } catch (err) {
    console.error('Settle error:', err);
    return NextResponse.json(
      { error: 'Settlement failed' },
      { status: 500 }
    );
  }
}
