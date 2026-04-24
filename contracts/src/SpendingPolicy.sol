// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SpendingPolicy {
    struct Policy {
        uint256 dailyCapMicroUsd;
        uint256 perStreamCapMicroUsd;
        uint256 perTxCapMicroUsd;
        uint256 spentTodayMicroUsd;
        uint256 dayStart;
    }

    mapping(address => Policy) public policies;

    event PolicySet(address indexed owner, uint256 dailyCap, uint256 perStreamCap, uint256 perTxCap);
    event Charged(address indexed owner, uint256 amountMicroUsd, uint256 spentTodayMicroUsd);

    function setPolicy(uint256 dailyCap, uint256 perStreamCap, uint256 perTxCap) external {
        policies[msg.sender] = Policy({
            dailyCapMicroUsd: dailyCap,
            perStreamCapMicroUsd: perStreamCap,
            perTxCapMicroUsd: perTxCap,
            spentTodayMicroUsd: 0,
            dayStart: block.timestamp
        });
        emit PolicySet(msg.sender, dailyCap, perStreamCap, perTxCap);
    }

    function canCharge(address owner, uint256 amountMicroUsd) public view returns (bool) {
        Policy memory p = policies[owner];
        if (amountMicroUsd > p.perTxCapMicroUsd) return false;
        uint256 spent = block.timestamp >= p.dayStart + 1 days ? 0 : p.spentTodayMicroUsd;
        return spent + amountMicroUsd <= p.dailyCapMicroUsd;
    }

    function charge(address owner, uint256 amountMicroUsd) external {
        Policy storage p = policies[owner];
        if (block.timestamp >= p.dayStart + 1 days) {
            p.spentTodayMicroUsd = 0;
            p.dayStart = block.timestamp;
        }
        require(amountMicroUsd <= p.perTxCapMicroUsd, "per-tx cap");
        require(p.spentTodayMicroUsd + amountMicroUsd <= p.dailyCapMicroUsd, "daily cap");
        p.spentTodayMicroUsd += amountMicroUsd;
        emit Charged(owner, amountMicroUsd, p.spentTodayMicroUsd);
    }
}
