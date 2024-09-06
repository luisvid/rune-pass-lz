// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "./RuneCrossChainToken.sol"; // Import the RuneCrossChainToken contract

/**
 * @title RuneTokenFactory
 * @dev This contract allows deploying new RuneCrossChainTokens based on Rune metadata.
 * It mints tokens for a given Rune or adds to the existing token supply if already created.
 */
contract RuneTokenFactory is Ownable {
    /// @notice Mapping from a unique Rune (identified by the Rune ID) to the deployed token address.
    mapping(bytes32 => address) public runeToToken;

    /// @notice Event emitted when a new RuneCrossChainToken is created.
    event RuneTokenCreated(address indexed tokenAddress, bytes32 indexed runeId);

    /**
     * @dev Constructor that sets the initial owner for the factory contract.
     * @param _owner The address of the initial owner of the factory contract.
     */
    constructor(address _owner) Ownable(_owner) {
        require(_owner != address(0), "Owner address cannot be zero");
    }

    /**
     * @notice Deploys a new RuneCrossChainToken or mints additional tokens if the token already exists.
     * @param _name The name of the ERC20 token.
     * @param _symbol The symbol of the ERC20 token.
     * @param _lzEndpoint The LayerZero endpoint for cross-chain functionality.
     * @param _delegate The address of the contract delegate or owner.
     * @param _runeId A unique identifier or content of the Rune.
     * @param _runeOwner The original owner's Taproot address (in string format).
     * @param _bagAmount The number of Runes in the bag (to mint).
     * @param _recipient The recipient EVM address to receive the minted tokens.
     */
    function createRuneToken(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate,
        bytes32 _runeId,
        string memory _runeOwner,
        uint256 _bagAmount,
        address _recipient
    ) external onlyOwner returns (address) {
        // Check if a token has already been created for this Rune
        address tokenAddress = runeToToken[_runeId];

        if (tokenAddress == address(0)) {
            // Create RuneMetadata struct
            RuneCrossChainToken.RuneMetadata memory metadata = RuneCrossChainToken.RuneMetadata({
                runeId: _runeId,
                runeOwner: _runeOwner,
                bagAmount: _bagAmount
            });

            // If no token exists, deploy a new RuneCrossChainToken
            RuneCrossChainToken newToken = new RuneCrossChainToken(
                _name,
                _symbol,
                _lzEndpoint,
                _delegate,
                metadata,
                address(this) // Pass the factory address as the authorized minter
            );

            // Store the deployed contract's address in the runeToToken mapping
            runeToToken[_runeId] = address(newToken);

            // Emit an event for the new token creation
            emit RuneTokenCreated(address(newToken), _runeId);

            // Mint the tokens and send them to the recipient
            newToken.mint(_recipient, _bagAmount);

            // Return the address of the newly created token
            return address(newToken);
        } else {
            // If the token already exists, mint additional tokens to the recipient
            RuneCrossChainToken existingToken = RuneCrossChainToken(tokenAddress);
            existingToken.mint(_recipient, _bagAmount);

            // Return the address of the existing token
            return tokenAddress;
        }
    }

    /**
     * @notice Returns the address of the token contract for a specific Rune.
     * @param _runeId The unique identifier or content of the Rune.
     * @return The address of the deployed RuneCrossChainToken contract.
     */
    function getRuneTokenAddress(bytes32 _runeId) external view returns (address) {
        return runeToToken[_runeId];
    }
}
