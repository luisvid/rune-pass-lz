# RuneCrossChainToken & RuneTokenFactory

This project implements an ERC-20 token system to represent Bitcoin Runes on EVM-compatible blockchains, enabling cross-chain transfers using LayerZero's Omnichain Fungible Token (OFT) standard.

## Features

- Cross-chain token transfers using LayerZero's OFT standard
- Factory pattern for deploying and managing Rune tokens
- Immutable Rune metadata storage (runeId, runeOwner, bagAmount)
- Controlled minting process

## Contracts Overview

1. **RuneCrossChainToken**: ERC-20 token representing a unique Rune with metadata and cross-chain transfer capabilities.
2. **RuneTokenFactory**: Deploys and manages RuneCrossChainToken contracts.

## Installation

```bash
git clone https://github.com/your-repository/rune-token-system.git
cd rune-token-system
npm install
npx hardhat compile
```

## Deployment

1. Set up `.env` file with `PRIVATE_KEY` and `INFURA_API_KEY`.

2. Deploy RuneTokenFactory:

```bash
npx hardhat run scripts/deploy_rune_token_factory.ts --network <network-name>
```

This script deploys the RuneTokenFactory contract and logs its address.

## Interaction with Deployed Contracts

Use the `interact_with_rune_tokens.ts` script to interact with deployed contracts:

```bash
npx ts-node scripts/interact_with_rune_tokens.ts
```

This script:

- Deploys RuneCrossChainTokens on Base Sepolia and Avalanche Fuji testnets
- Sets up cross-chain communication
- Mints tokens
- Performs a cross-chain transfer
- Retrieves and logs token balances and Rune metadata

Ensure you've updated the script with the correct deployed RuneTokenFactory addresses before running.

## Testing

```bash
npx hardhat test
```

## Security Considerations

- Only RuneTokenFactory can mint tokens for RuneCrossChainToken contracts
- Ownership is transferred to a delegate during deployment for secure management

## License

MIT License

## Future Enhancements

- Migration to ERC-1155 (pending LayerZero support)
- Implement proxy-based deployment for upgradability
- Expand Rune metadata storage
