// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MathNad is Ownable, ReentrancyGuard, IEntropyConsumer {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;

    // =============================================================
    //                       CUSTOM ERRORS
    // =============================================================

    error StakeRequired();
    error DuelNotActive();
    error DuelFull();
    error DuelNotStarted();
    error DuelAlreadySettled();
    error WinnerNotParticipant();
    error InvalidSignature();
    error SeedNotReady();
    error InvalidDuration();
    error CodeAlreadyUsed();
    error NoFundsToWithdraw();
    error InsufficientEntropyFee();
    error RefundFailed();
    error EntropyFeeCallFailed();
    error EntropyRequestFailed();

    // =============================================================
    //                       CONSTANTS
    // =============================================================

    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%

    // =============================================================
    //                       STATE
    // =============================================================

    address public verifier;
    IEntropyV2 public immutable entropy;
    IERC20 public immutable usdc;
    uint256 public duelCounter;
    bool public useFallbackRandomness;
    uint64 private fallbackSequenceCounter;

    mapping(uint256 => Duel) public duels;
    mapping(string => uint256) public codeToId;
    mapping(uint64 => uint256) public entropyRequestToDuelId;

    // =============================================================
    //                       STRUCTS
    // =============================================================

    struct Duel {
        address player1;
        address player2;
        uint256 stake;
        uint8 gameDuration; // 30 or 60 seconds
        string joinCode;
        bool active;
        bool fulfilled; // true after Pyth Entropy callback
        uint256 randomSeed;
    }

    // =============================================================
    //                       EVENTS
    // =============================================================

    event DuelCreated(
        uint256 indexed duelId,
        address indexed player1,
        uint256 stake,
        uint8 duration,
        string joinCode
    );
    event DuelJoined(uint256 indexed duelId, address indexed player2);
    event DuelSeedFulfilled(uint256 indexed duelId, uint256 seed);
    event DuelSettled(
        uint256 indexed duelId,
        address indexed winner,
        uint256 payout
    );
    event FallbackModeChanged(bool enabled);

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    constructor(
        address _entropy,
        address _verifier,
        address _usdc
    ) Ownable(msg.sender) {
        entropy = IEntropyV2(_entropy);
        verifier = _verifier;
        usdc = IERC20(_usdc);
        useFallbackRandomness = false;
        fallbackSequenceCounter = 1;
    }

    // =============================================================
    //                       DUEL LOGIC
    // =============================================================

    function createDuel(
        uint256 stakeAmount,
        uint8 duration,
        string calldata joinCode
    ) external returns (uint256 duelId) {
        if (stakeAmount == 0) revert StakeRequired();
        if (duration != 30 && duration != 60) revert InvalidDuration();
        if (codeToId[joinCode] != 0) revert CodeAlreadyUsed();

        usdc.safeTransferFrom(msg.sender, address(this), stakeAmount);

        duelCounter++;
        duelId = duelCounter;

        duels[duelId] = Duel({
            player1: msg.sender,
            player2: address(0),
            stake: stakeAmount,
            gameDuration: duration,
            joinCode: joinCode,
            active: true,
            fulfilled: false,
            randomSeed: 0
        });

        codeToId[joinCode] = duelId;

        emit DuelCreated(duelId, msg.sender, stakeAmount, duration, joinCode);
    }

    function joinDuel(string calldata joinCode) external payable nonReentrant {
        uint256 duelId = codeToId[joinCode];
        Duel storage duel = duels[duelId];

        if (!duel.active) revert DuelNotActive();
        if (duel.player2 != address(0)) revert DuelFull();

        usdc.safeTransferFrom(msg.sender, address(this), duel.stake);

        duel.player2 = msg.sender;

        if (useFallbackRandomness) {
            // Fallback mode: generate seed immediately
            uint64 seq = fallbackSequenceCounter++;
            duel.randomSeed = uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        msg.sender,
                        seq,
                        blockhash(block.number - 1)
                    )
                )
            );
            duel.fulfilled = true;

            // Refund all MON sent
            if (msg.value > 0) {
                (bool refundSuccess, ) = payable(msg.sender).call{
                    value: msg.value
                }("");
                if (!refundSuccess) revert RefundFailed();
            }

            emit DuelJoined(duelId, msg.sender);
            emit DuelSeedFulfilled(duelId, duel.randomSeed);
        } else {
            // Normal mode: request Pyth Entropy
            uint128 fee;
            try entropy.getFeeV2() returns (uint128 _fee) {
                fee = _fee;
            } catch {
                revert EntropyFeeCallFailed();
            }

            if (msg.value < fee) revert InsufficientEntropyFee();

            uint64 sequenceNumber;
            try entropy.requestV2{value: fee}() returns (
                uint64 _sequenceNumber
            ) {
                sequenceNumber = _sequenceNumber;
            } catch {
                revert EntropyRequestFailed();
            }

            entropyRequestToDuelId[sequenceNumber] = duelId;

            // Refund excess MON
            if (msg.value > fee) {
                uint256 refundAmount = msg.value - uint256(fee);
                (bool refundSuccess, ) = payable(msg.sender).call{
                    value: refundAmount
                }("");
                if (!refundSuccess) revert RefundFailed();
            }

            emit DuelJoined(duelId, msg.sender);
        }
    }

    // =============================================================
    //                   PYTH ENTROPY CALLBACK
    // =============================================================

    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        // MUST NEVER REVERT
        uint256 duelId = entropyRequestToDuelId[sequenceNumber];
        Duel storage duel = duels[duelId];

        if (duel.active) {
            duel.randomSeed = uint256(randomNumber);
            duel.fulfilled = true;
            emit DuelSeedFulfilled(duelId, uint256(randomNumber));
        }
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    // =============================================================
    //                       SETTLEMENT
    // =============================================================

    function settleDuel(
        uint256 duelId,
        address winner,
        bytes calldata signature
    ) external nonReentrant {
        Duel storage duel = duels[duelId];

        if (duel.player2 == address(0)) revert DuelNotStarted();
        if (!duel.fulfilled) revert SeedNotReady();
        if (!duel.active) revert DuelAlreadySettled();

        // Verify ECDSA signature from backend verifier
        bytes32 hash = keccak256(
            abi.encodePacked(duelId, winner, "MATHNAD_WINNER")
        );
        bytes32 ethSignedMessageHash = hash.toEthSignedMessageHash();
        address recovered = ethSignedMessageHash.recover(signature);
        if (recovered != verifier) revert InvalidSignature();

        // Validate winner is a participant
        if (winner != duel.player1 && winner != duel.player2)
            revert WinnerNotParticipant();

        // Calculate distribution
        uint256 totalPot = duel.stake * 2;
        uint256 platformCut = (totalPot * PLATFORM_FEE_BPS) / 10000;
        uint256 winnerPayout = totalPot - platformCut;

        // Update state
        duel.active = false;

        // Transfer USDC to winner
        usdc.safeTransfer(winner, winnerPayout);

        emit DuelSettled(duelId, winner, winnerPayout);
    }

    // =============================================================
    //                       ADMIN
    // =============================================================

    function setFallbackMode(bool enabled) external onlyOwner {
        useFallbackRandomness = enabled;
        emit FallbackModeChanged(enabled);
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NoFundsToWithdraw();
        usdc.safeTransfer(owner(), balance);
    }

    function withdrawNative() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert RefundFailed();
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    function getEntropyFee() external view returns (uint256) {
        if (useFallbackRandomness) {
            return 0;
        }
        try entropy.getFeeV2() returns (uint128 fee) {
            return uint256(fee);
        } catch {
            return 0;
        }
    }
}
