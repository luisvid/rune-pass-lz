// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "./RuneCrossChainToken.sol"; // Import the RuneCrossChainToken contract

/**
 * @title The-Ravning-Passage - RuneTokenFactory
 * @dev This contract allows deploying new RuneCrossChainTokens based on Rune metadata.
 * It mints tokens for a given Rune or adds to the existing token supply if already created.
 */
contract RuneTokenFactory is Ownable {
    /// @notice The LayerZero endpoint
    address public immutable lzEndpoint;

    /// @notice Mapping from a unique Rune (identified by the Rune ID) to the deployed token address.
    mapping(bytes32 => address) public deployedRunesToken;

    /// @notice Emitted when a new OFT is deployed
    /// @param oftAddress The address of the newly deployed OFT
    /// @param name The name of the OFT
    /// @param symbol The symbol of the OFT
    /// @param chainId The chain ID where the OFT was deployed
    event RuneTokenDeployed(address indexed oftAddress, string name, string symbol, uint32 chainId);

    /// @notice Initializes the factory with LayerZero endpoints
    /// @param _lzEndpoint The LayerZero endpoint address
    constructor(address _lzEndpoint) Ownable(msg.sender) {
        require(_lzEndpoint != address(0), "Invalid LZ Endpoint address");
        lzEndpoint = _lzEndpoint;
    }

    /**
     * @notice Deploys a new RuneCrossChainToken or mints additional tokens if the token already exists.
     * @param _name The name of the ERC20 token.
     * @param _symbol The symbol of the ERC20 token.
     * @param _chainId The chain ID where the OFT is being deployed
     */
    function deployRuneToken(
        string memory _name,
        string memory _symbol,
        uint32 _chainId
    ) external onlyOwner returns (address) {
        // Check if a token has already been created for this Rune
        bytes32 key = keccak256(abi.encodePacked(_name, _symbol, _chainId));
        address tokenAddress = deployedRunesToken[key];
        require(tokenAddress == address(0), "Rune token already deployed");

        // If no token exists, deploy a new RuneCrossChainToken
        RuneCrossChainToken newToken = new RuneCrossChainToken(_name, _symbol, lzEndpoint, address(this));

        // Store the deployed contract's address in the runeToToken mapping
        deployedRunesToken[key] = address(newToken);

        // Emit an event for the new token creation
        emit RuneTokenDeployed(address(newToken), _name, _symbol, _chainId);

        // Return the address of the newly created token
        return address(newToken);
    }

    // call function configureRuneMetadata() from RuneCrossChainToken contract
    /// @notice Configures the metadata of a deployed OFT
    /// @dev Only the factory owner can call this function
    /// @param oftAddress The address of the OFT to configure metadata for
    /// @param _runeId The unique identifier or content of the Rune
    /// @param _runeOwner The original owner's Taproot address
    /// @param _bagAmount The number of Runes in the bag
    function configureRuneMetadata(
        address oftAddress,
        bytes32 _runeId,
        string memory _runeOwner,
        uint256 _bagAmount
    ) external onlyOwner {
        require(oftAddress != address(0), "Invalid OFT address");
        require(bytes(_runeOwner).length > 0, "Rune owner cannot be empty");
        require(_bagAmount > 0, "Bag amount must be greater than 0");

        RuneCrossChainToken oft = RuneCrossChainToken(oftAddress);

        // Create RuneMetadata struct
        RuneCrossChainToken.RuneMetadata memory metadata = RuneCrossChainToken.RuneMetadata({
            runeId: _runeId,
            runeOwner: _runeOwner,
            bagAmount: _bagAmount
        });
        oft.configureRuneMetadata(metadata);
    }

    /// @notice Retrieves the address of a deployed OFT contract
    /// @param name The name of the OFT token
    /// @param symbol The symbol of the OFT token
    /// @param chainId The chain ID where the OFT was deployed
    /// @return The address of the deployed OFT contract
    function getOFTAddress(string memory name, string memory symbol, uint32 chainId) public view returns (address) {
        bytes32 key = keccak256(abi.encodePacked(name, symbol, chainId));
        return deployedRunesToken[key];
    }

    /// @notice Transfers ownership of a deployed OFT
    /// @dev Only the factory owner can call this function. Ownership is transferred only if the newOwner is different from the current owner.
    /// @param oftAddress The address of the OFT to transfer ownership of
    /// @param newOwner The address of the new owner
    function transferOFTOwnership(address oftAddress, address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");

        RuneCrossChainToken oft = RuneCrossChainToken(oftAddress);
        address currentOwner = oft.owner();

        // Avoiding revert by transferring only if the new owner is different
        if (currentOwner != newOwner) {
            oft.transferOwnership(newOwner);
        }
    }
}
