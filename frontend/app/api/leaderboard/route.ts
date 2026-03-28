import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get('sort') || 'wins';
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);

    let orderBy: Record<string, 'desc'>;
    switch (sortBy) {
      case 'earned':
        orderBy = { totalEarned: 'desc' };
        break;
      case 'streak':
        orderBy = { bestStreak: 'desc' };
        break;
      case 'score':
        orderBy = { avgScore: 'desc' };
        break;
      case 'wins':
      default:
        orderBy = { totalWins: 'desc' };
        break;
    }

    const players = await prisma.player.findMany({
      where: {
        // Only players who've played at least 1 game
        OR: [
          { totalWins: { gt: 0 } },
          { totalLosses: { gt: 0 } },
        ],
      },
      orderBy,
      take: limit,
      select: {
        address: true,
        totalWins: true,
        totalLosses: true,
        totalEarned: true,
        totalStaked: true,
        winStreak: true,
        bestStreak: true,
        avgScore: true,
      },
    });

    // Convert BigInt to string for JSON serialization
    const serialized = players.map((p, index) => ({
      rank: index + 1,
      address: p.address,
      wins: p.totalWins,
      losses: p.totalLosses,
      games: p.totalWins + p.totalLosses,
      winRate: p.totalWins + p.totalLosses > 0
        ? Math.round((p.totalWins / (p.totalWins + p.totalLosses)) * 100)
        : 0,
      earned: p.totalEarned.toString(),
      staked: p.totalStaked.toString(),
      winStreak: p.winStreak,
      bestStreak: p.bestStreak,
      avgScore: Math.round(p.avgScore * 10) / 10,
    }));

    return NextResponse.json({ leaderboard: serialized });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
