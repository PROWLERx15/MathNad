import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { MATHNAD_ABI, CONTRACT_ADDRESS } from '@/lib/contract';
import { monadTestnet } from '@/config/privy';
import { prisma } from '@/lib/prisma';

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

export async function POST(req: Request) {
  try {
    const { joinCode, playerAddress } = await req.json();

    if (!joinCode || !playerAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const addr = playerAddress.toLowerCase();

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(RPC_URL),
    });

    // Get duelId from contract
    const duelId = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: MATHNAD_ABI,
      functionName: 'codeToId',
      args: [joinCode],
    })) as bigint;

    if (duelId === 0n) {
      return NextResponse.json(
        { error: 'Duel not found' },
        { status: 404 }
      );
    }

    // Get entropy fee
    const entropyFee = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: MATHNAD_ABI,
      functionName: 'getEntropyFee',
    })) as bigint;

    // Upsert player2
    await prisma.player.upsert({
      where: { address: addr },
      create: { address: addr },
      update: {},
    });

    // Update duel in DB
    await prisma.duel.update({
      where: { joinCode },
      data: {
        player2Address: addr,
        duelId: Number(duelId),
        status: 'SEEDING',
      },
    });

    return NextResponse.json({
      duelId: duelId.toString(),
      entropyFee: entropyFee.toString(),
    });
  } catch (err) {
    console.error('Join duel error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
