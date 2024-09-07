// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MyOFT.sol";

/// @title OFT Factory for Cross-Chain Token Deployment
/// @notice This contract allows for the deployment and configuration of MyOFT tokens across multiple chains
/// @dev Supports deployment on Base Sepolia, Avalanche Fuji, and Ethereum Sepolia testnets
contract OFTFactory is Ownable {
    /// @notice The LayerZero endpoint
    address public immutable lzEndpoint;

    // Maps hash(name, symbol, chainId) to OFT address
    mapping(bytes32 => address) private deployedOFTs;

    /// @notice Emitted when a new OFT is deployed
    /// @param oftAddress The address of the newly deployed OFT
    /// @param name The name of the OFT
    /// @param symbol The symbol of the OFT
    /// @param chainId The chain ID where the OFT was deployed
    event OFTDeployed(address indexed oftAddress, string name, string symbol, uint32 chainId);

    /// @notice Initializes the factory with LayerZero endpoints
    /// @param _lzEndpoint The LayerZero endpoint address
    constructor(address _lzEndpoint) Ownable(msg.sender) {
        require(_lzEndpoint != address(0), "Invalid LZ Endpoint address");
        lzEndpoint = _lzEndpoint;
    }

    /// @notice Deploys a new MyOFT contract
    /// @dev Only the owner can call this function
    /// @param name The name of the new OFT
    /// @param symbol The symbol of the new OFT
    /// @param chainId The chain ID where the OFT is being deployed
    /// @return The address of the newly deployed OFT
    function deployOFT(string memory name, string memory symbol, uint32 chainId) external onlyOwner returns (address) {
        // require(getOFTAddress(name, symbol, chainId) == address(0), "OFT already deployed");

        // Deploy the OFT contract
        MyOFT newOFT = new MyOFT(name, symbol, lzEndpoint, address(this));

        // Store the deployed OFT address in the mapping
        bytes32 key = keccak256(abi.encodePacked(name, symbol, chainId));
        deployedOFTs[key] = address(newOFT);

        emit OFTDeployed(address(newOFT), name, symbol, chainId);
        return address(newOFT);
    }

    /// @notice Retrieves the address of a deployed OFT contract
    /// @param name The name of the OFT token
    /// @param symbol The symbol of the OFT token
    /// @param chainId The chain ID where the OFT was deployed
    /// @return The address of the deployed OFT contract
    function getOFTAddress(string memory name, string memory symbol, uint32 chainId) public view returns (address) {
        bytes32 key = keccak256(abi.encodePacked(name, symbol, chainId));
        return deployedOFTs[key];
    }

    /// @notice Transfers ownership of a deployed OFT
    /// @dev Only the factory owner can call this function
    /// @param oftAddress The address of the OFT to transfer ownership of
    /// @param newOwner The address of the new owner
    function transferOFTOwnership(address oftAddress, address newOwner) external onlyOwner {
        MyOFT(oftAddress).transferOwnership(newOwner);
    }
}
