import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase();

    if (!address) {
      // Global stats
      const [totalDuels, totalSettled, totalPlayers] = await Promise.all([
        prisma.duel.count(),
        prisma.duel.count({ where: { status: 'SETTLED' } }),
        prisma.player.count({ where: { OR: [{ totalWins: { gt: 0 } }, { totalLosses: { gt: 0 } }] } }),
      ]);

      const totalStaked = await prisma.duel.aggregate({
        where: { status: 'SETTLED' },
        _sum: { stake: true },
      });

      return NextResponse.json({
        totalDuels,
        totalSettled,
        totalPlayers,
        totalStaked: ((totalStaked._sum.stake || 0n) * 2n).toString(), // Both players stake
      });
    }

    // Player-specific stats
    const player = await prisma.player.findUnique({
      where: { address },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Recent matches
    const recentDuels = await prisma.duel.findMany({
      where: {
        status: 'SETTLED',
        OR: [
          { player1Address: address },
          { player2Address: address },
        ],
      },
      orderBy: { settledAt: 'desc' },
      take: 10,
      select: {
        duelId: true,
        joinCode: true,
        stake: true,
        duration: true,
        winnerAddress: true,
        winnerScore: true,
        loserScore: true,
        txHash: true,
        settledAt: true,
        player1Address: true,
        player2Address: true,
      },
    });

    const matches = recentDuels.map((d) => {
      const isWinner = d.winnerAddress === address;
      const opponent = d.player1Address === address ? d.player2Address : d.player1Address;
      return {
        duelId: d.duelId,
        joinCode: d.joinCode,
        stake: d.stake.toString(),
        duration: d.duration,
        result: isWinner ? 'win' : 'loss',
        myScore: isWinner ? d.winnerScore : d.loserScore,
        opponentScore: isWinner ? d.loserScore : d.winnerScore,
        opponent,
        txHash: d.txHash,
        settledAt: d.settledAt,
      };
    });

    return NextResponse.json({
      address: player.address,
      wins: player.totalWins,
      losses: player.totalLosses,
      games: player.totalWins + player.totalLosses,
      winRate: player.totalWins + player.totalLosses > 0
        ? Math.round((player.totalWins / (player.totalWins + player.totalLosses)) * 100)
        : 0,
      earned: player.totalEarned.toString(),
      staked: player.totalStaked.toString(),
      winStreak: player.winStreak,
      bestStreak: player.bestStreak,
      avgScore: Math.round(player.avgScore * 10) / 10,
      recentMatches: matches,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
