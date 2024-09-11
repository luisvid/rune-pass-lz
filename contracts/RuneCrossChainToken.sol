// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/**
 * @title RuneCrossChainToken
 * @dev ERC20 token representing Bitcoin Runes with LayerZero functionality for cross-chain transfers.
 * This contract includes metadata associated with the Bitcoin Rune at the time of creation,
 * and allows only the factory to mint additional tokens.
 */
contract RuneCrossChainToken is OFT {
    /// @notice Struct to hold metadata of the Rune.
    struct RuneMetadata {
        bytes32 runeId; // A unique identifier or content of the Rune
        string runeOwner; // The original owner's Taproot address
        uint256 bagAmount; // The number of Runes in the bag
    }

    /// @notice The metadata of the Bitcoin Rune.
    RuneMetadata public runeMetadata;

    /**
     * @dev Constructor to initialize the Bitcoin Rune's metadata along with LayerZero parameters.
     * @param _name The name of the ERC20 token.
     * @param _symbol The symbol of the ERC20 token.
     * @param _lzEndpoint The LayerZero endpoint to facilitate cross-chain transfers.
     * @param _delegate The address of the contract delegate or owner.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
        // RuneMetadata memory _metadata
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {
        // require(bytes(_metadata.runeOwner).length > 0, "Rune owner cannot be empty");
        // require(_metadata.bagAmount > 0, "Bag amount must be greater than 0");
        // runeMetadata = _metadata;
    }

    /**
     * @notice Configures the metadata of the Rune.
     * @dev This function can only be called by the factory.
     * @param _metadata The metadata of the Rune (runeId, runeOwner, bagAmount).
     */
    function configureRuneMetadata(RuneMetadata memory _metadata) external onlyOwner {
        require(bytes(_metadata.runeOwner).length > 0, "Rune owner cannot be empty");
        require(_metadata.bagAmount > 0, "Bag amount must be greater than 0");
        runeMetadata = _metadata;
    }

    /**
     * @notice Mints new tokens and transfers them to the recipient.
     * @dev This function can only be called by the factory.
     * @param _recipient The address to receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     */
    function mint(address _recipient, uint256 _amount) external onlyOwner {
        require(_recipient != address(0), "Recipient cannot be the zero address");
        _mint(_recipient, _amount);
    }

    /**
     * @notice Returns the full metadata of the Rune.
     * @return The Rune metadata (runeId, runeOwner, bagAmount).
     */
    function getRuneMetadata() external view returns (RuneMetadata memory) {
        return runeMetadata;
    }
}
