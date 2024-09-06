// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MyOFT.sol";

/// @title OFT Factory for Cross-Chain Token Deployment
/// @notice This contract allows for the deployment and configuration of MyOFT tokens across multiple chains
/// @dev Supports deployment on Base Sepolia, Avalanche Fuji, and Ethereum Sepolia testnets
contract OFTFactory is Ownable {
    /// @notice LayerZero endpoint for Base Sepolia testnet
    address public immutable baseEndpoint;
    /// @notice LayerZero endpoint for Avalanche Fuji testnet
    address public immutable fujiEndpoint;
    /// @notice LayerZero endpoint for Ethereum Sepolia testnet
    address public immutable sepoliaEndpoint;

    /// @notice Mapping of chain IDs to their respective peer addresses
    /// @dev Key is the chain ID, value is the peer address as bytes32
    mapping(uint32 => bytes32) public defaultPeers;

    /// @notice Emitted when a new OFT is deployed
    /// @param oftAddress The address of the newly deployed OFT
    /// @param name The name of the OFT
    /// @param symbol The symbol of the OFT
    /// @param chainId The chain ID where the OFT was deployed
    event OFTDeployed(address indexed oftAddress, string name, string symbol, uint32 chainId);

    /// @notice Initializes the factory with LayerZero endpoints
    constructor() Ownable(msg.sender) {
        baseEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f; // Base Sepolia Testnet
        fujiEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f; // Avalanche Fuji Testnet
        sepoliaEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f; // Ethereum Sepolia Testnet
    }

    /// @notice Deploys a new MyOFT contract
    /// @dev Only the owner can call this function
    /// @param name The name of the new OFT
    /// @param symbol The symbol of the new OFT
    /// @param chainId The chain ID where the OFT is being deployed
    /// @return The address of the newly deployed OFT
    function deployOFT(string memory name, string memory symbol, uint32 chainId) external onlyOwner returns (address) {
        address lzEndpoint;
        if (chainId == 40245) {
            // Base Sepolia
            lzEndpoint = baseEndpoint;
        } else if (chainId == 40106) {
            // Avalanche Fuji
            lzEndpoint = fujiEndpoint;
        } else if (chainId == 40161) {
            // Ethereum Sepolia
            lzEndpoint = sepoliaEndpoint;
        } else {
            revert("Unsupported chain");
        }

        MyOFT newOFT = new MyOFT(name, symbol, lzEndpoint, address(this));

        configureNewOFT(address(newOFT), chainId);

        emit OFTDeployed(address(newOFT), name, symbol, chainId);
        return address(newOFT);
    }

    /// @notice Configures a newly deployed OFT with peer information
    /// @dev Sets peers for all supported chains except the source chain
    /// @param oftAddress The address of the OFT to configure
    /// @param sourceChainId The chain ID where the OFT was deployed
    function configureNewOFT(address oftAddress, uint32 sourceChainId) internal {
        MyOFT oft = MyOFT(oftAddress);

        uint32[] memory supportedChains = new uint32[](3);
        supportedChains[0] = 40245; // Base Sepolia Testnet
        supportedChains[1] = 40106; // Avalanche Fuji Testnet
        supportedChains[2] = 40161; // Ethereum Sepolia Testnet

        for (uint i = 0; i < supportedChains.length; i++) {
            if (supportedChains[i] != sourceChainId && defaultPeers[supportedChains[i]] != bytes32(0)) {
                oft.setPeer(supportedChains[i], defaultPeers[supportedChains[i]]);
            }
        }
    }

    /// @notice Sets the default peer for a given chain ID
    /// @dev Only the owner can call this function
    /// @param eid The chain ID to set the peer for
    /// @param peer The peer address as bytes32
    function setDefaultPeer(uint32 eid, bytes32 peer) external onlyOwner {
        defaultPeers[eid] = peer;
    }

    /// @notice Transfers ownership of a deployed OFT
    /// @dev Only the factory owner can call this function
    /// @param oftAddress The address of the OFT to transfer ownership of
    /// @param newOwner The address of the new owner
    function transferOFTOwnership(address oftAddress, address newOwner) external onlyOwner {
        MyOFT(oftAddress).transferOwnership(newOwner);
    }
}
