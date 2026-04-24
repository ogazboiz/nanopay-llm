// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ServiceRegistry.sol";
import "../src/SpendingPolicy.sol";
import "../src/Attestation.sol";

/// @notice Deploys NanoPay auxiliary contracts. ERC-8004 contracts are NOT deployed —
///         we integrate with the canonical Arc deployments:
///           IdentityRegistry    0x8004A818BFB912233c491871b3d84c89A494BD9e
///           ReputationRegistry  0x8004B663056A597Dffe9eCcC1965A193B7388713
///           ValidationRegistry  0x8004Cb1BF31DAf7788923b405b754f57acEB4272
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        ServiceRegistry serviceRegistry = new ServiceRegistry();
        SpendingPolicy policy = new SpendingPolicy();
        Attestation attestation = new Attestation();

        console2.log("ServiceRegistry:    ", address(serviceRegistry));
        console2.log("SpendingPolicy:     ", address(policy));
        console2.log("Attestation:        ", address(attestation));
        console2.log("");
        console2.log("ERC-8004 (canonical Arc):");
        console2.log("  IdentityRegistry:   0x8004A818BFB912233c491871b3d84c89A494BD9e");
        console2.log("  ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713");
        console2.log("  ValidationRegistry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272");

        vm.stopBroadcast();
    }
}
