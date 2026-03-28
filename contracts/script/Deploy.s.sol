// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MathNad} from "../src/MathNad.sol";

contract DeployMathNad is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0)
        );

        address entropyAddress = vm.envOr(
            "PYTH_ENTROPY",
            address(0x825c0390f379C631f3Cf11A82a37D20BddF93c07)
        );
        address verifier = vm.envAddress("VERIFIER");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        MathNad game = new MathNad(entropyAddress, verifier, usdcAddress);

        // Deploy with fallback mode ON for demo day
        // game.setFallbackMode(true);

        console.log("MathNad deployed at:", address(game));
        console.log("Using Pyth Entropy at:", entropyAddress);
        console.log("Using USDC at:", usdcAddress);
        console.log("Verifier:", verifier);
        // console.log("Fallback mode: ON (for demo)");

        vm.stopBroadcast();
    }
}
