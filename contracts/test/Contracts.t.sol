// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ServiceRegistry.sol";
import "../src/SpendingPolicy.sol";
import "../src/Attestation.sol";

contract ServiceRegistryTest is Test {
    ServiceRegistry registry;

    function setUp() public {
        registry = new ServiceRegistry();
    }

    function test_registerProvider() public {
        bytes32 id = keccak256("gemini-3-flash-preview");
        registry.register(id, "gemini-3-flash-preview", 50, "https://api.nanopay.local/gemini");
        (address wallet, string memory model, uint256 price, , bool active) = registry.providers(id);
        assertEq(wallet, address(this));
        assertEq(model, "gemini-3-flash-preview");
        assertEq(price, 50);
        assertTrue(active);
    }
}

contract SpendingPolicyTest is Test {
    SpendingPolicy policy;

    function setUp() public {
        policy = new SpendingPolicy();
    }

    function test_chargeWithinCaps() public {
        policy.setPolicy(100_000, 50_000, 1_000);
        assertTrue(policy.canCharge(address(this), 500));
        policy.charge(address(this), 500);
    }

    function test_rejectsOverPerTxCap() public {
        policy.setPolicy(100_000, 50_000, 1_000);
        vm.expectRevert(bytes("per-tx cap"));
        policy.charge(address(this), 1_001);
    }

    function test_rejectsOverDailyCap() public {
        policy.setPolicy(1_500, 5_000, 1_000);
        policy.charge(address(this), 1_000);
        vm.expectRevert(bytes("daily cap"));
        policy.charge(address(this), 600);
    }
}

contract AttestationTest is Test {
    Attestation attestation;

    function test_anchorReceipt() public {
        attestation = new Attestation();
        bytes32 streamId = keccak256("stream-1");
        attestation.anchor(streamId, address(this), keccak256("gemini-3-flash-preview"), 200, 10_000, 5);
        (address payer,, uint256 tokens, uint256 total, uint8 quality,) = attestation.receipts(streamId);
        assertEq(payer, address(this));
        assertEq(tokens, 200);
        assertEq(total, 10_000);
        assertEq(quality, 5);
    }
}
