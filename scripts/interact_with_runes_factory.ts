import * as dotenv from 'dotenv'
import { BigNumberish, BytesLike, ethers } from 'ethers'

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { Options, addressToBytes32 } from '@layerzerolabs/lz-v2-utilities'

dotenv.config()
interface SendParam {
    dstEid: EndpointId // Destination endpoint ID, represented as a number.
    to: BytesLike // Recipient address, represented as bytes.
    amountLD: BigNumberish // Amount to send in local decimals.
    minAmountLD: BigNumberish // Minimum amount to send in local decimals.
    extraOptions: BytesLike // Additional options supplied by the caller to be used in the LayerZero message.
    composeMsg: BytesLike // The composed message for the send() operation.
    oftCmd: BytesLike // The OFT command to be executed, unused in default OFT implementations.
}

import RuneCrossChainTokenArtifact from '../artifacts/contracts/RuneCrossChainToken.sol/RuneCrossChainToken.json'
import RuneTokenFactoryArtifact from '../artifacts/contracts/RuneTokenFactory.sol/RuneTokenFactory.json'

// command to run this script:
// npx ts-node scripts/interact_with_runes_factory.ts

// Ensure the ABI is correctly typed
const RuneCrossChainToken_abi = RuneCrossChainTokenArtifact.abi as ethers.ContractInterface
const RuneTokenFactory_abi = RuneTokenFactoryArtifact.abi as ethers.ContractInterface

const BASE_SEPOLIA_RPC = process.env.BASESEP_V2_TESTNET || 'https://sepolia.base.org'
console.log('BASE_SEPOLIA_RPC:', BASE_SEPOLIA_RPC)
const FUJI_RPC = process.env.AVALANCHE_V2_TESTNET || 'https://rpc.ankr.com/avalanche_fuji'
console.log('FUJI_RPC:', FUJI_RPC)
// const FUJI_RPC = 'https://rpc.ankr.com/avalanche_fuji'
// const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

// Replace these with your actual deployed RuneTokenFactory addresses
const BASE_SEPOLIA_FACTORY_ADDRESS = '0x679eA635Bc951aDc4B87ddfAfC1B6d724d5C1474'
const FUJI_FACTORY_ADDRESS = '0x706F2756249cF5c9A71407C1D5F243a863Bf6a26'

const BASE_SEPOLIA_EID = 40245
const FUJI_EID = 40106

// Set token names and symbols
// change token name on each run to avoid name conflicts
const TOKEN_NAME = 'RuneTokenXX42'
const TOKEN_SYMBOL_BASE = 'RTBX'
const TOKEN_SYMBOL_FUJI = 'RTFX'

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

    // ############################################################################
    // Deploy RuneCrossChainTokens
    // ############################################################################

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

    const txd1 = await baseSepoliaFactory.deployRuneToken(TOKEN_NAME, TOKEN_SYMBOL_BASE, BASE_SEPOLIA_EID)
    await txd1.wait()
    console.log('txd1 done')

    const txd2 = await fujiFactory.deployRuneToken(TOKEN_NAME, TOKEN_SYMBOL_FUJI, FUJI_EID)
    await txd2.wait()
    console.log('txd2 done')

    // ############################################################################
    // END Connect to the RuneTokenFactory contracts
    // ############################################################################

    // Get the addresses of the deployed RuneCrossChainTokens
    const runeTokenBaseAddress = await baseSepoliaFactory.getOFTAddress(TOKEN_NAME, TOKEN_SYMBOL_BASE, BASE_SEPOLIA_EID)
    const runeTokenFujiAddress = await fujiFactory.getOFTAddress(TOKEN_NAME, TOKEN_SYMBOL_FUJI, FUJI_EID)

    // Connect to the deployed RuneCrossChainTokens
    const runeTokenBase = new ethers.Contract(runeTokenBaseAddress, RuneCrossChainToken_abi, baseSepoliaWallet)
    const runeTokenFuji = new ethers.Contract(runeTokenFujiAddress, RuneCrossChainToken_abi, fujiWallet)

    // ############################################################################
    // New RuneCrossChainTokens configuration
    // ############################################################################
    console.log('RuneToken_Base (Base Sepolia) deployed at:', runeTokenBaseAddress)
    console.log('RuneToken_Fuji (Fuji) deployed at:', runeTokenFujiAddress)

    // Set configureRuneMetadata from the RuneTokenFactory contract
    console.log('Setting metadata...')
    const txm1 = await baseSepoliaFactory.configureRuneMetadata(
        runeTokenBaseAddress,
        runeMetadataBase.runeId,
        runeMetadataBase.runeOwner,
        runeMetadataBase.bagAmount
    )
    await txm1.wait()

    const txm2 = await fujiFactory.configureRuneMetadata(
        runeTokenFujiAddress,
        runeMetadataFuji.runeId,
        runeMetadataFuji.runeOwner,
        runeMetadataFuji.bagAmount
    )
    await txm2.wait()

    // Transfer ownership and set peers for cross-chain communication
    console.log('Configuring RuneCrossChainTokens... ownership')
    const txc1 = await baseSepoliaFactory.transferOFTOwnership(runeTokenBaseAddress, baseSepoliaWallet.address)
    await txc1.wait()
    const txc2 = await fujiFactory.transferOFTOwnership(runeTokenFujiAddress, fujiWallet.address)
    await txc2.wait()

    console.log('Configuring RuneCrossChainTokens... setPeer')
    const tx3 = await runeTokenFuji.setPeer(BASE_SEPOLIA_EID, ethers.utils.zeroPad(runeTokenBaseAddress, 32))
    await tx3.wait()
    const tx4 = await runeTokenBase.setPeer(FUJI_EID, ethers.utils.zeroPad(runeTokenFujiAddress, 32))
    await tx4.wait()

    // ############################################################################
    // New RuneCrossChainTokens configuration
    // ############################################################################

    // Mint tokens
    const initialAmount = ethers.utils.parseEther('100')
    await runeTokenFuji.mint(fujiWallet.address, initialAmount)

    console.log('Initial balance on Fuji:', ethers.utils.formatEther(await runeTokenFuji.balanceOf(fujiWallet.address)))

    // Prepare cross-chain transfer from Base Sepolia to Fuji
    const options = Options.newOptions().addExecutorLzReceiveOption(65000, 0).toBytes()
    const tokensToSend = ethers.utils.parseEther('10')

    const sendParam: SendParam = {
        dstEid: BASE_SEPOLIA_EID,
        to: addressToBytes32(baseSepoliaWallet.address),
        amountLD: tokensToSend,
        minAmountLD: tokensToSend,
        extraOptions: options,
        composeMsg: ethers.utils.arrayify('0x'), // Assuming no composed message
        oftCmd: ethers.utils.arrayify('0x'), // Assuming no OFT command is needed
    }

    // Get the quote for the send operation
    const feeQuote = await runeTokenFuji.quoteSend(sendParam, false)
    const nativeFee = feeQuote.nativeFee

    console.log('Sending tokens cross-chain...')

    const tx = await runeTokenFuji.send(sendParam, { nativeFee: nativeFee, lzTokenFee: 0 }, baseSepoliaWallet.address, {
        value: nativeFee,
    })

    // Wait for the transaction to be mined
    await tx.wait()
    console.log(`Send tx initiated. See: https://layerzeroscan.com/tx/${tx.hash}`)

    // Check final balances
    const finalBalanceFuji = await runeTokenFuji.balanceOf(fujiWallet.address)
    const finalBalanceBase = await runeTokenBase.balanceOf(baseSepoliaWallet.address)

    console.log('Final balance on Fuji:', ethers.utils.formatEther(finalBalanceFuji))
    console.log('Final balance on Base Sepolia:', ethers.utils.formatEther(finalBalanceBase))

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
    // If the error object has a data property, it might contain more info
    if (error.data) {
        console.error('Error data:', error.data)
    } else {
        console.error('Detailed error:', error)
    }

    process.exit(1)
})
