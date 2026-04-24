// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Attestation {
    struct Receipt {
        address payer;
        bytes32 providerId;
        uint256 tokens;
        uint256 totalMicroUsd;
        uint8 qualityScore;
        uint256 timestamp;
    }

    mapping(bytes32 => Receipt) public receipts;

    event ReceiptAnchored(
        bytes32 indexed streamId,
        address indexed payer,
        bytes32 indexed providerId,
        uint256 tokens,
        uint256 totalMicroUsd,
        uint8 qualityScore
    );

    function anchor(
        bytes32 streamId,
        address payer,
        bytes32 providerId,
        uint256 tokens,
        uint256 totalMicroUsd,
        uint8 qualityScore
    ) external {
        require(receipts[streamId].timestamp == 0, "exists");
        receipts[streamId] = Receipt({
            payer: payer,
            providerId: providerId,
            tokens: tokens,
            totalMicroUsd: totalMicroUsd,
            qualityScore: qualityScore,
            timestamp: block.timestamp
        });
        emit ReceiptAnchored(streamId, payer, providerId, tokens, totalMicroUsd, qualityScore);
    }
}
