import { WebSocket } from 'ws';
import { createPublicClient, http, type Log } from 'viem';
import { generateQuestions } from './questions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { decimals: 18, name: 'MONAD', symbol: 'MON' },
  rpcUrls: {
    default: {
      http: [process.env.MONAD_RPC || 'https://testnet-rpc.monad.xyz'],
    },
  },
} as const;

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const SETTLE_API_URL = process.env.SETTLE_API_URL!; // e.g. https://mathnad.vercel.app/api/settle

const SEED_FULFILLED_EVENT = {
  name: 'DuelSeedFulfilled',
  type: 'event' as const,
  inputs: [
    { name: 'duelId', type: 'uint256', indexed: true },
    { name: 'seed', type: 'uint256', indexed: false },
  ],
};

interface Submission {
  answers: number[];
  totalTime: number;
  score: number;
}

interface Room {
  duelId: string;
  dbId: string;
  joinCode: string;
  players: Map<string, WebSocket>;
  duration: number;
  seed?: string;
  submissions: Map<string, Submission>;
  serverTimer?: ReturnType<typeof setTimeout>;
  vrfWatcher?: () => void;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  settling: boolean;
  gameStarted: boolean;
}

const rooms = new Map<string, Room>();

const publicClient = createPublicClient({
  chain: monadTestnet as any,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
});

function broadcast(room: Room, msg: object) {
  const data = JSON.stringify(msg);
  for (const ws of room.players.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function sendTo(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function startCountdownAndGame(room: Room) {
  if (room.gameStarted) return;
  room.gameStarted = true;

  await prisma.duel
    .update({
      where: { id: room.dbId },
      data: { status: 'ACTIVE', seed: room.seed },
    })
    .catch((err: Error) => console.error('DB update to ACTIVE failed:', err));

  for (let n = 3; n >= 1; n--) {
    broadcast(room, { type: 'TICK', n });
    await new Promise((r) => setTimeout(r, 1000));
  }

  broadcast(room, {
    type: 'GAME_START',
    seed: room.seed,
    duration: room.duration,
  });

  room.serverTimer = setTimeout(() => {
    handleGameEnd(room);
  }, room.duration * 1000 + 5000);
}

async function handleGameEnd(room: Room) {
  if (room.settling) return;
  room.settling = true;

  if (room.serverTimer) {
    clearTimeout(room.serverTimer);
    room.serverTimer = undefined;
  }

  // Wait for any in-flight submissions (race condition fix)
  const expectedPlayers = room.players.size;
  if (room.submissions.size < expectedPlayers) {
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (room.vrfWatcher) {
    room.vrfWatcher();
    room.vrfWatcher = undefined;
  }

  if (!room.seed) return;

  const questions = generateQuestions(BigInt(room.seed), 10);
  const playerAddrs = Array.from(room.players.keys());

  for (const [addr, sub] of room.submissions.entries()) {
    let score = 0;
    for (let i = 0; i < Math.min(sub.answers.length, questions.length); i++) {
      if (sub.answers[i] === questions[i].answer) {
        score++;
      }
    }
    sub.score = score;
    console.log(
      `[Room ${room.duelId}] Player ${addr}: answers=${JSON.stringify(sub.answers)}, score=${score}, time=${sub.totalTime}ms`,
    );
  }

  // Log expected vs actual questions for debugging
  console.log(`[Room ${room.duelId}] Expected answers: ${JSON.stringify(questions.map(q => q.answer))}`);

  let winner: string;
  let loser: string;
  let winnerScore: number;
  let loserScore: number;

  if (room.submissions.size === 0) {
    winner = playerAddrs[0] || '';
    loser = playerAddrs[1] || '';
    winnerScore = 0;
    loserScore = 0;
  } else if (room.submissions.size === 1) {
    const [addr, sub] = Array.from(room.submissions.entries())[0];
    winner = addr;
    loser = playerAddrs.find((a) => a !== addr) || '';
    winnerScore = sub.score;
    loserScore = 0;
  } else {
    const entries = Array.from(room.submissions.entries());
    const [addr1, sub1] = entries[0];
    const [addr2, sub2] = entries[1];

    if (sub1.score > sub2.score) {
      winner = addr1;
      loser = addr2;
    } else if (sub2.score > sub1.score) {
      winner = addr2;
      loser = addr1;
    } else {
      // Tiebreaker: more answers submitted wins, then faster time wins
      if (sub1.answers.length > sub2.answers.length) {
        winner = addr1;
      } else if (sub2.answers.length > sub1.answers.length) {
        winner = addr2;
      } else if (sub1.totalTime < sub2.totalTime) {
        winner = addr1;
      } else if (sub2.totalTime < sub1.totalTime) {
        winner = addr2;
      } else {
        // Exact tie: deterministic pick by address sort
        winner = addr1 < addr2 ? addr1 : addr2;
      }
      loser = winner === addr1 ? addr2 : addr1;
    }

    winnerScore = room.submissions.get(winner)?.score ?? 0;
    loserScore = room.submissions.get(loser)?.score ?? 0;
  }

  console.log(`[Room ${room.duelId}] Winner: ${winner} (score=${winnerScore}), Loser: ${loser} (score=${loserScore})`);

  // Save submissions to DB
  try {
    for (const [addr, sub] of room.submissions.entries()) {
      await prisma.gameSubmission.upsert({
        where: {
          duelId_playerAddress: {
            duelId: room.dbId,
            playerAddress: addr.toLowerCase(),
          },
        },
        create: {
          duelId: room.dbId,
          playerAddress: addr.toLowerCase(),
          answers: sub.answers,
          score: sub.score,
          totalTime: sub.totalTime,
        },
        update: {
          answers: sub.answers,
          score: sub.score,
          totalTime: sub.totalTime,
        },
      });
    }

    await prisma.duel.update({
      where: { id: room.dbId },
      data: {
        status: 'COMPLETED',
        winnerScore,
        loserScore,
      },
    });
  } catch (err) {
    console.error('DB submission save failed:', err);
  }

  // Call the Vercel-hosted settle API
  let txHash = '';
  try {
    const res = await fetch(SETTLE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duelId: room.duelId,
        winnerAddress: winner,
        loserAddress: loser,
        winnerScore,
        loserScore,
      }),
    });
    const data = (await res.json()) as { txHash?: string };
    txHash = data.txHash || '';
  } catch (err) {
    console.error('Settlement API call failed:', err);
  }

  broadcast(room, {
    type: 'GAME_END',
    winner,
    loser,
    winnerScore,
    loserScore,
    txHash,
  });

  rooms.delete(room.duelId);
}

function watchForSeed(room: Room) {
  let pollFailures = 0;
  const pollInterval = setInterval(async () => {
    try {
      const hasSeed = await checkExistingSeed(room);
      if (hasSeed && room.seed) {
        clearInterval(pollInterval);
        pollFailures = 0;
        console.log(`[Room ${room.duelId}] Seed found via poll: ${room.seed}`);
        broadcast(room, { type: 'SEED_READY', seed: room.seed });
        startCountdownAndGame(room);
      } else {
        pollFailures = 0; // reset on successful poll (just no seed yet)
        console.log(`[Room ${room.duelId}] Polling for seed... (not ready yet)`);
      }
    } catch (err) {
      pollFailures++;
      console.error(`[Room ${room.duelId}] Seed poll error (attempt ${pollFailures}):`, err);
      if (pollFailures >= 10) {
        clearInterval(pollInterval);
        console.error(`[Room ${room.duelId}] Giving up on seed after ${pollFailures} failures`);
        broadcast(room, { type: 'ERROR', message: 'Failed to get game seed. Please try again.' });
      }
    }
  }, 3000);

  try {
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: [SEED_FULFILLED_EVENT],
      eventName: 'DuelSeedFulfilled',
      args: { duelId: BigInt(room.duelId) },
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          const args = (log as any).args as { duelId: bigint; seed: bigint };
          if (args.duelId.toString() === room.duelId && !room.seed) {
            room.seed = args.seed.toString();
            clearInterval(pollInterval);
            if (room.vrfWatcher) {
              room.vrfWatcher();
              room.vrfWatcher = undefined;
            }
            console.log(
              `[Room ${room.duelId}] Seed found via event: ${room.seed}`,
            );
            broadcast(room, { type: 'SEED_READY', seed: room.seed });
            startCountdownAndGame(room);
          }
        }
      },
    });
    room.vrfWatcher = () => {
      unwatch();
      clearInterval(pollInterval);
    };
  } catch (err) {
    console.error('Error watching for seed event (poll still active):', err);
    room.vrfWatcher = () => clearInterval(pollInterval);
  }
}

async function checkExistingSeed(room: Room): Promise<boolean> {
  try {
    const duelData = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: [
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
      ],
      functionName: 'duels',
      args: [BigInt(room.duelId)],
    })) as [string, string, bigint, number, string, boolean, boolean, bigint];

    const fulfilled = duelData[6];
    const seed = duelData[7];
    const gameDuration = duelData[3];

    if (fulfilled && seed > 0n) {
      room.seed = seed.toString();
      room.duration = gameDuration || 30;
      return true;
    }

    room.duration = gameDuration || 30;
    return false;
  } catch (err) {
    console.error('Error checking seed:', err);
    return false;
  }
}

export function handleConnection(ws: WebSocket) {
  let playerAddress: string | null = null;
  let currentRoom: Room | null = null;

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'JOIN_LOBBY': {
          const { duelId, playerAddress: addr } = msg;
          playerAddress = addr.toLowerCase();

          let dbDuel = await prisma.duel.findFirst({
            where: { duelId: Number(duelId) },
          });

          if (!dbDuel) {
            dbDuel = await prisma.duel.findFirst({
              where: {
                OR: [
                  { joinCode: duelId },
                  {
                    duelId: isNaN(Number(duelId)) ? undefined : Number(duelId),
                  },
                ],
              },
            });
          }

          const roomKey = duelId;

          if (!rooms.has(roomKey)) {
            rooms.set(roomKey, {
              duelId: duelId,
              dbId: dbDuel?.id || '',
              joinCode: dbDuel?.joinCode || '',
              players: new Map(),
              duration: dbDuel?.duration || 30,
              submissions: new Map(),
              disconnectTimers: new Map(),
              settling: false,
              gameStarted: false,
            });
          }

          const room = rooms.get(roomKey)!;

          if (dbDuel?.id && !room.dbId) {
            room.dbId = dbDuel.id;
          }

          currentRoom = room;

          const existingTimer = room.disconnectTimers.get(playerAddress!);
          if (existingTimer) {
            clearTimeout(existingTimer);
            room.disconnectTimers.delete(playerAddress!);
          }

          room.players.set(playerAddress!, ws);

          if (room.players.size === 1) {
            sendTo(ws, { type: 'LOBBY_JOINED', waiting: true });
          }

          if (room.players.size === 2 && !room.gameStarted) {
            broadcast(room, {
              type: 'OPPONENT_JOINED',
              player2: playerAddress,
            });

            const hasSeed = await checkExistingSeed(room);
            if (hasSeed) {
              broadcast(room, { type: 'SEED_READY', seed: room.seed! });
              startCountdownAndGame(room);
            } else {
              broadcast(room, { type: 'WAITING_SEED' });
              watchForSeed(room);
            }
          } else if (room.gameStarted && room.seed) {
            sendTo(ws, {
              type: 'GAME_START',
              seed: room.seed,
              duration: room.duration,
            });
          }
          break;
        }

        case 'PLAYER_DONE': {
          const { duelId, playerAddress: addr, answers, totalTime } = msg;
          const room = rooms.get(duelId);
          if (!room) return;

          const normalizedAddr = addr.toLowerCase();
          if (room.submissions.has(normalizedAddr)) return;

          room.submissions.set(normalizedAddr, {
            answers,
            totalTime,
            score: 0,
          });

          // Only trigger game end if not already settling
          if (!room.settling && room.submissions.size >= room.players.size) {
            handleGameEnd(room);
          }
          break;
        }
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    if (!currentRoom || !playerAddress) return;

    const timer = setTimeout(() => {
      if (currentRoom && currentRoom.players.has(playerAddress!)) {
        currentRoom.players.delete(playerAddress!);

        if (
          currentRoom.seed &&
          currentRoom.serverTimer &&
          !currentRoom.settling
        ) {
          handleGameEnd(currentRoom);
        }
      }
    }, 10_000);

    currentRoom.disconnectTimers.set(playerAddress, timer);
  });
}
