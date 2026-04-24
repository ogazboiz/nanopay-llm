// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ServiceRegistry.sol";
import "../src/SpendingPolicy.sol";
import "../src/Attestation.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        ServiceRegistry registry = new ServiceRegistry();
        SpendingPolicy policy = new SpendingPolicy();
        Attestation attestation = new Attestation();

        console2.log("ServiceRegistry:", address(registry));
        console2.log("SpendingPolicy:", address(policy));
        console2.log("Attestation:", address(attestation));

        vm.stopBroadcast();
    }
}
