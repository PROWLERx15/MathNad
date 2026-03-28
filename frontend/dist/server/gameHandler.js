"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConnection = handleConnection;
const ws_1 = require("ws");
const viem_1 = require("viem");
const questions_1 = require("../lib/questions");
const client_1 = require("@prisma/client");
// Allow self-signed certs for internal API calls in dev
if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
const prisma = new client_1.PrismaClient();
// Chain config (inline to avoid importing from client module)
const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { decimals: 18, name: 'MONAD', symbol: 'MON' },
    rpcUrls: {
        default: {
            http: [process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz'],
        },
    },
};
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const SEED_FULFILLED_EVENT = {
    name: 'DuelSeedFulfilled',
    type: 'event',
    inputs: [
        { name: 'duelId', type: 'uint256', indexed: true },
        { name: 'seed', type: 'uint256', indexed: false },
    ],
};
const rooms = new Map();
const publicClient = (0, viem_1.createPublicClient)({
    chain: monadTestnet,
    transport: (0, viem_1.http)(monadTestnet.rpcUrls.default.http[0]),
});
function broadcast(room, msg) {
    const data = JSON.stringify(msg);
    for (const ws of room.players.values()) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(data);
        }
    }
}
function sendTo(ws, msg) {
    if (ws.readyState === ws_1.WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
async function startCountdownAndGame(room) {
    // Prevent double start
    if (room.gameStarted)
        return;
    room.gameStarted = true;
    // Update DB status to ACTIVE
    await prisma.duel.update({
        where: { id: room.dbId },
        data: { status: 'ACTIVE', seed: room.seed },
    }).catch((err) => console.error('DB update to ACTIVE failed:', err));
    // 3-2-1 countdown
    for (let n = 3; n >= 1; n--) {
        broadcast(room, { type: 'TICK', n });
        await new Promise((r) => setTimeout(r, 1000));
    }
    // Start game
    broadcast(room, {
        type: 'GAME_START',
        seed: room.seed,
        duration: room.duration,
    });
    // Server-side timer for game end
    room.serverTimer = setTimeout(() => {
        handleGameEnd(room);
    }, room.duration * 1000 + 3000); // +3s grace for network latency
}
async function handleGameEnd(room) {
    // Prevent double settlement (race condition guard)
    if (room.settling)
        return;
    room.settling = true;
    if (room.serverTimer) {
        clearTimeout(room.serverTimer);
        room.serverTimer = undefined;
    }
    if (room.vrfWatcher) {
        room.vrfWatcher();
        room.vrfWatcher = undefined;
    }
    if (!room.seed)
        return;
    const questions = (0, questions_1.generateQuestions)(BigInt(room.seed), 10);
    const playerAddrs = Array.from(room.players.keys());
    // Score submissions server-side
    for (const [addr, sub] of room.submissions.entries()) {
        let score = 0;
        for (let i = 0; i < Math.min(sub.answers.length, questions.length); i++) {
            if (sub.answers[i] === questions[i].answer) {
                score++;
            }
        }
        sub.score = score;
        console.log(`[Room ${room.duelId}] Player ${addr}: ${sub.answers.length} answers, score=${score}, time=${sub.totalTime}ms`);
    }
    // Determine winner
    let winner;
    let loser;
    let winnerScore;
    let loserScore;
    if (room.submissions.size === 0) {
        winner = playerAddrs[0] || '';
        loser = playerAddrs[1] || '';
        winnerScore = 0;
        loserScore = 0;
    }
    else if (room.submissions.size === 1) {
        const [addr, sub] = Array.from(room.submissions.entries())[0];
        winner = addr;
        loser = playerAddrs.find((a) => a !== addr) || '';
        winnerScore = sub.score;
        loserScore = 0;
    }
    else {
        const entries = Array.from(room.submissions.entries());
        const [addr1, sub1] = entries[0];
        const [addr2, sub2] = entries[1];
        if (sub1.score > sub2.score) {
            winner = addr1;
            loser = addr2;
        }
        else if (sub2.score > sub1.score) {
            winner = addr2;
            loser = addr1;
        }
        else {
            winner = sub1.totalTime <= sub2.totalTime ? addr1 : addr2;
            loser = winner === addr1 ? addr2 : addr1;
        }
        winnerScore = room.submissions.get(winner)?.score || 0;
        loserScore = room.submissions.get(loser)?.score || 0;
    }
    // Save game submissions to DB
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
        // Mark duel as COMPLETED before settlement
        await prisma.duel.update({
            where: { id: room.dbId },
            data: {
                status: 'COMPLETED',
                winnerScore,
                loserScore,
            },
        });
    }
    catch (err) {
        console.error('DB submission save failed:', err);
    }
    // Call /api/settle to settle on-chain
    let txHash = '';
    try {
        const port = process.env.PORT || '3000';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`;
        const res = await fetch(`${baseUrl}/api/settle`, {
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
        const data = (await res.json());
        txHash = data.txHash || '';
    }
    catch (err) {
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
    // Cleanup room
    rooms.delete(room.duelId);
}
function watchForSeed(room) {
    // Poll the contract every 3s for seed fulfillment
    // This is more reliable than watchContractEvent which can miss already-emitted events
    const pollInterval = setInterval(async () => {
        try {
            const hasSeed = await checkExistingSeed(room);
            if (hasSeed && room.seed) {
                clearInterval(pollInterval);
                console.log(`[Room ${room.duelId}] Seed found via poll: ${room.seed}`);
                broadcast(room, { type: 'SEED_READY', seed: room.seed });
                startCountdownAndGame(room);
            }
        }
        catch (err) {
            console.error('Error polling for seed:', err);
        }
    }, 3000);
    // Also try event-based watching as a faster path
    try {
        const unwatch = publicClient.watchContractEvent({
            address: CONTRACT_ADDRESS,
            abi: [SEED_FULFILLED_EVENT],
            eventName: 'DuelSeedFulfilled',
            args: { duelId: BigInt(room.duelId) },
            onLogs: (logs) => {
                for (const log of logs) {
                    const args = log.args;
                    if (args.duelId.toString() === room.duelId && !room.seed) {
                        room.seed = args.seed.toString();
                        clearInterval(pollInterval);
                        if (room.vrfWatcher) {
                            room.vrfWatcher();
                            room.vrfWatcher = undefined;
                        }
                        console.log(`[Room ${room.duelId}] Seed found via event: ${room.seed}`);
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
    }
    catch (err) {
        console.error('Error watching for seed event (poll still active):', err);
        // Poll is still running as fallback
        room.vrfWatcher = () => clearInterval(pollInterval);
    }
}
async function checkExistingSeed(room) {
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
        }));
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
    }
    catch (err) {
        console.error('Error checking seed:', err);
        return false;
    }
}
function handleConnection(ws) {
    let playerAddress = null;
    let currentRoom = null;
    ws.on('message', async (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
                case 'JOIN_LOBBY': {
                    const { duelId, playerAddress: addr } = msg;
                    playerAddress = addr.toLowerCase();
                    // Look up duel in DB to get dbId and joinCode
                    let dbDuel = await prisma.duel.findFirst({
                        where: { duelId: Number(duelId) },
                    });
                    // If not found by on-chain ID, try by joinCode (player1 may not have on-chain ID yet)
                    if (!dbDuel) {
                        dbDuel = await prisma.duel.findFirst({
                            where: {
                                OR: [
                                    { joinCode: duelId }, // duelId might be joinCode for player1
                                    { duelId: isNaN(Number(duelId)) ? undefined : Number(duelId) },
                                ],
                            },
                        });
                    }
                    const roomKey = duelId; // use on-chain duelId as room key
                    // Get or create room
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
                    const room = rooms.get(roomKey);
                    // Update dbId if we now have it
                    if (dbDuel?.id && !room.dbId) {
                        room.dbId = dbDuel.id;
                    }
                    currentRoom = room;
                    // Clear disconnect timer if reconnecting
                    const existingTimer = room.disconnectTimers.get(playerAddress);
                    if (existingTimer) {
                        clearTimeout(existingTimer);
                        room.disconnectTimers.delete(playerAddress);
                    }
                    room.players.set(playerAddress, ws);
                    // Tell the player the current state
                    if (room.players.size === 1) {
                        sendTo(ws, { type: 'LOBBY_JOINED', waiting: true });
                    }
                    // If 2 players are in the room
                    if (room.players.size === 2 && !room.gameStarted) {
                        broadcast(room, { type: 'OPPONENT_JOINED', player2: playerAddress });
                        // Check if seed already exists
                        const hasSeed = await checkExistingSeed(room);
                        if (hasSeed) {
                            broadcast(room, { type: 'SEED_READY', seed: room.seed });
                            startCountdownAndGame(room);
                        }
                        else {
                            broadcast(room, { type: 'WAITING_SEED' });
                            watchForSeed(room);
                        }
                    }
                    else if (room.gameStarted && room.seed) {
                        // Player reconnecting mid-game — send them the game state
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
                    if (!room || room.settling)
                        return;
                    const normalizedAddr = addr.toLowerCase();
                    // Prevent duplicate submissions (race condition guard)
                    if (room.submissions.has(normalizedAddr))
                        return;
                    room.submissions.set(normalizedAddr, { answers, totalTime, score: 0 });
                    // If both players submitted, end the game
                    if (room.submissions.size >= room.players.size) {
                        handleGameEnd(room);
                    }
                    break;
                }
            }
        }
        catch (err) {
            console.error('WS message error:', err);
        }
    });
    ws.on('close', () => {
        if (!currentRoom || !playerAddress)
            return;
        // 10-second forfeit timer
        const timer = setTimeout(() => {
            if (currentRoom && currentRoom.players.has(playerAddress)) {
                currentRoom.players.delete(playerAddress);
                // If game was in progress and not already settling
                if (currentRoom.seed && currentRoom.serverTimer && !currentRoom.settling) {
                    handleGameEnd(currentRoom);
                }
            }
        }, 10000);
        currentRoom.disconnectTimers.set(playerAddress, timer);
    });
}
