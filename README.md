# MathNad

**Real-time PvP math battles on Monad with USDC stakes.**

Two players wager USDC, race through 10 math questions, and the winner takes 95% of the pot. Questions are generated deterministically from an on-chain VRF seed via Pyth Entropy, ensuring fairness and verifiability.

---

## How It Works

1. **Create a Battle** — Pick a stake amount (0.1 / 0.5 / 1 USDC) and duration (30s or 60s). A unique join code is generated.
2. **Share the Code** — Send the 6-character code to your opponent.
3. **Opponent Joins** — Player 2 stakes the same amount. Pyth Entropy VRF is requested on-chain.
4. **Battle** — Once the VRF seed arrives, both players get the same 10 math questions. Answer fast and accurately.
5. **Settlement** — The backend verifies scores, signs the result, and settles on-chain. Winner receives 95% of the total pot.

### Scoring

- 1 point per correct answer (max 10)
- Tiebreaker: faster completion time wins
- Platform fee: 5%

### Question Types

| Count | Type | Range |
|-------|------|-------|
| 4 | Addition / Subtraction | 1–20 |
| 3 | Multiplication | 2–12 |
| 3 | Division (exact) | Divisors 2–11 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Monad Testnet (Chain ID: 10143) |
| **Smart Contracts** | Solidity ^0.8.20, Foundry |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Wallet** | Privy (embedded wallets, Google/Email login) |
| **Web3** | Viem |
| **Real-time** | WebSocket (ws) |
| **Database** | PostgreSQL (Supabase) via Prisma |
| **VRF** | Pyth Entropy V2 |
| **PWA** | next-pwa (offline support, installable) |
| **Deployment** | Railway |

---

## Contract Addresses (Monad Testnet)

| Contract | Address |
|----------|---------|
| **MathNad** | [`0x8e3dA6E6f912877719F86de5Ab8efdE7E71412b4`](https://testnet.monadexplorer.com/address/0x8e3dA6E6f912877719F86de5Ab8efdE7E71412b4) |
| **USDC** | [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadexplorer.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) |
| **Pyth Entropy** | [`0x825c0390f379c631f3cf11a82a37d20bddf93c07`](https://testnet.monadexplorer.com/address/0x825c0390f379c631f3cf11a82a37d20bddf93c07) |
| **Verifier (Signer)** | `0xD77d319d14c336383866159703AF215d4Eef9995` |

---

## Architecture

```
┌─────────────┐     WebSocket (/ws)     ┌──────────────────┐
│   Client     │◄──────────────────────►│  Node.js Server   │
│  (Next.js)   │                        │  + WS Handler     │
│              │     REST API           │                   │
│  Privy Auth  │◄──────────────────────►│  Next.js API      │
│  Viem        │                        │  Routes           │
└──────┬───────┘                        └────────┬──────────┘
       │                                         │
       │  On-chain txns                          │  Settlement signing
       │  (create/join duel)                     │  + on-chain settle
       ▼                                         ▼
┌──────────────────────────────────────────────────────────┐
│                    Monad Testnet                          │
│                                                          │
│  MathNad.sol ◄──── Pyth Entropy V2 (VRF callback)       │
│  - createDuel()     entropyCallback() delivers seed      │
│  - joinDuel()                                            │
│  - settleDuel()    USDC (ERC-20) for stakes              │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  PostgreSQL      │
│  (Supabase)      │
│  - Players       │
│  - Duels         │
│  - Submissions   │
└──────────────────┘
```

---

## Smart Contract

**`MathNad.sol`** (317 LOC) — built with OpenZeppelin v5.6.1 and Pyth Entropy SDK.

### Key Functions

| Function | Description |
|----------|-------------|
| `createDuel(stakeAmount, duration, joinCode)` | Player 1 stakes USDC, creates a duel with a join code |
| `joinDuel(joinCode)` | Player 2 matches the stake, triggers VRF request |
| `settleDuel(duelId, winner, signature)` | Verifies ECDSA signature, pays winner |
| `getEntropyFee()` | Returns required MON fee for VRF |

### Security

- **ReentrancyGuard** on settlement
- **ECDSA signature verification** — only the authorized verifier can sign results
- **SafeERC20** for all token transfers
- **Ownable** access control for admin functions
- Fallback randomness mode (block.prevrandao) if Pyth is unavailable

### Events

```
DuelCreated(duelId, player1, stake, duration, joinCode)
DuelJoined(duelId, player2)
DuelSeedFulfilled(duelId, seed)
DuelSettled(duelId, winner, payout)
```

---

## Project Structure

```
MathNad/
├── contracts/
│   ├── src/MathNad.sol          # Main game contract
│   ├── script/Deploy.s.sol      # Foundry deploy script
│   ├── test/MathNad.t.sol       # Contract tests
│   └── foundry.toml
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Home — create/join duels
│   │   ├── duel/[code]/         # Lobby — wait for opponent
│   │   ├── battle/[duelId]/     # Game — answer questions
│   │   ├── result/[duelId]/     # Results — scores & payout
│   │   └── api/
│   │       ├── create-duel/     # POST — create duel in DB
│   │       ├── join-duel/       # POST — join + get entropy fee
│   │       ├── settle/          # POST — sign & settle on-chain
│   │       ├── stats/           # GET  — player/global stats
│   │       └── leaderboard/     # GET  — top players
│   │
│   ├── components/
│   │   ├── StakeModal.tsx       # Stake & duration picker
│   │   ├── QuestionCard.tsx     # Math question display
│   │   ├── Keypad.tsx           # Number input
│   │   ├── TimerBar.tsx         # Countdown bar
│   │   ├── Countdown.tsx        # 3-2-1 animation
│   │   ├── ResultCard.tsx       # Win/loss card
│   │   ├── WalletSection.tsx    # Send/receive funds
│   │   └── InstallPrompt.tsx    # PWA install
│   │
│   ├── hooks/
│   │   ├── usePrivyWallet.ts    # Privy embedded wallet
│   │   └── useMathNadContract.ts # Contract read/write
│   │
│   ├── lib/
│   │   ├── contract.ts          # ABIs & addresses
│   │   ├── questions.ts         # Deterministic question gen
│   │   ├── wsClient.ts          # WebSocket client
│   │   └── prisma.ts            # DB client
│   │
│   ├── server/
│   │   └── gameHandler.ts       # WebSocket game logic
│   │
│   ├── prisma/
│   │   └── schema.prisma        # Player, Duel, GameSubmission
│   │
│   └── server.ts                # HTTPS + WS entry point
│
└── README.md
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/create-duel` | Create duel, store in DB |
| POST | `/api/join-duel` | Join duel, return on-chain duel ID + entropy fee |
| POST | `/api/settle` | Verify scores, sign result, settle on-chain |
| GET | `/api/stats?address=0x...` | Player stats (wins, losses, earnings, streaks) |
| GET | `/api/leaderboard?sort=wins&limit=50` | Ranked leaderboard |

---

## WebSocket Protocol

The game server communicates over WebSocket at `/ws`.

| Message | Direction | Description |
|---------|-----------|-------------|
| `JOIN_LOBBY` | Client → Server | Join a duel room |
| `OPPONENT_JOINED` | Server → Client | Second player connected |
| `WAITING_SEED` | Server → Client | Waiting for VRF seed |
| `SEED_READY` | Server → Client | Seed received |
| `TICK` | Server → Client | Countdown (3, 2, 1) |
| `GAME_START` | Server → Client | Game begins (includes seed + duration) |
| `PLAYER_DONE` | Client → Server | Submit answers + completion time |
| `GAME_END` | Server → Client | Final scores, winner, tx hash |

---

## Database Schema

**Player** — wallet address, win/loss record, earnings, streaks, average score

**Duel** — on-chain duel ID, join code, stake, duration, status (`WAITING` → `SEEDING` → `ACTIVE` → `COMPLETED` → `SETTLED`), seed, scores, settlement tx hash

**GameSubmission** — per-player answers, score, and completion time for each duel

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL database (Supabase recommended)
- Foundry (for contract development)

### Environment Variables

Create `frontend/.env.local` based on `frontend/.env.local.example`:

```env
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=

# Database
DATABASE_URL=
DIRECT_URL=

# Contracts
NEXT_PUBLIC_CONTRACT_ADDRESS=0x8e3dA6E6f912877719F86de5Ab8efdE7E71412b4
NEXT_PUBLIC_USDC_ADDRESS=0x534b2f3A21130d7a60830c2Df862319e593943A3
NEXT_PUBLIC_MONAD_RPC=

# Backend signer
SIGNER_PRIVATE_KEY=

# Pyth
PYTH_ENTROPY_ADDRESS=0x825c0390f379c631f3cf11a82a37d20bddf93c07

# Server
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Install & Run

```bash
# Frontend
cd frontend
npm install
npx prisma migrate deploy
npm run dev
```

```bash
# Contracts (optional — already deployed)
cd contracts
forge build
forge test
```

### Deploy Contract

```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast
```

---

## Deployment

Deployed on **Railway** with automatic builds.

```toml
# railway.toml
[build]
installCommand = "npm install"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

---

## License

MIT
