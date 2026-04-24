// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ServiceRegistry {
    struct Provider {
        address wallet;
        string model;
        uint256 pricePerTokenMicroUsd;
        string endpoint;
        bool active;
    }

    mapping(bytes32 => Provider) public providers;
    bytes32[] public providerIds;

    event ProviderRegistered(bytes32 indexed id, address indexed wallet, string model, uint256 pricePerTokenMicroUsd);
    event ProviderDeactivated(bytes32 indexed id);

    function register(
        bytes32 id,
        string calldata model,
        uint256 pricePerTokenMicroUsd,
        string calldata endpoint
    ) external {
        require(providers[id].wallet == address(0), "already registered");
        providers[id] = Provider({
            wallet: msg.sender,
            model: model,
            pricePerTokenMicroUsd: pricePerTokenMicroUsd,
            endpoint: endpoint,
            active: true
        });
        providerIds.push(id);
        emit ProviderRegistered(id, msg.sender, model, pricePerTokenMicroUsd);
    }

    function deactivate(bytes32 id) external {
        require(providers[id].wallet == msg.sender, "not owner");
        providers[id].active = false;
        emit ProviderDeactivated(id);
    }

    function count() external view returns (uint256) {
        return providerIds.length;
    }
}
