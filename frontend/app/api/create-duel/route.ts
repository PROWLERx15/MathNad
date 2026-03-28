import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { stakeAmount, duration, joinCode, playerAddress } = await req.json();

    if (!stakeAmount || !duration || !joinCode || !playerAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const addr = playerAddress.toLowerCase();

    // Upsert player (create if first time)
    await prisma.player.upsert({
      where: { address: addr },
      create: { address: addr },
      update: {},
    });

    const duel = await prisma.duel.create({
      data: {
        joinCode,
        player1Address: addr,
        stake: BigInt(stakeAmount),
        duration,
        status: 'WAITING',
      },
    });

    return NextResponse.json({
      joinCode,
      dbId: duel.id,
    });
  } catch (err) {
    console.error('Create duel error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
