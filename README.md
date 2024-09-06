# RuneCrossChainToken & RuneTokenFactory

This project implements an ERC-20 token system to represent Bitcoin Runes on EVM-compatible blockchains. Using LayerZero's Omnichain Fungible Token (OFT) standard, these tokens can be transferred across different chains. The system consists of a **`RuneCrossChainToken`** contract that holds metadata for each Rune and a **`RuneTokenFactory`** contract to deploy and manage these tokens.

## Features

- **Omnichain Fungible Token (OFT)**: Tokens can be transferred between different EVM-compatible blockchains using LayerZero's OFT standard.
- **Factory Pattern**: The `RuneTokenFactory` allows deployment of new tokens for each Rune based on metadata, such as `runeId`, `runeOwner`, and `bagAmount`.
- **Minting Control**: Only the factory is authorized to mint tokens for a specific Rune.
- **Rune Metadata**: Each RuneCrossChainToken holds immutable metadata associated with the Rune:
  - `runeId`: A unique identifier or content for the Rune.
  - `runeOwner`: The original owner or creator of the Rune (in Taproot address format).
  - `bagAmount`: The number of tokens representing the Runes in the bag.

## Contracts Overview

### 1. `RuneCrossChainToken`

`RuneCrossChainToken` is an ERC-20 token contract extended from OpenZeppelin's `Ownable` and LayerZero's `OFT` standard. It represents a unique Rune token with metadata and enables cross-chain transfers. Only the `RuneTokenFactory` contract is authorized to mint new tokens.

**Key Functions**:

- `constructor`: Initializes the token with metadata provided by the factory.
- `mint`: Allows the factory to mint new tokens.
- `getRuneMetadata`: Returns the metadata of the Rune, including `runeId`, `runeOwner`, and `bagAmount`.

**Structs**:

- `RuneMetadata`: Holds the metadata of the Rune including the `runeId`, `runeOwner`, and `bagAmount`.

### 2. `RuneTokenFactory`

`RuneTokenFactory` is responsible for deploying new `RuneCrossChainToken` contracts for each Rune, minting tokens, and handling cross-chain transfer functionalities.

**Key Functions**:

- `createRuneToken`: Deploys a new `RuneCrossChainToken` or mints additional tokens if the token already exists for the Rune.
- `getRuneTokenAddress`: Returns the deployed token address for a specific `runeId`.

**Events**:

- `RuneTokenCreated`: Emitted when a new `RuneCrossChainToken` is created.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-repository/rune-token-system.git
   cd rune-token-system
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

## Deployment

1. Set up your environment variables in a `.env` file. Example:

   ```bash
   PRIVATE_KEY=<your-private-key>
   INFURA_API_KEY=<your-infura-api-key>
   ```

2. Deploy the `RuneTokenFactory` contract:

   ```bash
   npx hardhat run scripts/deployFactory.js --network <your-network>
   ```

3. Use the factory to deploy new `RuneCrossChainToken` contracts.

## Usage

### Deploying a New Rune Token

To create a new RuneCrossChainToken, the factory uses the `createRuneToken` function, which takes the following parameters:

- `_name`: The name of the ERC-20 token.
- `_symbol`: The symbol for the ERC-20 token.
- `_lzEndpoint`: The LayerZero endpoint for cross-chain transfers.
- `_delegate`: The owner of the newly deployed token contract.
- `_runeId`: A unique identifier for the Rune.
- `_runeOwner`: The original owner's Taproot address.
- `_bagAmount`: The number of tokens to mint.
- `_recipient`: The EVM address to receive the tokens.

Example of how to interact with the `createRuneToken` function:

```solidity
RuneTokenFactory factory = RuneTokenFactory(<factory-address>);
factory.createRuneToken(
    "RuneToken",
    "RUNE",
    <lzEndpointAddress>,
    <delegateAddress>,
    <runeId>,
    "tb1q....",
    100,
    <recipientAddress>
);
```

### Querying Metadata

You can retrieve the metadata for a specific `RuneCrossChainToken` by calling the `getRuneMetadata` function.

Example:

```solidity
RuneCrossChainToken token = RuneCrossChainToken(<token-address>);
(RuneMetadata memory metadata) = token.getRuneMetadata();
```

### Minting More Tokens

To mint more tokens for an existing Rune, call the `createRuneToken` function with the same `runeId`. The factory will mint new tokens and send them to the recipient.

## Testing

To run tests:

```bash
npx hardhat test
```

## Security Considerations

- Only the `RuneTokenFactory` contract can mint tokens for the `RuneCrossChainToken` contracts, ensuring that token creation is restricted.
- Ownership is transferred to a `delegate` during contract deployment, allowing for secure management of the token.

## License

This project is licensed under the MIT License.

---

## Future Enhancements

- **Migration to ERC-1155**: Migrate to ERC-1155 once LayerZero fully supports it. ERC-1155 would allow you to handle multiple tokens (for different Runes) within a single contract, saving gas and simplifying the management of multiple token types.
- **Support for Proxies**: Introduce proxy-based deployment to enable upgrades of the token contracts.
- **Additional Metadata**: Store more detailed metadata related to the Rune, such as Bitcoin block height or transaction details.
