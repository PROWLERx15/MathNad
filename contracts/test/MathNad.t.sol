// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MathNad} from "../src/MathNad.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {EntropyStructs} from "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";

// =============================================================
//                       MOCK CONTRACTS
// =============================================================

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockEntropy {
    uint64 private _sequenceCounter;
    mapping(uint64 => address) private _consumers;

    function getFeeV2() external pure returns (uint128) {
        return 0.01 ether;
    }

    function requestV2() external payable returns (uint64 sequenceNumber) {
        _sequenceCounter++;
        sequenceNumber = _sequenceCounter;
        _consumers[sequenceNumber] = msg.sender;
    }

    function triggerCallback(uint64 seq, bytes32 rand) external {
        address consumer = _consumers[seq];
        IEntropyConsumer(consumer)._entropyCallback(seq, address(this), rand);
    }
}

// =============================================================
//                       TESTS
// =============================================================

contract MathNadTest is Test {
    using {toEthSignedMessageHash} for bytes32;

    MathNad public game;
    MockUSDC public usdc;
    MockEntropy public mockEntropy;

    address public owner = address(this);
    address public player1 = address(0x1);
    address public player2 = address(0x2);
    address public outsider = address(0x3);

    uint256 public verifierPk = 0xBEEF;
    address public verifier;

    uint256 public constant STAKE = 1_000_000; // 1 USDC

    function setUp() public {
        verifier = vm.addr(verifierPk);

        usdc = new MockUSDC();
        mockEntropy = new MockEntropy();
        game = new MathNad(
            address(mockEntropy),
            verifier,
            address(usdc)
        );

        // Fund players with USDC
        usdc.mint(player1, 100_000_000); // 100 USDC
        usdc.mint(player2, 100_000_000);

        // Approve USDC for the game contract
        vm.prank(player1);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(player2);
        usdc.approve(address(game), type(uint256).max);

        // Fund players with MON for entropy fees
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
    }

    // =============================================================
    //                       HELPERS
    // =============================================================

    function _signWinner(
        uint256 duelId,
        address winner
    ) internal view returns (bytes memory) {
        bytes32 hash = keccak256(
            abi.encodePacked(duelId, winner, "MATHNAD_WINNER")
        );
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function _createDuel(
        address creator,
        string memory code
    ) internal returns (uint256) {
        vm.prank(creator);
        return game.createDuel(STAKE, 30, code);
    }

    function _joinDuelNormal(address joiner, string memory code) internal {
        uint128 fee = 0.01 ether;
        vm.prank(joiner);
        game.joinDuel{value: fee}(code);
    }

    function _fullDuelSetup(
        string memory code
    ) internal returns (uint256 duelId) {
        duelId = _createDuel(player1, code);
        _joinDuelNormal(player2, code);
        // Trigger entropy callback
        mockEntropy.triggerCallback(1, bytes32(uint256(12345)));
    }

    // =============================================================
    //                       TEST: CREATE DUEL
    // =============================================================

    function testCreateDuel() public {
        uint256 balBefore = usdc.balanceOf(player1);

        vm.prank(player1);
        uint256 duelId = game.createDuel(STAKE, 30, "ABC123");

        assertEq(duelId, 1);
        assertEq(game.codeToId("ABC123"), 1);
        assertEq(usdc.balanceOf(player1), balBefore - STAKE);
        assertEq(usdc.balanceOf(address(game)), STAKE);

        (
            address p1,
            address p2,
            uint256 stake,
            uint8 duration,
            ,
            bool active,
            bool fulfilled,

        ) = game.duels(1);
        assertEq(p1, player1);
        assertEq(p2, address(0));
        assertEq(stake, STAKE);
        assertEq(duration, 30);
        assertTrue(active);
        assertFalse(fulfilled);
    }

    // =============================================================
    //                       TEST: JOIN DUEL
    // =============================================================

    function testJoinDuel() public {
        _createDuel(player1, "JOIN01");

        uint256 balBefore = usdc.balanceOf(player2);
        uint128 fee = 0.01 ether;

        vm.prank(player2);
        game.joinDuel{value: fee}("JOIN01");

        assertEq(usdc.balanceOf(player2), balBefore - STAKE);

        // Trigger entropy callback
        mockEntropy.triggerCallback(1, bytes32(uint256(99999)));

        (, address p2, , , , , bool fulfilled, uint256 seed) = game.duels(1);
        assertEq(p2, player2);
        assertTrue(fulfilled);
        assertEq(seed, 99999);
    }

    // =============================================================
    //                       TEST: SETTLE DUEL
    // =============================================================

    function testSettleDuel() public {
        uint256 duelId = _fullDuelSetup("SETTLE");

        bytes memory sig = _signWinner(duelId, player1);
        uint256 balBefore = usdc.balanceOf(player1);

        game.settleDuel(duelId, player1, sig);

        // Winner gets 95% of total pot (5% platform fee)
        uint256 totalPot = STAKE * 2;
        uint256 platformCut = (totalPot * 500) / 10000;
        uint256 expectedPayout = totalPot - platformCut;

        assertEq(usdc.balanceOf(player1), balBefore + expectedPayout);

        (, , , , , bool active, , ) = game.duels(duelId);
        assertFalse(active);
    }

    // =============================================================
    //                       TEST: BAD SIGNATURE
    // =============================================================

    function testSettleDuel_BadSignature() public {
        uint256 duelId = _fullDuelSetup("BADSIG");

        // Sign with wrong key
        uint256 wrongPk = 0xDEAD;
        bytes32 hash = keccak256(
            abi.encodePacked(duelId, player1, "MATHNAD_WINNER")
        );
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(MathNad.InvalidSignature.selector);
        game.settleDuel(duelId, player1, badSig);
    }

    // =============================================================
    //                       TEST: WRONG WINNER
    // =============================================================

    function testSettleDuel_WrongWinner() public {
        uint256 duelId = _fullDuelSetup("WRONG1");

        bytes memory sig = _signWinner(duelId, outsider);

        vm.expectRevert(MathNad.WinnerNotParticipant.selector);
        game.settleDuel(duelId, outsider, sig);
    }

    // =============================================================
    //                       TEST: SEED NOT READY
    // =============================================================

    function testSettleDuel_SeedNotReady() public {
        _createDuel(player1, "NOSEED");
        _joinDuelNormal(player2, "NOSEED");
        // DO NOT trigger entropy callback

        uint256 duelId = game.codeToId("NOSEED");
        bytes memory sig = _signWinner(duelId, player1);

        vm.expectRevert(MathNad.SeedNotReady.selector);
        game.settleDuel(duelId, player1, sig);
    }

    // =============================================================
    //                       TEST: FALLBACK MODE
    // =============================================================

    function testFallbackMode() public {
        game.setFallbackMode(true);

        vm.prank(player1);
        uint256 duelId = game.createDuel(STAKE, 60, "FALLBK");

        vm.prank(player2);
        game.joinDuel("FALLBK");

        (, , , , , , bool fulfilled, uint256 seed) = game.duels(duelId);
        assertTrue(fulfilled);
        assertTrue(seed != 0);
    }
}

// Helper to match OpenZeppelin's MessageHashUtils
function toEthSignedMessageHash(bytes32 hash) pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
}
