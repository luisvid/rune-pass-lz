import * as dotenv from 'dotenv'
import { ethers } from 'ethers'

import { Options } from '@layerzerolabs/lz-v2-utilities'

dotenv.config()

import RuneCrossChainTokenArtifact from '../artifacts/contracts/RuneCrossChainToken.sol/RuneCrossChainToken.json'
import RuneTokenFactoryArtifact from '../artifacts/contracts/RuneTokenFactory.sol/RuneTokenFactory.json'

// command to run this script:
// npx ts-node scripts/interact_with_runes_factory.ts

// Ensure the ABI is correctly typed
const RuneCrossChainToken_abi = RuneCrossChainTokenArtifact.abi as ethers.ContractInterface
const RuneTokenFactory_abi = RuneTokenFactoryArtifact.abi as ethers.ContractInterface

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'
const FUJI_RPC = 'https://rpc.ankr.com/avalanche_fuji'

// Deployed contract: RuneTokenFactory, network: base-sepolia, address: 0x9FcB3E6913AA95043E043B0671588116361c480f
// Deployed contract: RuneTokenFactory, network: avalanche-testnet, address: 0x6BB8872bd6C8546c77A1127cc2ff2A74A498C691
// Deployed contract: RuneTokenFactory, network: sepolia-testnet, address: 0xaAD7Bd4a78804f4Aa331e371714f3f9D254f5Db7

// Replace these with your actual deployed RuneTokenFactory addresses
const BASE_SEPOLIA_FACTORY_ADDRESS = '0x9FcB3E6913AA95043E043B0671588116361c480f'
const FUJI_FACTORY_ADDRESS = '0x6BB8872bd6C8546c77A1127cc2ff2A74A498C691'

const BASE_SEPOLIA_EID = 40245
const FUJI_EID = 40106

// Set token names and symbols
// change token name on each run to avoid name conflicts
const TOKEN_NAME = 'RuneTokenXXXX'
const TOKEN_SYMBOL_BASE = 'RTB'
const TOKEN_SYMBOL_FUJI = 'RTF'

async function main() {
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('Private key not found in .env file')

    const baseSepoliaProvider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC)
    const fujiProvider = new ethers.providers.JsonRpcProvider(FUJI_RPC)

    const baseSepoliaWallet = new ethers.Wallet(privateKey, baseSepoliaProvider)
    const fujiWallet = new ethers.Wallet(privateKey, fujiProvider)

    const baseSepoliaFactory = new ethers.Contract(
        BASE_SEPOLIA_FACTORY_ADDRESS,
        RuneTokenFactory_abi,
        baseSepoliaWallet
    )
    const fujiFactory = new ethers.Contract(FUJI_FACTORY_ADDRESS, RuneTokenFactory_abi, fujiWallet)

    // Deploy RuneCrossChainTokens
    console.log('Deploying RuneCrossChainTokens...')
    const runeMetadataBase = {
        runeId: ethers.utils.formatBytes32String('RuneBase'),
        runeOwner: 'TaprootAddressBase',
        bagAmount: ethers.utils.parseEther('100'),
    }
    const runeMetadataFuji = {
        runeId: ethers.utils.formatBytes32String('RuneFuji'),
        runeOwner: 'TaprootAddressFuji',
        bagAmount: ethers.utils.parseEther('100'),
    }

    await baseSepoliaFactory.deployRuneToken(
        TOKEN_NAME,
        TOKEN_SYMBOL_BASE,
        BASE_SEPOLIA_EID,
        runeMetadataBase.runeId,
        runeMetadataBase.runeOwner,
        runeMetadataBase.bagAmount
    )
    await fujiFactory.deployRuneToken(
        TOKEN_NAME,
        TOKEN_SYMBOL_FUJI,
        FUJI_EID,
        runeMetadataFuji.runeId,
        runeMetadataFuji.runeOwner,
        runeMetadataFuji.bagAmount
    )

    // Wait for the transactions to be mined
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Get the addresses of the deployed RuneCrossChainTokens
    const runeTokenBaseAddress = await baseSepoliaFactory.getOFTAddress(TOKEN_NAME, TOKEN_SYMBOL_BASE, BASE_SEPOLIA_EID)
    const runeTokenFujiAddress = await fujiFactory.getOFTAddress(TOKEN_NAME, TOKEN_SYMBOL_FUJI, FUJI_EID)

    console.log('RuneToken_Base (Base Sepolia) deployed at:', runeTokenBaseAddress)
    console.log('RuneToken_Fuji (Fuji) deployed at:', runeTokenFujiAddress)

    // Connect to the deployed RuneCrossChainTokens
    const runeTokenBase = new ethers.Contract(runeTokenBaseAddress, RuneCrossChainToken_abi, baseSepoliaWallet)
    const runeTokenFuji = new ethers.Contract(runeTokenFujiAddress, RuneCrossChainToken_abi, fujiWallet)

    // Transfer ownership and set peers for cross-chain communication
    console.log('Configuring RuneCrossChainTokens... ownership')
    const tx1 = await baseSepoliaFactory.transferOFTOwnership(runeTokenBaseAddress, baseSepoliaWallet.address)
    await tx1.wait()
    const tx2 = await fujiFactory.transferOFTOwnership(runeTokenFujiAddress, fujiWallet.address)
    await tx2.wait()

    console.log('Configuring RuneCrossChainTokens... setPeer')
    const tx3 = await runeTokenFuji.setPeer(BASE_SEPOLIA_EID, ethers.utils.zeroPad(runeTokenBaseAddress, 32))
    await tx3.wait()
    const tx4 = await runeTokenBase.setPeer(FUJI_EID, ethers.utils.zeroPad(runeTokenFujiAddress, 32))
    await tx4.wait()

    // Mint tokens on Base Sepolia
    const initialAmount = ethers.utils.parseEther('50')
    await runeTokenBase.mint(baseSepoliaWallet.address, initialAmount)

    console.log(
        'Initial balance on Base Sepolia:',
        ethers.utils.formatEther(await runeTokenBase.balanceOf(baseSepoliaWallet.address))
    )

    // Prepare cross-chain transfer from Base Sepolia to Fuji
    const tokensToSend = ethers.utils.parseEther('10')
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    const sendParam = [
        FUJI_EID,
        ethers.utils.zeroPad(fujiWallet.address, 32),
        tokensToSend,
        tokensToSend,
        options,
        '0x',
        '0x',
    ]

    // Quote and send
    const [nativeFee] = await runeTokenBase.quoteSend(sendParam, false)
    console.log('Native fee:', ethers.utils.formatEther(nativeFee))

    console.log('Sending tokens from Base Sepolia to Fuji...')

    const tx = await runeTokenBase.send(sendParam, [nativeFee, 0], baseSepoliaWallet.address, {
        value: nativeFee,
        gasLimit: 500000,
    })

    // Wait for the transaction to be mined
    const receipt = await tx.wait()
    console.log('Transaction mined. Block number:', receipt.blockNumber)
    // Log the transaction hash and LayerZero Scan URL
    console.log('Transaction hash:', tx.hash)
    console.log('Check the status of your transaction on LayerZero Scan:')
    console.log(`https://testnet.layerzeroscan.com/tx/${tx.hash}`)

    // Check final balances
    const finalBalanceBase = await runeTokenBase.balanceOf(baseSepoliaWallet.address)
    const finalBalanceFuji = await runeTokenFuji.balanceOf(fujiWallet.address)

    console.log('Final balance on Base Sepolia:', ethers.utils.formatEther(finalBalanceBase))
    console.log('Final balance on Fuji:', ethers.utils.formatEther(finalBalanceFuji))

    // Get and log Rune metadata
    const metadataBase = await runeTokenBase.getRuneMetadata()
    const metadataFuji = await runeTokenFuji.getRuneMetadata()

    console.log('RuneToken_Base metadata:', {
        runeId: ethers.utils.parseBytes32String(metadataBase.runeId),
        runeOwner: metadataBase.runeOwner,
        bagAmount: ethers.utils.formatEther(metadataBase.bagAmount),
    })

    console.log('RuneToken_Fuji metadata:', {
        runeId: ethers.utils.parseBytes32String(metadataFuji.runeId),
        runeOwner: metadataFuji.runeOwner,
        bagAmount: ethers.utils.formatEther(metadataFuji.bagAmount),
    })
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
